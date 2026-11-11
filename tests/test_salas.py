"""Unitarios + integración PostgreSQL REAL separada (sin fallback a base real)."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import secrets
import sys
import threading
import time
import unittest
from unittest.mock import patch
from uuid import uuid4

sys.path[:0] = [str(Path(__file__).resolve().parents[1] / 'backend')]

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from main import app
from db.models_rooms import Alert, Membership, Participant, Room
from db.session import engine_for
from rooms_config import RoomsConfig, RoomsConfigError, validate_url
from routers.salas import limiter_dependency, operation
from schemas.rooms import AlertCreate, RoomCreate
from scripts.init_rooms_db import MIGRATION, MigrationError, initialize
from services.rooms import JoinLimiter, RoomsError, RoomsService, digest

UNIT_URL = 'postgresql+psycopg://agrovoz_salas_app:unit-test-only@127.0.0.1:1/agrovoz_pc3'


class UnitRoomsTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {'DATABASE_URL': UNIT_URL, 'AGROVOZ_ROOMS_TEST_MODE': '0'})
        env.start()
        self.addCleanup(env.stop)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def test_seven_exact_contracts(self):
        paths = app.openapi()['paths']
        actual = {(method.upper(), path) for path, operations in paths.items() if path.startswith('/api/rooms')
                  for method in operations if method in ('get', 'post')}
        self.assertEqual(actual, {
            ('POST', '/api/rooms/participants'), ('POST', '/api/rooms'), ('GET', '/api/rooms'),
            ('POST', '/api/rooms/join'), ('POST', '/api/rooms/{room_id}/invitations'),
            ('POST', '/api/rooms/{room_id}/alerts'), ('GET', '/api/rooms/{room_id}/alerts')})

    def test_invalid_payload_and_no_store_without_database_connection(self):
        for body in ({}, {'display_name': '   '}, {'display_name': 'x' * 51},
                     {'display_name': 'Ana\x00'}, {'display_name': 'Ana', 'id': str(uuid4())}):
            with self.subTest(body=body):
                response = self.client.post('/api/rooms/participants', json=body)
                self.assertEqual(response.status_code, 422)
                self.assertEqual(response.headers['cache-control'], 'no-store')

    def test_missing_or_forged_bearer_is_401_not_client_id_auth(self):
        for headers in ({}, {'X-User-Id': 'ana'}, {'Authorization': f'Bearer {uuid4()}'}, {'Authorization': 'Basic ignored'}):
            response = self.client.get('/api/rooms', headers=headers)
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.headers['www-authenticate'], 'Bearer')
            self.assertEqual(response.headers['cache-control'], 'no-store')

    def test_absent_database_configuration_503_and_health_independent(self):
        with patch.dict(os.environ, {'DATABASE_URL': ''}):
            response = self.client.post('/api/rooms/participants', json={'display_name': 'Ana'})
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.json()['detail']['code'], 'rooms_not_configured')
            self.assertEqual(self.client.get('/health').status_code, 200)

    def test_inaccessible_database_is_sanitized_503(self):
        response = self.client.post('/api/rooms/participants', json={'display_name': 'Ana'})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('unit-test-only', response.text)
        self.assertNotIn('INSERT', response.text)
        self.assertNotIn('psycopg', response.text)

    def test_dedicated_role_target_and_secret_safe_config(self):
        for url in (UNIT_URL.replace('agrovoz_salas_app', 'postgres'), UNIT_URL.replace('agrovoz_pc3', 'another_project'),
                    UNIT_URL.replace('postgresql+psycopg', 'sqlite'), UNIT_URL + '?password=hidden'):
            with self.subTest(url=url), self.assertRaises(RoomsConfigError) as caught:
                validate_url(url, test=False)
            self.assertNotIn('unit-test-only', str(caught.exception))
        with patch.dict(os.environ, {'AGROVOZ_ROOMS_TEST_MODE': '1', 'TEST_DATABASE_URL': '', 'ALLOW_TEST_DB_WRITE': '1'}):
            with self.assertRaises(RoomsConfigError):
                RoomsConfig.load()  # No fallback a DATABASE_URL.
        self.assertNotIn('unit-test-only', repr(RoomsConfig(validate_url(UNIT_URL, test=False))))

    def test_commit_failure_does_not_return_success(self):
        class BrokenSession:
            @contextmanager
            def begin(self):
                yield
                raise OperationalError('private SQL', {}, Exception('private password'))
        with self.assertRaises(HTTPException) as caught:
            operation(BrokenSession(), lambda service: {'success': True})
        self.assertEqual(caught.exception.status_code, 503)
        self.assertNotIn('private', str(caught.exception.detail))

    def test_authorization_header_preflight_compatible_with_pc2(self):
        response = self.client.options('/api/rooms', headers={'Origin': 'http://localhost:8080',
            'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['access-control-allow-origin'], 'http://localhost:8080')


@unittest.skipUnless(os.getenv('TEST_DATABASE_URL') and os.getenv('ALLOW_TEST_DB_WRITE') == '1',
                     'PostgreSQL aislado no configurado: no se usa DATABASE_URL real')
class PostgresRoomsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = RoomsConfig.load()
        if not cls.config.test:
            raise RuntimeError('Estos tests solo permiten modo prueba')
        cls.engine = engine_for(cls.config)
        cls.migration_url = validate_url(os.environ['TEST_MIGRATION_DATABASE_URL'], test=True, migration=True)
        cls.migrator = create_engine(cls.migration_url, hide_parameters=True)
        with cls.engine.connect() as connection:
            db, role, superuser = connection.execute(text(
                'SELECT current_database(),current_user,rolsuper FROM pg_roles WHERE rolname=current_user')).one()
            if (db, role, superuser) != ('agrovoz_pc3_test', 'agrovoz_salas_test', False):
                raise RuntimeError('Destino de tests inseguro')

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()
        cls.migrator.dispose()

    def setUp(self):
        limiter = JoinLimiter()
        app.dependency_overrides[limiter_dependency] = lambda: limiter
        self.addCleanup(lambda: app.dependency_overrides.pop(limiter_dependency, None))
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.a, self.b, self.c = [self.register(name) for name in ('A', 'B', 'C')]

    def register(self, name):
        response = self.client.post('/api/rooms/participants', json={'display_name': f'Fixture-{name}-{uuid4().hex[:8]}'})
        self.assertEqual(response.status_code, 201)
        return response.json()

    def headers(self, participant):
        return {'Authorization': 'Bearer ' + participant['access_token']}

    def create(self, actor=None, request_id=None):
        body = {'name': 'Sala de prueba', 'crop': 'papa', 'client_request_id': str(request_id or uuid4())}
        response = self.client.post('/api/rooms', headers=self.headers(actor or self.a), json=body)
        self.assertEqual(response.status_code, 201)
        return response.json(), body

    def join(self, room, actor=None):
        return self.client.post('/api/rooms/join', headers=self.headers(actor or self.b), json={'join_code': room['join_code']})

    def publish(self, room, *, actor=None, body=None):
        return self.client.post(f"/api/rooms/{room['room']['id']}/alerts", headers=self.headers(actor or self.a),
                               json=body or {'crop': 'papa', 'text': 'Manchas en tres plantas desde ayer.', 'client_request_id': str(uuid4())})

    def test_create_atomic_owner_and_repeatable_request(self):
        room, body = self.create()
        replay = self.client.post('/api/rooms', headers=self.headers(self.a), json=body)
        self.assertEqual(replay.status_code, 200)
        self.assertTrue(replay.json()['replayed'])
        self.assertIsNone(replay.json()['join_code'])
        self.assertEqual(replay.json()['room']['id'], room['room']['id'])
        body['name'] = 'Otro nombre'
        self.assertEqual(self.client.post('/api/rooms', headers=self.headers(self.a), json=body).status_code, 409)
        with Session(self.engine) as db:
            record = db.get(Room, room['room']['id'])
            owner = db.get(Membership, (record.id, record.created_by))
            self.assertEqual(owner.role, 'owner')

    def test_invalid_alerts_and_fields_are_422(self):
        room, _ = self.create()
        for changes in ({'text': 'corta'}, {'crop': 'unknown'}, {'owner': self.c['participant']['id']},
                        {'author_id': self.c['participant']['id']}, {'photo': 'data:private'}, {'text': '\x00' * 12}):
            body = {'crop': 'papa', 'text': 'Observación de doce caracteres.', 'client_request_id': str(uuid4()), **changes}
            self.assertEqual(self.publish(room, body=body).status_code, 422)

    def test_join_second_user_and_membership_unique(self):
        room, _ = self.create()
        first, second = self.join(room), self.join(room)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.json()['already_member'])
        self.assertEqual(second.json()['room']['member_count'], 2)
        with Session(self.engine) as db:
            count = db.scalar(select(func.count()).select_from(Membership).where(Membership.room_id == room['room']['id']))
            self.assertEqual(count, 2)

    def test_member_publishes_and_another_member_reads_after_reconnect(self):
        room, _ = self.create()
        self.assertEqual(self.join(room).status_code, 201)
        published = self.publish(room)
        self.assertEqual(published.status_code, 201)
        self.engine.dispose()  # Fuerza nuevas conexiones, no reinicia ni borra datos.
        with TestClient(app) as independent:
            response = independent.get(f"/api/rooms/{room['room']['id']}/alerts", headers=self.headers(self.b))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['items'], [published.json()['alert']])
        self.assertEqual(response.headers['cache-control'], 'no-store')

    def test_non_members_cannot_read_publish_or_rotate(self):
        room, _ = self.create()
        route = f"/api/rooms/{room['room']['id']}"
        self.assertEqual(self.client.get(route + '/alerts', headers=self.headers(self.c)).status_code, 403)
        self.assertEqual(self.publish(room, actor=self.c).status_code, 403)
        self.join(room)
        self.assertEqual(self.client.post(route + '/invitations', headers=self.headers(self.b)).status_code, 403)

    def test_room_and_invitation_not_found(self):
        self.assertEqual(self.client.get(f'/api/rooms/{uuid4()}/alerts', headers=self.headers(self.a)).status_code, 404)
        self.assertEqual(self.join({'join_code': 'A' * 12}).status_code, 404)

    def test_invitation_rotation_invalidates_old_code_not_members(self):
        room, _ = self.create()
        self.join(room)
        response = self.client.post(f"/api/rooms/{room['room']['id']}/invitations", headers=self.headers(self.a))
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.json()['join_code'], room['join_code'])
        self.assertEqual(self.join(room, self.c).status_code, 404)
        room['join_code'] = response.json()['join_code']
        self.assertEqual(self.join(room, self.c).status_code, 201)
        self.assertEqual(self.client.get(f"/api/rooms/{room['room']['id']}/alerts", headers=self.headers(self.b)).status_code, 200)

    def test_idempotency_payload_conflict_and_stable_pagination(self):
        room, _ = self.create()
        body = {'crop': 'papa', 'text': 'Observé manchas en tres plantas.', 'client_request_id': str(uuid4())}
        first = self.publish(room, body=body)
        replay = self.publish(room, body=body)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(replay.status_code, 200)
        self.assertEqual(first.json()['alert'], replay.json()['alert'])
        self.assertEqual(self.publish(room, body={**body, 'text': 'Otro texto válido de prueba.'}).status_code, 409)
        for _ in range(2):
            self.assertEqual(self.publish(room).status_code, 201)
        route = f"/api/rooms/{room['room']['id']}/alerts"
        ids, cursor = [], '0'
        for expected in ('1', '2', '3'):
            page = self.client.get(route, headers=self.headers(self.a), params={'after_sequence': cursor, 'limit': 1}).json()
            self.assertEqual(page['items'][0]['sequence'], expected)
            cursor = page['next_after']
            ids.extend(item['id'] for item in page['items'])
        self.assertEqual(len(set(ids)), 3)
        empty = self.client.get(route, headers=self.headers(self.a), params={'after_sequence': cursor}).json()
        self.assertEqual(empty, {'items': [], 'next_after': '3', 'has_more': False})

    def test_concurrent_same_request_one_row_and_distinct_requests_ordered(self):
        room, _ = self.create()
        body = {'crop': 'papa', 'text': 'Alerta concurrente de prueba.', 'client_request_id': str(uuid4())}
        with ThreadPoolExecutor(max_workers=3) as pool:
            responses = list(pool.map(lambda _: self.publish(room, body=body), range(3)))
        self.assertEqual(sorted(response.status_code for response in responses), [200, 200, 201])
        self.assertEqual(len({response.json()['alert']['id'] for response in responses}), 1)
        with ThreadPoolExecutor(max_workers=3) as pool:
            responses = list(pool.map(lambda _: self.publish(room), range(3)))
        self.assertTrue(all(response.status_code == 201 for response in responses))
        page = self.client.get(f"/api/rooms/{room['room']['id']}/alerts", headers=self.headers(self.a)).json()
        self.assertEqual([item['sequence'] for item in page['items']], ['1', '2', '3', '4'])

    def test_concurrent_creation_and_join_do_not_duplicate(self):
        body = {'name': 'Concurrente', 'client_request_id': str(uuid4())}
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda _: self.client.post('/api/rooms', headers=self.headers(self.a), json=body), range(2)))
        self.assertEqual(sorted(response.status_code for response in responses), [200, 201])
        room = next(response.json() for response in responses if response.status_code == 201)
        with ThreadPoolExecutor(max_workers=2) as pool:
            joined = list(pool.map(lambda _: self.join(room), range(2)))
        self.assertEqual(sorted(response.status_code for response in joined), [200, 201])
        self.assertTrue(all(response.json()['room']['member_count'] == 2 for response in joined))

    def test_tokens_are_hashed_expired_and_revoked_sessions_rejected(self):
        actor_id = self.a['participant']['id']
        with self.migrator.begin() as connection:
            value = connection.execute(text('SELECT token_hash FROM salas.participants WHERE id=:id'), {'id': actor_id}).scalar_one()
            self.assertEqual(value, digest(self.a['access_token']))
            connection.execute(text('UPDATE salas.participants SET revoked_at=CURRENT_TIMESTAMP WHERE id=:id'), {'id': actor_id})
        self.assertEqual(self.client.get('/api/rooms', headers=self.headers(self.a)).status_code, 401)
        with self.migrator.begin() as connection:
            connection.execute(text("UPDATE salas.participants SET created_at=CURRENT_TIMESTAMP-INTERVAL '2 days', token_expires_at=CURRENT_TIMESTAMP-INTERVAL '1 day' WHERE id=:id"), {'id': self.b['participant']['id']})
        self.assertEqual(self.client.get('/api/rooms', headers=self.headers(self.b)).status_code, 401)

    def test_lists_only_own_rooms_and_limits_are_validated(self):
        room, _ = self.create()
        self.assertEqual(self.client.get('/api/rooms', headers=self.headers(self.b)).json()['items'], [])
        self.join(room)
        self.assertEqual(len(self.client.get('/api/rooms', headers=self.headers(self.b)).json()['items']), 1)
        for query in ('limit=0', 'limit=101', 'after_sequence=-1', 'after_sequence=9223372036854775808'):
            response = self.client.get(f"/api/rooms/{room['room']['id']}/alerts?{query}", headers=self.headers(self.a))
            self.assertEqual(response.status_code, 422)

    def test_database_constraints_and_runtime_cannot_ddl_or_delete(self):
        room, _ = self.create()
        with self.assertRaises(IntegrityError), Session(self.engine) as db, db.begin():
            db.add(Alert(room_id=room['room']['id'], author_id=self.c['participant']['id'], client_request_id=uuid4(),
                         sequence=1, crop='papa', text='Texto que no debe insertarse.'))
            db.flush()
        with self.engine.connect() as connection:
            ddl, deletion = connection.execute(text("SELECT has_schema_privilege(current_user,'salas','CREATE'), has_table_privilege(current_user,'salas.alerts','DELETE')")).one()
            self.assertFalse(ddl)
            self.assertFalse(deletion)
        with self.assertRaises(IntegrityError), Session(self.engine) as db, db.begin():
            db.add(Membership(room_id=room['room']['id'], participant_id=self.b['participant']['id'], role='invalid'))
            db.flush()

    def test_rollback_sequence_and_waiting_writer_do_not_lose_alerts(self):
        room, _ = self.create()
        route = f"/api/rooms/{room['room']['id']}/alerts"
        holder = Session(self.engine)
        holder.begin()
        service = RoomsService(holder)
        actor = service.actor(self.a['access_token'])
        service.publish(actor, room['room']['id'], AlertCreate(crop='papa', text='Se revertirá esta observación.', client_request_id=uuid4()))
        with ThreadPoolExecutor(max_workers=1) as pool:
            waiting = pool.submit(self.publish, room)
            time.sleep(.1)
            self.assertFalse(waiting.done())
            holder.rollback()
            holder.close()
            response = waiting.result(timeout=5)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['alert']['sequence'], '1')
        page = self.client.get(route, headers=self.headers(self.a)).json()
        self.assertEqual(page['items'], [response.json()['alert']])

    def test_reader_cursor_does_not_skip_pending_commit(self):
        room, _ = self.create()
        holder = Session(self.engine)
        holder.begin()
        service = RoomsService(holder)
        first = service.publish(service.actor(self.a['access_token']), room['room']['id'],
                                AlertCreate(crop='papa', text='Primera alerta aún pendiente.', client_request_id=uuid4()))
        route = f"/api/rooms/{room['room']['id']}/alerts"
        with ThreadPoolExecutor(max_workers=1) as pool:
            waiting = pool.submit(self.publish, room)
            try:
                page = self.client.get(route, headers=self.headers(self.a)).json()
                self.assertEqual(page, {'items': [], 'next_after': '0', 'has_more': False})
                self.assertFalse(waiting.done())
                holder.commit()
                self.assertEqual(waiting.result(timeout=5).status_code, 201)
            finally:
                holder.close()
        page = self.client.get(route, headers=self.headers(self.a)).json()
        self.assertEqual([item['sequence'] for item in page['items']], ['1', '2'])
        self.assertEqual(page['items'][0]['id'], str(first.alert.id))

    def test_migration_repeated_and_unknown_schema_changes_rejected(self):
        outcome = initialize(self.migration_url, test=True, apply=True)
        self.assertEqual(outcome['status'], 'already_applied')
        self.assertFalse(outcome['changed'])
        # Cambio solo dentro de transacción de prueba que se revierte automáticamente.
        with self.migrator.connect() as connection:
            transaction = connection.begin()
            try:
                connection.exec_driver_sql('ALTER TABLE salas.alerts ADD COLUMN fixture_drift integer')
                from scripts.init_rooms_db import MANIFEST, schema_signature
                self.assertNotEqual(schema_signature(connection), json.loads(MANIFEST.read_text())['signature'])
            finally:
                transaction.rollback()

    def test_join_rate_limit(self):
        for _ in range(10):
            self.assertEqual(self.join({'join_code': 'A' * 12}).status_code, 404)
        response = self.join({'join_code': 'A' * 12})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers['retry-after'], '60')


if __name__ == '__main__':
    unittest.main(verbosity=2)
