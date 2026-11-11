"""Ejecuta tests contra PostgreSQL REAL privado, sin base de producción ni credenciales externas."""
from datetime import datetime
from zoneinfo import ZoneInfo
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'backend'), str(ROOT / 'tests')]

from rooms_test_postgres import grant_runtime, isolated_postgres
from rooms_config import validate_url
from scripts.init_rooms_db import initialize


def main():
    with isolated_postgres() as settings, patch.dict(os.environ, settings):
        migration_url = validate_url(settings['TEST_MIGRATION_DATABASE_URL'], test=True, migration=True)
        first = initialize(migration_url, test=True, apply=True)
        second = initialize(migration_url, test=True, apply=True)
        grant_runtime(migration_url)
        suite = unittest.defaultTestLoader.discover(str(ROOT / 'tests'), pattern='test_salas.py')
        result = unittest.TextTestRunner(verbosity=2).run(suite)
        evidence = {'executed_at': datetime.now(ZoneInfo('America/Lima')).isoformat(), 'database': 'agrovoz_pc3_test', 'postgres': 'cluster privado temporal en /tmp, sin servidor compartido',
                    'migrations': [first, second], 'tests_run': result.testsRun,
                    'failures': len(result.failures), 'errors': len(result.errors), 'skipped': len(result.skipped),
                    'status': 'PASS' if result.wasSuccessful() else 'FAIL'}
        output = ROOT / 'docs' / 'evidencias' / 'SALAS_FASE_II_TESTS.json'
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps(evidence, ensure_ascii=False), flush=True)
        if not result.wasSuccessful():
            return 1
        from salas_http_flow import run_http_flow
        run_http_flow(settings)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
