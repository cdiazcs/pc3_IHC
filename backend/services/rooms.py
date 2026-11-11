"""Reglas del dominio salas. El router delimita y confirma cada transacción."""
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from threading import Lock
import time
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from db.models_rooms import Alert, Membership, Participant, Room
from schemas.rooms import (AlertCreated, AlertOut, AlertsPage, AuthorOut, InvitationOut,
                           JoinedRoom, MembershipOut, ParticipantOut, ParticipantSession,
                           RoomCreated, RoomsList, RoomSummary)


class RoomsError(Exception):
    def __init__(self, status: int, code: str, message: str, headers=None):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message
        self.headers = headers or {}


def digest(value: str) -> bytes:
    return hashlib.sha256(value.encode()).digest()


def new_invitation() -> str:
    return ''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(12))


class JoinLimiter:
    """Demo de un worker: límites por participante Y origen, sin tokens en memoria."""
    def __init__(self):
        self.lock = Lock()
        self.buckets = defaultdict(deque)

    def check(self, participant_id: UUID, origin: str):
        now = time.monotonic()
        with self.lock:
            if len(self.buckets) >= 4096:
                self.buckets = defaultdict(deque, {k: v for k, v in self.buckets.items() if v and v[-1] > now - 60})
            keys = (('participant', str(participant_id)), ('origin', origin))
            if len(self.buckets) >= 4096 or any(len(self._recent(key, now)) >= 10 for key in keys):
                raise RoomsError(429, 'join_rate_limited', 'Espera un minuto antes de volver a intentar.', {'Retry-After': '60'})
            for key in keys:
                self.buckets[key].append(now)

    def _recent(self, key, now):
        bucket = self.buckets[key]
        while bucket and bucket[0] <= now - 60:
            bucket.popleft()
        return bucket


class RoomsService:
    def __init__(self, db: Session):
        self.db = db

    def register(self, body):
        token = secrets.token_urlsafe(32)
        participant = Participant(id=uuid4(), display_name=body.display_name, token_hash=digest(token),
                                  token_expires_at=datetime.now(timezone.utc) + timedelta(hours=24))
        self.db.add(participant)
        self.db.flush()
        return ParticipantSession(participant=ParticipantOut.model_validate(participant), access_token=token,
                                  expires_at=participant.token_expires_at)

    def actor(self, token):
        participant = self.db.scalar(select(Participant).where(
            Participant.token_hash == digest(token), Participant.revoked_at.is_(None),
            Participant.token_expires_at > func.current_timestamp()))
        if participant is None:
            raise RoomsError(401, 'demo_session_required', 'La sesión demo no es válida o ha vencido.',
                             {'WWW-Authenticate': 'Bearer'})
        return participant

    def room(self, room_id, *, locked=False):
        query = select(Room).where(Room.id == room_id)
        if locked:
            query = query.with_for_update()
        room = self.db.scalar(query)
        if room is None:
            raise RoomsError(404, 'room_not_found', 'No se encontró la sala.')
        return room

    def membership(self, room, actor, *, owner=False):
        membership = self.db.get(Membership, (room.id, actor.id))
        if membership is None:
            raise RoomsError(403, 'not_a_member', 'Únete a la sala antes de consultar o publicar alertas.')
        if owner and (membership.role != 'owner' or room.created_by != actor.id):
            raise RoomsError(403, 'owner_required', 'Solo el creador puede generar otra invitación.')
        return membership

    def summary(self, room, membership):
        count = self.db.scalar(select(func.count()).select_from(Membership).where(Membership.room_id == room.id))
        return RoomSummary(id=room.id, name=room.name, crop=room.crop, created_at=room.created_at,
                           my_role=membership.role, member_count=count)

    def create(self, actor, body):
        code = new_invitation()
        room_id = uuid4()
        # ON CONFLICT espera la transacción concurrente; el SELECT posterior ve su commit.
        created = self.db.scalar(insert(Room).values(
            id=room_id, created_by=actor.id, creation_request_id=body.client_request_id,
            name=body.name, crop=body.crop, join_code_hash=digest(code)).on_conflict_do_nothing(
                constraint='uq_room_creation').returning(Room.id))
        if created is None:
            room = self.db.scalar(select(Room).where(Room.created_by == actor.id,
                                  Room.creation_request_id == body.client_request_id))
            if room.name != body.name or room.crop != body.crop:
                raise RoomsError(409, 'idempotency_conflict', 'La clave ya se usó para otra creación de sala.')
            membership = self.membership(room, actor)
            return RoomCreated(room=self.summary(room, membership), join_code=None, replayed=True)
        room = self.room(room_id)
        membership = Membership(room_id=room_id, participant_id=actor.id, role='owner')
        self.db.add(membership)
        self.db.flush()
        return RoomCreated(room=self.summary(room, membership), join_code=code, replayed=False)

    def list_rooms(self, actor, limit, offset):
        pairs = self.db.execute(select(Room, Membership).join(Membership, Room.id == Membership.room_id).where(
            Membership.participant_id == actor.id).order_by(Membership.joined_at.desc(), Room.id.desc()).limit(
                limit + 1).offset(offset)).all()
        more = len(pairs) > limit
        return RoomsList(items=[self.summary(room, member) for room, member in pairs[:limit]],
                         has_more=more, next_offset=offset + limit if more else None)

    def join(self, actor, body):
        # Revalidar hash tras adquirir el lock: una rotación puede haber confirmado al esperar.
        room_id = self.db.scalar(select(Room.id).where(Room.join_code_hash == digest(body.join_code)))
        if room_id is None:
            raise RoomsError(404, 'invite_not_found', 'El código no existe o ya no está vigente.')
        room = self.room(room_id, locked=True)
        if room.join_code_hash != digest(body.join_code):
            raise RoomsError(404, 'invite_not_found', 'El código no existe o ya no está vigente.')
        inserted = self.db.scalar(insert(Membership).values(room_id=room.id, participant_id=actor.id,
                                 role='member').on_conflict_do_nothing().returning(Membership.participant_id))
        member = self.membership(room, actor)
        return JoinedRoom(room=self.summary(room, member), membership=MembershipOut(
            participant_id=member.participant_id, role=member.role, joined_at=member.joined_at),
            already_member=inserted is None)

    def rotate(self, actor, room_id):
        room = self.room(room_id, locked=True)
        self.membership(room, actor, owner=True)
        code = new_invitation()
        room.join_code_hash = digest(code)
        room.updated_at = func.current_timestamp()
        self.db.flush()
        return InvitationOut(room_id=room_id, join_code=code)

    def alert_out(self, alert):
        author = self.db.get(Participant, alert.author_id)
        return AlertOut(id=alert.id, room_id=alert.room_id, sequence=str(alert.sequence),
                        author=AuthorOut(id=author.id, display_name=author.display_name), crop=alert.crop,
                        text=alert.text, created_at=alert.created_at)

    def publish(self, actor, room_id, body):
        room = self.room(room_id, locked=True)
        self.membership(room, actor)
        existing = self.db.scalar(select(Alert).where(Alert.room_id == room_id, Alert.author_id == actor.id,
                                                    Alert.client_request_id == body.client_request_id))
        if existing is not None:
            if existing.crop != body.crop or existing.text != body.text:
                raise RoomsError(409, 'idempotency_conflict', 'La clave ya se usó para otra alerta.')
            return AlertCreated(alert=self.alert_out(existing), replayed=True)
        if room.last_alert_sequence == 9223372036854775807:
            raise RoomsError(503, 'database_busy', 'La sala no puede aceptar otra alerta en este momento.')
        room.last_alert_sequence += 1
        room.updated_at = func.current_timestamp()
        alert = Alert(room_id=room.id, author_id=actor.id, client_request_id=body.client_request_id,
                      sequence=room.last_alert_sequence, crop=body.crop, text=body.text)
        self.db.add(alert)
        self.db.flush()
        return AlertCreated(alert=self.alert_out(alert), replayed=False)

    def alerts(self, actor, room_id, after, limit):
        room = self.room(room_id)
        self.membership(room, actor)
        rows = self.db.scalars(select(Alert).where(Alert.room_id == room_id, Alert.sequence > after).order_by(
            Alert.sequence.asc()).limit(limit + 1)).all()
        items = [self.alert_out(alert) for alert in rows[:limit]]
        return AlertsPage(items=items, next_after=items[-1].sequence if items else str(after), has_more=len(rows) > limit)
