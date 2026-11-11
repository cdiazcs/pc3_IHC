"""Comprobación estrictamente de lectura de agrovoz_pc3, sin revelar DSN ni secretos."""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from rooms_config import RoomsConfigError, read_setting, validate_url


def check_role(name, *, migration):
    try:
        url = validate_url(read_setting(name), test=False, migration=migration)
    except RoomsConfigError:
        return {'setting': name, 'status': 'blocked', 'reason': 'configuración ausente o inválida'}
    engine = create_engine(url, hide_parameters=True, connect_args={'connect_timeout': 3,
        'options': '-c default_transaction_read_only=on -c statement_timeout=3000 -c timezone=UTC'})
    try:
        with engine.connect() as connection:
            db, role, superuser, createdb, createrole = connection.execute(text(
                'SELECT current_database(),current_user,rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).one()
            if db != 'agrovoz_pc3' or role != url.username or superuser or createdb or createrole:
                return {'setting': name, 'status': 'blocked', 'reason': 'destino o privilegios administrativos no permitidos'}
            exists = connection.scalar(text("SELECT to_regnamespace('salas') IS NOT NULL"))
            result = {'setting': name, 'status': 'connected_read_only', 'database': db, 'role': role,
                      'schema_exists': exists, 'can_create_schema': connection.scalar(text(
                          'SELECT has_database_privilege(current_user,current_database(),\'CREATE\')'))}
            if exists:
                result['can_use_schema'] = connection.scalar(text("SELECT has_schema_privilege(current_user,'salas','USAGE')"))
                result['can_create_in_schema'] = connection.scalar(text("SELECT has_schema_privilege(current_user,'salas','CREATE')"))
                tables = {}
                for table in ('participants', 'rooms', 'memberships', 'alerts'):
                    target = 'salas.' + table
                    if connection.scalar(text('SELECT to_regclass(:table) IS NOT NULL'), {'table': target}):
                        tables[table] = {privilege: connection.scalar(text(
                            'SELECT has_table_privilege(current_user,:table,:privilege)'), {'table': target, 'privilege': privilege})
                            for privilege in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')}
                    else:
                        tables[table] = None
                result['table_privileges'] = tables
            return result
    except SQLAlchemyError:
        return {'setting': name, 'status': 'blocked', 'reason': 'no se pudo conectar o comprobar permisos; revisar localmente'}
    finally:
        engine.dispose()


def main():
    results = [check_role('DATABASE_URL', migration=False), check_role('MIGRATION_DATABASE_URL', migration=True)]
    print(json.dumps({'checks': results, 'writes': False}, ensure_ascii=False, indent=2))
    return 0 if all(item['status'] == 'connected_read_only' for item in results) else 1


if __name__ == '__main__':
    raise SystemExit(main())
