"""Prueba conjunta: Ollama local y salas PostgreSQL temporal bajo la misma API."""
import json
import os
from datetime import datetime
from pathlib import Path
import sys
import time
from unittest.mock import patch
from zoneinfo import ZoneInfo
import uuid

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'backend'), str(ROOT / 'tests')]
from rooms_test_postgres import isolated_postgres, grant_runtime
from rooms_config import validate_url
from scripts.init_rooms_db import initialize
from salas_http_flow import serve_api


def main():
    report = {'executed_at': datetime.now(ZoneInfo('America/Lima')).isoformat(),
              'database': 'agrovoz_pc3_test', 'isolated_cluster': True,
              'llm': 'Ollama local / llama3.2:1b', 'status': 'FAIL'}
    try:
        with isolated_postgres() as settings:
            settings.update(AGROVOZ_LLM_BASE_URL='http://127.0.0.1:11434/v1',
                            AGROVOZ_MODEL='llama3.2:1b', AGROVOZ_LLM_API_KEY='', AGROVOZ_LLM_TIMEOUT_SECONDS='120')
            with patch.dict(os.environ, settings):
                migration = validate_url(settings['TEST_MIGRATION_DATABASE_URL'], test=True, migration=True)
                initialize(migration, test=True, apply=True)
                grant_runtime(migration)
                with serve_api(settings) as base, httpx.Client(base_url=base, timeout=130, trust_env=False) as client:
                    spec = client.get('/openapi.json').json()
                    operations = [(p, m) for p, methods in spec['paths'].items() if p.startswith('/api/rooms') for m in methods if m in ('get', 'post')]
                    assert len(operations) == 7
                    assert client.get('/health').status_code == 200
                    def post(path, body, headers=None):
                        response = client.post(path, json=body, headers=headers)
                        response.raise_for_status()
                        return response.json()
                    a = post('/api/rooms/participants', {'display_name': 'Integración A'})
                    b = post('/api/rooms/participants', {'display_name': 'Integración B'})
                    ah = {'Authorization': 'Bearer ' + a['access_token']}
                    bh = {'Authorization': 'Bearer ' + b['access_token']}
                    room = post('/api/rooms', {'name': 'Integración PC3', 'crop': 'papa', 'client_request_id': str(uuid.uuid4())}, ah)
                    rid = room['room']['id']
                    post('/api/rooms/join', {'join_code': room['join_code']}, bh)
                    alert = post(f'/api/rooms/{rid}/alerts', {'crop': 'papa', 'text': 'Observación compartida para comprobar integración.', 'client_request_id': str(uuid.uuid4())}, ah)
                    started = time.perf_counter()
                    result = client.post('/api/consult', json={'crop': 'papa', 'question': 'Veo hojas amarillas. ¿Qué puedo observar sin aplicar tratamientos?'})
                    report['consult_http'] = result.status_code
                    report['consult_seconds'] = round(time.perf_counter() - started, 3)
                    result.raise_for_status()
                    advice = result.json()
                    assert set(advice) == {'headline', 'observation', 'steps', 'source', 'limitations', 'provider'}
                    assert advice['provider'] == 'llama3.2:1b'
                    assert advice['observation'] and isinstance(advice['steps'], list)
                    feed = client.get(f'/api/rooms/{rid}/alerts', headers=bh)
                    feed.raise_for_status()
                    assert feed.json()['items'][0]['id'] == alert['alert']['id']
                    report.update(status='PASS', rooms_operations=7, health_http=200,
                                  alert_read_http=feed.status_code, same_server=True, advice=advice)
    except Exception as exc:
        report['error_type'] = type(exc).__name__
        raise
    finally:
        output = ROOT / 'docs/evidencias/FASE_IV_CONJUNTA.json'
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({key: value for key, value in report.items() if key != 'advice'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
