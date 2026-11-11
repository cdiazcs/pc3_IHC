from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID
import unicodedata

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

Crop = Literal['papa', 'maiz', 'tomate', 'cafe', 'trigo', 'otro']
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]


class Input(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

    @field_validator('*', mode='before')
    @classmethod
    def no_controls(cls, value):
        if isinstance(value, str) and any(unicodedata.category(c) == 'Cc' and c not in '\n\t\r' for c in value):
            raise ValueError('No se permiten caracteres de control.')
        return value


class ParticipantCreate(Input):
    display_name: Name


class RoomCreate(Input):
    name: str = Field(min_length=1, max_length=80)
    crop: Crop | None = None
    client_request_id: UUID


class JoinRoom(Input):
    join_code: str = Field(pattern=r'^[A-HJ-NP-Z2-9]{12}$')

    @field_validator('join_code', mode='before')
    @classmethod
    def normalize_code(cls, value):
        return value.strip().upper() if isinstance(value, str) else value


class AlertCreate(Input):
    crop: Crop
    text: str = Field(min_length=12, max_length=500)
    client_request_id: UUID


class ParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    display_name: str
    created_at: datetime


class ParticipantSession(BaseModel):
    participant: ParticipantOut
    access_token: str
    token_type: Literal['bearer'] = 'bearer'
    expires_at: datetime


class RoomSummary(BaseModel):
    id: UUID
    name: str
    crop: Crop | None
    created_at: datetime
    my_role: Literal['owner', 'member']
    member_count: int


class RoomCreated(BaseModel):
    room: RoomSummary
    join_code: str | None
    replayed: bool


class RoomsList(BaseModel):
    items: list[RoomSummary]
    has_more: bool
    next_offset: int | None


class MembershipOut(BaseModel):
    participant_id: UUID
    role: Literal['owner', 'member']
    joined_at: datetime


class JoinedRoom(BaseModel):
    room: RoomSummary
    membership: MembershipOut
    already_member: bool


class InvitationOut(BaseModel):
    room_id: UUID
    join_code: str


class AuthorOut(BaseModel):
    id: UUID
    display_name: str


class AlertOut(BaseModel):
    id: UUID
    room_id: UUID
    sequence: str
    author: AuthorOut
    crop: Crop
    text: str
    created_at: datetime


class AlertCreated(BaseModel):
    alert: AlertOut
    replayed: bool


class AlertsPage(BaseModel):
    items: list[AlertOut]
    next_after: str
    has_more: bool
