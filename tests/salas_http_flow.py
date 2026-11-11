"""Dos clientes HTTP reales y reinicio API; PostgreSQL de prueba privado.

No acepta URL arbitraria: no puede apuntar accidentalmente a agrovoz_pc3.
"""
from contextlib import contextmanager
from datetime import datetime
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from uuid import uuid4
from unittest.mock import patch
from zoneinfo import ZoneInfo

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'backend'), str(ROOT / 'tests')]
from rooms_test_postgres import grant_runtime, isolated_postgres
from rooms_config import validate_url
from scripts.init_rooms_db import initialize


@contextmanager
def serve_api(settings):
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'main:app', '--app-dir', str(ROOT / 'backend'),
                                '--host', '127.0.0.1', '--port', str(port), '--no-access-log'],
                               env={**os.environ, **settings}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f'http://127.0.0.1:{port}'
    try:
        with httpx.Client(base_url=base, timeout=1, trust_env=False) as probe:
            for _ in range(150):
                try:
                    if probe.get('/health').status_code == 200:
                        break
                except httpx.ConnectError:
                    if process.poll() is not None:
                        raise RuntimeError('FastAPI temporal no pudo iniciar')
                time.sleep(.1)
            else:
                raise RuntimeError('FastAPI temporal no respondió')
        yield base
    finally:
        process.terminate()
        process.wait(timeout=10)


def run_http_flow(settings):
    trace = []

    def request(client, method, route, expected, **kwargs):
        response = client.request(method, route, **kwargs)
        trace.append({'method': method, 'path': route, 'expected': expected, 'actual': response.status_code})
        assert response.status_code == expected, f'{method} {route}: {response.status_code}'
        assert response.headers.get('cache-control') == 'no-store'
        return response.json()

    def headers(participant):
        return {'Authorization': 'Bearer ' + participant['access_token']}

    with serve_api(settings) as base, httpx.Client(base_url=base, timeout=10, trust_env=False) as a, \
            httpx.Client(base_url=base, timeout=10, trust_env=False) as b, \
            httpx.Client(base_url=base, timeout=10, trust_env=False) as c:
        participants = [request(client, 'POST', '/api/rooms/participants', 201, json={'display_name': name})
                        for client, name in ((a, 'Agricultor A'), (b, 'Agricultor B'), (c, 'No miembro C'))]
        pa, pb, pc = participants
        room = request(a, 'POST', '/api/rooms', 201, headers=headers(pa),
                       json={'name': 'Flujo HTTP aislado', 'crop': 'papa', 'client_request_id': str(uuid4())})
        request(b, 'POST', '/api/rooms/join', 201, headers=headers(pb), json={'join_code': room['join_code']})
        listed = request(b, 'GET', '/api/rooms', 200, headers=headers(pb))
        assert [item['id'] for item in listed['items']] == [room['room']['id']]
        route = f"/api/rooms/{room['room']['id']}/alerts"
        body = {'crop': 'papa', 'text': 'Observé manchas en tres plantas desde ayer.', 'client_request_id': str(uuid4())}
        published = request(a, 'POST', route, 201, headers=headers(pa), json=body)
        initial = request(b, 'GET', route, 200, headers=headers(pb))
        assert initial['items'] == [published['alert']]
    # Todos los clientes/pools HTTP y el primer proceso API ya están cerrados.
    with serve_api(settings) as base, httpx.Client(base_url=base, timeout=10, trust_env=False) as a, \
            httpx.Client(base_url=base, timeout=10, trust_env=False) as b, \
            httpx.Client(base_url=base, timeout=10, trust_env=False) as c:
        persisted = request(b, 'GET', route, 200, headers=headers(pb))
        assert persisted['items'] == [published['alert']]
        replay = request(a, 'POST', route, 200, headers=headers(pa), json=body)
        assert replay['alert'] == published['alert'] and replay['replayed'] is True
        request(c, 'GET', route, 403, headers=headers(pc))
        request(c, 'POST', route, 403, headers=headers(pc), json={**body, 'client_request_id': str(uuid4())})
        request(c, 'GET', route, 401)
        request(b, 'POST', f"/api/rooms/{room['room']['id']}/invitations", 403, headers=headers(pb))
        request(a, 'POST', f"/api/rooms/{room['room']['id']}/invitations", 200, headers=headers(pa))
        final = request(b, 'GET', route, 200, headers=headers(pb))
        assert len(final['items']) == 1
    evidence = {'executed_at': datetime.now(ZoneInfo('America/Lima')).isoformat(), 'status': 'PASS',
                'database': 'agrovoz_pc3_test', 'transport': 'clientes httpx independientes -> Uvicorn real -> PostgreSQL real',
                'api_process_restarted': True, 'client_connections_recreated': True,
                'participant_a': pa['participant']['id'], 'participant_b': pb['participant']['id'],
                'room_id': room['room']['id'], 'alert_id': published['alert']['id'],
                'persisted_alert_count': 1, 'tokens_and_invitation_codes': 'omitidos', 'requests': trace}
    output = ROOT / 'docs' / 'evidencias' / 'SALAS_FASE_II_HTTP.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
    print('PASS HTTP real: A crea/publica; B lee tras reiniciar API; C rechazado; una alerta persistida.', flush=True)
    return evidence


def main():
    with isolated_postgres() as settings, patch.dict(os.environ, settings):
        url = validate_url(settings['TEST_MIGRATION_DATABASE_URL'], test=True, migration=True)
        initialize(url, test=True, apply=True)
        grant_runtime(url)
        run_http_flow(settings)


if __name__ == '__main__':
    main()
