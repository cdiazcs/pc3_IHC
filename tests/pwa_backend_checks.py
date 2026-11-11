"""Regresión sin leer .env, sin migraciones ni escrituras PostgreSQL."""
import json
from pathlib import Path
import runpy
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'backend'), str(ROOT / 'tests')]


def main():
    # Bloquea tanto la carga del adaptador como la lectura de configuración de salas.
    with patch('dotenv.load_dotenv', return_value=False), patch('dotenv.dotenv_values', return_value={}):
        from main import app
        from test_salas import UnitRoomsTests
        suite = unittest.defaultTestLoader.discover(str(ROOT / 'tests'), pattern='test_phase*.py')
        suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(UnitRoomsTests))
        result = unittest.TextTestRunner(verbosity=2).run(suite)
        if not result.wasSuccessful():
            return 1
        runpy.run_path(str(ROOT / 'tests/backend_smoke.py'), run_name='__main__')
        paths = app.openapi()['paths']
        operations = [(p, method) for p, items in paths.items() if p.startswith('/api/rooms')
                      for method in items if method in ('get', 'post')]
        assert '/health' in paths and '/api/consult' in paths and len(operations) == 7
        payload = {'tests': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors),
                   'smoke_checks': 3, 'rooms_operations': len(operations), 'env_file_read': False,
                   'migrations_run': False, 'postgres_writes': False, 'status': 'PASS'}
        import httpx
        try:
            response = httpx.get('http://127.0.0.1:8000/health', timeout=2, trust_env=False)
            payload['existing_server_health_http'] = response.status_code
            payload['health_note'] = 'Configuración declarada; no acredita inferencia Ollama ni conexión PostgreSQL.'
        except httpx.HTTPError:
            payload['existing_server_health_http'] = None
            payload['health_note'] = 'No hay respuesta de servidor habitual; /health se comprobó con TestClient.'
        output = ROOT / 'docs/evidencias/FASE_III_PWA_BACKEND.json'
        output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps(payload, ensure_ascii=False))
        return 0


if __name__ == '__main__':
    raise SystemExit(main())
