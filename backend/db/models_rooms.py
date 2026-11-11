"""Mapeos del diseño. Importar este archivo nunca ejecuta DDL."""
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (BigInteger, CHAR, CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint,
                        Index, LargeBinary, String, UniqueConstraint, func, text)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base

CROPS_SQL = "'papa','maiz','tomate','cafe','trigo','otro'"


class Participant(Base):
    __tablename__ = 'participants'
    __table_args__ = (
        CheckConstraint('char_length(btrim(display_name)) BETWEEN 1 AND 50', name='ck_participant_name'),
        CheckConstraint('octet_length(token_hash) = 32', name='ck_participant_hash'),
        CheckConstraint('token_expires_at > created_at', name='ck_participant_expiry'),
        UniqueConstraint('token_hash', name='uq_participant_token'),
    )
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    display_name: Mapped[str] = mapped_column(String(50))
    token_hash: Mapped[bytes] = mapped_column(LargeBinary)
    token_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())


class Room(Base):
    __tablename__ = 'rooms'
    __table_args__ = (
        UniqueConstraint('created_by', 'creation_request_id', name='uq_room_creation'),
        UniqueConstraint('join_code_hash', name='uq_room_invitation'),
        CheckConstraint('char_length(btrim(name)) BETWEEN 1 AND 80', name='ck_room_name'),
        CheckConstraint(f'crop IS NULL OR crop IN ({CROPS_SQL})', name='ck_room_crop'),
        CheckConstraint('octet_length(join_code_hash) = 32', name='ck_room_hash'),
        CheckConstraint('last_alert_sequence >= 0', name='ck_room_sequence'),
    )
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    created_by: Mapped[UUID] = mapped_column(ForeignKey('salas.participants.id', ondelete='RESTRICT'))
    creation_request_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True))
    name: Mapped[str] = mapped_column(String(80))
    crop: Mapped[str | None] = mapped_column(String(20), nullable=True)
    join_code_hash: Mapped[bytes] = mapped_column(LargeBinary)
    last_alert_sequence: Mapped[int] = mapped_column(BigInteger, server_default=text('0'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())


class Membership(Base):
    __tablename__ = 'memberships'
    __table_args__ = (
        CheckConstraint("role IN ('owner','member')", name='ck_membership_role'),
        Index('ix_memberships_participant', 'participant_id', 'joined_at', 'room_id'),
        Index('uq_membership_owner', 'room_id', unique=True, postgresql_where=text("role = 'owner'")),
    )
    room_id: Mapped[UUID] = mapped_column(ForeignKey('salas.rooms.id', ondelete='RESTRICT'), primary_key=True)
    participant_id: Mapped[UUID] = mapped_column(ForeignKey('salas.participants.id', ondelete='RESTRICT'), primary_key=True)
    role: Mapped[str] = mapped_column(String(10))
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())


class Alert(Base):
    __tablename__ = 'alerts'
    __table_args__ = (
        ForeignKeyConstraint(['room_id', 'author_id'], ['salas.memberships.room_id', 'salas.memberships.participant_id'],
                             ondelete='RESTRICT', name='fk_alert_membership'),
        UniqueConstraint('room_id', 'sequence', name='uq_alert_sequence'),
        UniqueConstraint('room_id', 'author_id', 'client_request_id', name='uq_alert_request'),
        CheckConstraint('sequence > 0', name='ck_alert_sequence'),
        CheckConstraint(f'crop IN ({CROPS_SQL})', name='ck_alert_crop'),
        CheckConstraint('char_length(btrim(text)) BETWEEN 12 AND 500', name='ck_alert_text'),
    )
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    room_id: Mapped[UUID] = mapped_column(ForeignKey('salas.rooms.id', ondelete='RESTRICT'))
    author_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True))
    client_request_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True))
    sequence: Mapped[int] = mapped_column(BigInteger)
    crop: Mapped[str] = mapped_column(String(20))
    text: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())


class SchemaMigration(Base):
    __tablename__ = 'schema_migrations'
    version: Mapped[str] = mapped_column(String(40), primary_key=True)
    checksum: Mapped[str] = mapped_column(CHAR(64))
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp())
