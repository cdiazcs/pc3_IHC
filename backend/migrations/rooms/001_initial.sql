-- Migración 001 de salas. Solo ejecutar mediante scripts/init_rooms_db.py.

CREATE SCHEMA salas;

CREATE TABLE salas.participants (
	id UUID NOT NULL,
	display_name VARCHAR(50) NOT NULL,
	token_hash BYTEA NOT NULL,
	token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	revoked_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT ck_participant_name CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 50),
	CONSTRAINT ck_participant_hash CHECK (octet_length(token_hash) = 32),
	CONSTRAINT ck_participant_expiry CHECK (token_expires_at > created_at),
	CONSTRAINT uq_participant_token UNIQUE (token_hash)
);

CREATE TABLE salas.schema_migrations (
	version VARCHAR(40) NOT NULL,
	checksum CHAR(64) NOT NULL,
	applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY (version)
);

CREATE TABLE salas.rooms (
	id UUID NOT NULL,
	created_by UUID NOT NULL,
	creation_request_id UUID NOT NULL,
	name VARCHAR(80) NOT NULL,
	crop VARCHAR(20),
	join_code_hash BYTEA NOT NULL,
	last_alert_sequence BIGINT DEFAULT 0 NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_room_creation UNIQUE (created_by, creation_request_id),
	CONSTRAINT uq_room_invitation UNIQUE (join_code_hash),
	CONSTRAINT ck_room_name CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
	CONSTRAINT ck_room_crop CHECK (crop IS NULL OR crop IN ('papa','maiz','tomate','cafe','trigo','otro')),
	CONSTRAINT ck_room_hash CHECK (octet_length(join_code_hash) = 32),
	CONSTRAINT ck_room_sequence CHECK (last_alert_sequence >= 0),
	FOREIGN KEY(created_by) REFERENCES salas.participants (id) ON DELETE RESTRICT
);

CREATE TABLE salas.memberships (
	room_id UUID NOT NULL,
	participant_id UUID NOT NULL,
	role VARCHAR(10) NOT NULL,
	joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY (room_id, participant_id),
	CONSTRAINT ck_membership_role CHECK (role IN ('owner','member')),
	FOREIGN KEY(room_id) REFERENCES salas.rooms (id) ON DELETE RESTRICT,
	FOREIGN KEY(participant_id) REFERENCES salas.participants (id) ON DELETE RESTRICT
);

CREATE INDEX ix_memberships_participant ON salas.memberships (participant_id, joined_at, room_id);

CREATE UNIQUE INDEX uq_membership_owner ON salas.memberships (room_id) WHERE role = 'owner';

CREATE TABLE salas.alerts (
	id UUID NOT NULL,
	room_id UUID NOT NULL,
	author_id UUID NOT NULL,
	client_request_id UUID NOT NULL,
	sequence BIGINT NOT NULL,
	crop VARCHAR(20) NOT NULL,
	text VARCHAR(500) NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT fk_alert_membership FOREIGN KEY(room_id, author_id) REFERENCES salas.memberships (room_id, participant_id) ON DELETE RESTRICT,
	CONSTRAINT uq_alert_sequence UNIQUE (room_id, sequence),
	CONSTRAINT uq_alert_request UNIQUE (room_id, author_id, client_request_id),
	CONSTRAINT ck_alert_sequence CHECK (sequence > 0),
	CONSTRAINT ck_alert_crop CHECK (crop IN ('papa','maiz','tomate','cafe','trigo','otro')),
	CONSTRAINT ck_alert_text CHECK (char_length(btrim(text)) BETWEEN 12 AND 500),
	FOREIGN KEY(room_id) REFERENCES salas.rooms (id) ON DELETE RESTRICT
);
