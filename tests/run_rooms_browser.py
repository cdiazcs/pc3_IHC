"""Chrome + FastAPI + PostgreSQL de prueba propios. No escribe en agrovoz_pc3."""
from datetime import datetime
import json
import os
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'backend'), str(ROOT / 'tests')]
from sqlalchemy import create_engine, text
from rooms_test_postgres import grant_runtime, isolated_postgres
from rooms_config import validate_url
from scripts.init_rooms_db import initialize
from salas_http_flow import serve_api


def main():
    with isolated_postgres() as settings, patch.dict(os.environ, settings):
        migration = validate_url(settings['TEST_MIGRATION_DATABASE_URL'], test=True, migration=True)
        initialize(migration, test=True, apply=True)
        grant_runtime(migration)
        with serve_api(settings) as base:
            # El navegador no recibe credenciales DB; solo su dirección API temporal.
            environment = {key: value for key, value in os.environ.items() if 'DATABASE_URL' not in key and 'LLM_API_KEY' not in key}
            environment.update(AGROVOZ_ROOMS_TEST_API=base, AGROVOZ_ROOMS_BROWSER_ISOLATED='1')
            outcome = subprocess.run(['node', str(ROOT / 'tests/rooms-browser.cjs')], cwd=ROOT, env=environment, check=False)
        engine = create_engine(migration, hide_parameters=True)
        try:
            with engine.connect() as connection:
                assert connection.scalar(text('SELECT current_database()')) == 'agrovoz_pc3_test'
                counts = {name: connection.scalar(text('SELECT count(*) FROM salas.' + name))
                          for name in ('participants', 'rooms', 'memberships', 'alerts')}
        finally:
            engine.dispose()
        payload = {'executed_at': datetime.now(ZoneInfo('America/Lima')).isoformat(), 'database': 'agrovoz_pc3_test',
                   'isolated_cluster': True, 'row_counts': counts,
                   'status': 'PASS' if outcome.returncode == 0 and counts == {'participants': 4, 'rooms': 1, 'memberships': 2, 'alerts': 2} else 'FAIL'}
        path = ROOT / 'docs/evidencias/SALAS_FASE_III_POSTGRES.json'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps(payload, ensure_ascii=False), flush=True)
        return 0 if payload['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
