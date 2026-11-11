"""Verificación de cierre: catálogo y API real SOLO LECTURA en agrovoz_pc3.

No registra sesiones, salas ni alertas. Uvicorn temporal propio con conexiones
SQLAlchemy forzadas a default_transaction_read_only=on. No usa el puerto 8000.
"""
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import time
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from rooms_config import read_setting, validate_url
from scripts.init_rooms_db import MANIFEST, MIGRATION, schema_signature

ROOT = Path(__file__).resolve().parents[2]
TABLES = ('participants', 'rooms', 'memberships', 'alerts')


def inventory():
    url = validate_url(read_setting('MIGRATION_DATABASE_URL'), test=False, migration=True)
    engine = create_engine(url, hide_parameters=True, connect_args={'connect_timeout': 3,
        'options': '-c default_transaction_read_only=on -c statement_timeout=3000 -c timezone=UTC'})
    try:
        with engine.connect() as connection:
            assert connection.scalar(text('SELECT current_database()')) == 'agrovoz_pc3'
            signature = schema_signature(connection)
            assert signature == json.loads(MANIFEST.read_text())['signature']
            version, checksum, applied_at = connection.execute(text(
                'SELECT version,checksum,applied_at FROM salas.schema_migrations')).one()
            assert version == '001' and checksum == hashlib.sha256(MIGRATION.read_bytes()).hexdigest()
            counts = {table: connection.scalar(text('SELECT count(*) FROM salas.' + table)) for table in TABLES}
            return {'database': 'agrovoz_pc3', 'current_user': url.username, 'signature_matches': True,
                    'version': version, 'checksum': checksum, 'applied_at': applied_at.isoformat(),
                    'functional_row_counts': counts, 'relations': signature['relations'],
                    'constraint_count': len(signature['constraints']), 'index_count': len(signature['indexes']),
                    'columns_count': len(signature['columns'])}
    finally:
        engine.dispose()


def verify_api():
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    source = '''
from main import app
from db.session import engine_for
from rooms_config import RoomsConfig
from sqlalchemy import event
import uvicorn,sys
engine=engine_for(RoomsConfig.load())
@event.listens_for(engine,'connect')
def readonly(connection,record):
    with connection.cursor() as cursor:
        cursor.execute('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY')
    connection.commit()
    with connection.cursor() as cursor:
        cursor.execute('SHOW default_transaction_read_only')
        assert cursor.fetchone()[0]=='on'
    connection.rollback()
uvicorn.run(app,host='127.0.0.1',port=int(sys.argv[1]),access_log=False,log_level='error')
'''
    # Solo el proceso propio cambia su modo. .env/roles/servidores del usuario intactos.
    process = subprocess.Popen([sys.executable, '-c', source, str(port)], cwd=ROOT / 'backend',
                               env={**os.environ, 'AGROVOZ_ROOMS_TEST_MODE': '0'},
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        with httpx.Client(base_url=f'http://127.0.0.1:{port}', timeout=5, trust_env=False) as client:
            for _ in range(100):
                try:
                    health = client.get('/health')
                    break
                except httpx.ConnectError:
                    if process.poll() is not None:
                        raise RuntimeError('La API de lectura no inició')
                    time.sleep(.1)
            else:
                raise RuntimeError('La API de lectura no respondió')
            assert health.status_code == 200
            anonymous = client.get('/api/rooms')
            assert anonymous.status_code == 401
            # Formato válido, pero sin crear participante. Para decidir 401 el servicio
            # consulta token_hash en PostgreSQL; si no tiene acceso devolvería 503.
            token = secrets.token_urlsafe(32)
            unknown = client.get('/api/rooms', headers={'Authorization': 'Bearer ' + token})
            assert unknown.status_code == 401
            assert unknown.json()['detail']['code'] == 'demo_session_required'
            assert unknown.headers['cache-control'] == 'no-store'
            return {'health_http': 200, 'anonymous_http': 401, 'database_lookup_unknown_session_http': 401,
                    'database_error_503': False, 'sql_connections_forced_read_only': True,
                    'requests': ['GET /health', 'GET /api/rooms (sin token)', 'GET /api/rooms (token desconocido)'],
                    'post_requests': 0, 'temporary_api_process': True}
    finally:
        process.terminate()
        process.wait(timeout=10)


def main():
    try:
        before = inventory()
        api = verify_api()
        after = inventory()
        assert before['functional_row_counts'] == after['functional_row_counts']
        evidence = {'executed_at': datetime.now(ZoneInfo('America/Lima')).isoformat(), 'status': 'PASS',
                    'inventory': after, 'api': api, 'row_counts_before': before['functional_row_counts'],
                    'row_counts_after': after['functional_row_counts'], 'inserted_test_rows': 0,
                    'backup': 'no requerido: evidencia PRE confirma salas inexistente antes de migrar'}
        output = ROOT / 'docs' / 'evidencias' / 'SALAS_FASE_II_MAIN_VERIFICATION.json'
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps(evidence, ensure_ascii=False, indent=2))
    except (AssertionError, SQLAlchemyError, ValueError, RuntimeError, httpx.HTTPError):
        print('La verificación de lectura no se completó. No se insertaron datos de prueba; revisar permisos y esquema.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
