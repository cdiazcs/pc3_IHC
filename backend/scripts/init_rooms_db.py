"""Migración versionada y explícita; nunca se invoca al iniciar FastAPI."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from rooms_config import RoomsConfigError, read_setting, test_write_allowed, validate_url

MIGRATION = Path(__file__).resolve().parents[1] / 'migrations' / 'rooms' / '001_initial.sql'
MANIFEST = MIGRATION.with_name('001_schema_manifest.json')
VERSION = '001'
LOCK_KEY = 861320451


class MigrationError(ValueError):
    pass


def schema_signature(connection):
    """Catálogo estructural, sin datos, propietarios, ACL, hashes de sesión ni contraseñas."""
    queries = {
        'columns': """SELECT c.relname, a.attname, format_type(a.atttypid,a.atttypmod), a.attnotnull,
                       pg_get_expr(d.adbin,d.adrelid), a.attidentity
                       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                       JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
                       LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
                       WHERE n.nspname='salas' AND c.relkind='r' ORDER BY c.relname,a.attnum""",
        'constraints': """SELECT c.relname, k.conname, k.contype, pg_get_constraintdef(k.oid), k.convalidated
                           FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
                           JOIN pg_namespace n ON n.oid=c.relnamespace
                           WHERE n.nspname='salas' ORDER BY c.relname,k.conname""",
        'indexes': """SELECT t.relname, c.relname, pg_get_indexdef(i.indexrelid), i.indisvalid
                       FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
                       JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace
                       WHERE n.nspname='salas' ORDER BY t.relname,c.relname""",
        'relations': """SELECT c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c
                         JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='salas' ORDER BY c.relname""",
        'triggers': """SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) FROM pg_trigger t
                        JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
                        WHERE n.nspname='salas' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname""",
        'functions': """SELECT p.proname,pg_get_function_identity_arguments(p.oid) FROM pg_proc p
                         JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='salas'
                         ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)""",
    }
    return {name: [list(row) for row in connection.execute(text(query)).all()] for name, query in queries.items()}


def verify_target(connection, url, *, test):
    actual_db, actual_user, superuser, createdb, createrole = connection.execute(text(
        "SELECT current_database(),current_user,rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user"
    )).one()
    if actual_db != url.database or actual_user != url.username or superuser or createdb or createrole:
        raise MigrationError('Destino o privilegios no permitidos. Utiliza el migrator dedicado sin privilegios administrativos.')
    if test and (actual_db != 'agrovoz_pc3_test' or not test_write_allowed()):
        raise MigrationError('Se requiere base de pruebas exacta y autorización de escritura de pruebas.')


def initialize(url, *, test=False, apply=False):
    """apply=False solo lectura. apply=True requiere autorización externa para base real."""
    raw = MIGRATION.read_bytes()
    checksum = hashlib.sha256(raw).hexdigest()
    expected = json.loads(MANIFEST.read_text())
    if expected['migration_sha256'] != checksum:
        raise MigrationError('La migración y su manifiesto no coinciden; no modificar una versión aplicada.')
    engine = create_engine(url, hide_parameters=True, connect_args={'connect_timeout': 3,
                           'options': '-c timezone=UTC -c statement_timeout=10000 -c lock_timeout=3000'})
    try:
        with engine.begin() as connection:
            verify_target(connection, url, test=test)
            if apply:
                connection.execute(text('SELECT pg_advisory_xact_lock(:key)'), {'key': LOCK_KEY})
            schema = connection.scalar(text("SELECT to_regnamespace('salas') IS NOT NULL"))
            if schema:
                owners = connection.execute(text("SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='salas' UNION SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='salas'")).scalars().all()
                if any(owner != url.username for owner in owners):
                    raise MigrationError('Objetos de otro propietario: no adoptar ni modificar este esquema.')
                if schema_signature(connection) != expected['signature']:
                    raise MigrationError('Esquema existente incompatible: detener y revisar, sin borrar ni adoptar objetos.')
                rows = connection.execute(text('SELECT version,checksum FROM salas.schema_migrations ORDER BY version')).all()
                if rows != [(VERSION, checksum)]:
                    raise MigrationError('Historial/checksum incompatible con la migración 001.')
                return {'database': url.database, 'version': VERSION, 'status': 'already_applied', 'changed': False}
            if not apply:
                return {'database': url.database, 'version': VERSION, 'status': 'pending', 'changed': False}
            # psycopg soporta SQL fijo sin parámetros en simple query; transacción externa única.
            connection.exec_driver_sql(raw.decode(), execution_options={'no_parameters': True})
            if schema_signature(connection) != expected['signature']:
                raise MigrationError('La estructura creada no coincide con el manifiesto; rollback automático.')
            connection.execute(text('INSERT INTO salas.schema_migrations(version,checksum) VALUES (:version,:checksum)'),
                               {'version': VERSION, 'checksum': checksum})
            return {'database': url.database, 'version': VERSION, 'status': 'applied', 'changed': True}
    finally:
        engine.dispose()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--test', action='store_true', help='Solo agrovoz_pc3_test y TEST_MIGRATION_DATABASE_URL exportada')
    parser.add_argument('--apply', action='store_true', help='Aplicar DDL. En agrovoz_pc3 requiere autorización previa del responsable.')
    args = parser.parse_args()
    try:
        if args.test:
            if not test_write_allowed():
                raise RoomsConfigError('Falta ALLOW_TEST_DB_WRITE=1; nunca se usará DATABASE_URL como alternativa.')
            raw = os.getenv('TEST_MIGRATION_DATABASE_URL', '')
        else:
            raw = read_setting('MIGRATION_DATABASE_URL')
        url = validate_url(raw, test=args.test, migration=True)
        print(json.dumps(initialize(url, test=args.test, apply=args.apply), ensure_ascii=False))
    except (RoomsConfigError, MigrationError) as error:
        print(str(error), file=sys.stderr)
        return 1
    except (SQLAlchemyError, OSError, ValueError):
        print('No se pudo comprobar/aplicar la migración. Revisa conexión, permisos y manifiesto sin compartir credenciales.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
