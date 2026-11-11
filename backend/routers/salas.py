"""Siete rutas /api/rooms. Ningún cambio de contrato en /api/consult."""
import logging
import re
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.responses import JSONResponse

from db.session import new_session
from rooms_config import RoomsConfig, RoomsConfigError
from schemas.rooms import (AlertCreate, AlertCreated, AlertsPage, InvitationOut, JoinedRoom, JoinRoom,
                           ParticipantCreate, ParticipantSession, RoomCreate, RoomCreated, RoomsList)
from services.rooms import JoinLimiter, RoomsError, RoomsService

logger = logging.getLogger('agrovoz.rooms')


class PrivateRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def wrapped(request):
            try:
                response = await handler(request)
            except HTTPException as error:
                response = JSONResponse({'detail': error.detail}, status_code=error.status_code, headers=error.headers)
            except RequestValidationError as error:
                response = await request_validation_exception_handler(request, error)
            except Exception:
                incident = str(uuid4())
                logger.error('rooms internal_error incident=%s', incident)  # Sin excepción/SQL/credenciales.
                response = JSONResponse({'detail': {'code': 'internal_error', 'message': 'No se pudo completar la operación.',
                                                   'incident_id': incident}}, status_code=500)
            response.headers['Cache-Control'] = 'no-store'
            return response
        return wrapped


router = APIRouter(prefix='/api/rooms', tags=['Salas'], route_class=PrivateRoute)


def session_dependency():
    try:
        session = new_session(RoomsConfig.load())
    except RoomsConfigError:
        raise HTTPException(503, detail={'code': 'rooms_not_configured', 'message': 'Configura PostgreSQL de salas con un rol dedicado.'}) from None
    with session:
        yield session


def token_dependency(request: Request):
    authorization = request.headers.get('Authorization', '')
    scheme, _, token = authorization.partition(' ')
    if scheme.lower() != 'bearer' or not re.fullmatch(r'[A-Za-z0-9_-]{43}', token):
        raise HTTPException(401, detail={'code': 'demo_session_required', 'message': 'Se requiere una sesión demo válida.'},
                            headers={'WWW-Authenticate': 'Bearer'})
    return token


limiter = JoinLimiter()


def limiter_dependency():
    return limiter


DB = Annotated[Session, Depends(session_dependency)]
Token = Annotated[str, Depends(token_dependency)]
Limiter = Annotated[JoinLimiter, Depends(limiter_dependency)]


def operation(session, callback):
    try:
        # Commit antes de retornar al router: un fallo de commit nunca devuelve 201.
        with session.begin():
            return callback(RoomsService(session))
    except RoomsError as error:
        raise HTTPException(error.status, detail={'code': error.code, 'message': error.message}, headers=error.headers) from None
    except RoomsConfigError:
        raise HTTPException(503, detail={'code': 'rooms_not_configured', 'message': 'Revisa los permisos del rol dedicado de salas.'}) from None
    except SQLAlchemyError as error:
        state = getattr(getattr(error, 'orig', None), 'sqlstate', None)
        logger.warning('rooms database_error sqlstate=%s', state if isinstance(state, str) else 'unknown')
        code = 'service_not_ready' if state in ('42P01', '3F000') else 'database_unavailable'
        raise HTTPException(503, detail={'code': code, 'message': 'El almacenamiento de salas no está disponible. Puedes reintentar.'}) from None


@router.post('/participants', response_model=ParticipantSession, status_code=201)
def register(body: ParticipantCreate, db: DB):
    return operation(db, lambda service: service.register(body))


@router.post('', response_model=RoomCreated, status_code=201,
             responses={200: {'model': RoomCreated, 'description': 'Reintento idempotente sin nueva sala.'}})
def create_room(body: RoomCreate, response: Response, token: Token, db: DB):
    result = operation(db, lambda service: service.create(service.actor(token), body))
    if result.replayed:
        response.status_code = 200
    return result


@router.get('', response_model=RoomsList)
def list_rooms(token: Token, db: DB, limit: Annotated[int, Query(ge=1, le=100)] = 50,
               offset: Annotated[int, Query(ge=0, le=9223372036854775807)] = 0):
    return operation(db, lambda service: service.list_rooms(service.actor(token), limit, offset))


@router.post('/join', response_model=JoinedRoom, status_code=201,
             responses={200: {'model': JoinedRoom, 'description': 'La membresía ya existía.'}})
def join_room(body: JoinRoom, response: Response, request: Request, token: Token, db: DB, join_limiter: Limiter):
    def perform(service):
        actor = service.actor(token)
        join_limiter.check(actor.id, request.client.host if request.client else 'unknown')
        return service.join(actor, body)
    result = operation(db, perform)
    if result.already_member:
        response.status_code = 200
    return result


@router.post('/{room_id}/invitations', response_model=InvitationOut)
def rotate_invitation(room_id: UUID, token: Token, db: DB):
    return operation(db, lambda service: service.rotate(service.actor(token), room_id))


@router.post('/{room_id}/alerts', response_model=AlertCreated, status_code=201,
             responses={200: {'model': AlertCreated, 'description': 'Reintento idempotente sin nueva alerta.'}})
def publish_alert(room_id: UUID, body: AlertCreate, response: Response, token: Token, db: DB):
    result = operation(db, lambda service: service.publish(service.actor(token), room_id, body))
    if result.replayed:
        response.status_code = 200
    return result


@router.get('/{room_id}/alerts', response_model=AlertsPage)
def list_alerts(room_id: UUID, token: Token, db: DB, after_sequence: Annotated[str, Query(pattern=r'^[0-9]{1,19}$')] = '0',
                limit: Annotated[int, Query(ge=1, le=100)] = 50):
    after = int(after_sequence)
    if after > 9223372036854775807:
        raise HTTPException(422, detail=[{'loc': ['query', 'after_sequence'], 'msg': 'Cursor fuera de rango.', 'type': 'value_error'}])
    return operation(db, lambda service: service.alerts(service.actor(token), room_id, after, limit))
