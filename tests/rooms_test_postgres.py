"""PostgreSQL REAL temporal para pruebas: no contacta el cluster del usuario.

Crea SOLO agrovoz_pc3_test en un cluster privado bajo /tmp y puerto libre.
Genera contraseñas efímeras y nunca las imprime. Detiene solo su propio cluster.
"""
from contextlib import contextmanager
import os
from pathlib import Path
import secrets
import socket
import subprocess
import tempfile

import psycopg
from psycopg import sql
from sqlalchemy.engine import URL


@contextmanager
def isolated_postgres():
    binary = Path('/usr/lib/postgresql/18/bin')
    if not (binary / 'initdb').exists():
        raise RuntimeError('No se encontró PostgreSQL 18 local para el cluster aislado.')
    root = Path(tempfile.mkdtemp(prefix='agrovoz-pg-test-'))
    root.chmod(0o700)
    data, log = root / 'data', root / 'server.log'
    admin_password = secrets.token_urlsafe(32)
    pwfile = root / 'admin-password'
    pwfile.write_text(admin_password + '\n')
    pwfile.chmod(0o600)
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    subprocess.run([str(binary / 'initdb'), '-D', str(data), '-U', 'agrovoz_test_admin', '-A', 'scram-sha-256',
                    '--pwfile', str(pwfile), '--no-locale', '--encoding=UTF8'], check=True, stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL)
    started = False
    try:
        subprocess.run([str(binary / 'pg_ctl'), '-D', str(data), '-l', str(log), '-o',
                        f'-h 127.0.0.1 -p {port} -k {root} -c log_min_error_statement=panic', '-w', 'start'],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        started = True
        passwords = {role: secrets.token_urlsafe(32) for role in ('agrovoz_salas_test', 'agrovoz_salas_test_migrator')}
        with psycopg.connect(host='127.0.0.1', port=port, user='agrovoz_test_admin', password=admin_password,
                             dbname='postgres', autocommit=True) as connection:
            for role, password in passwords.items():
                connection.execute(sql.SQL('CREATE ROLE {} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD {}').format(
                    sql.Identifier(role), sql.Literal(password)))
            connection.execute('CREATE DATABASE agrovoz_pc3_test OWNER agrovoz_salas_test_migrator')
            connection.execute('REVOKE ALL ON DATABASE agrovoz_pc3_test FROM PUBLIC')
            connection.execute('GRANT CONNECT ON DATABASE agrovoz_pc3_test TO agrovoz_salas_test')
        def url(role):
            return URL.create('postgresql+psycopg', username=role, password=passwords[role],
                              host='127.0.0.1', port=port, database='agrovoz_pc3_test')
        settings = {'TEST_DATABASE_URL': url('agrovoz_salas_test').render_as_string(hide_password=False),
                    'TEST_MIGRATION_DATABASE_URL': url('agrovoz_salas_test_migrator').render_as_string(hide_password=False),
                    'ALLOW_TEST_DB_WRITE': '1', 'AGROVOZ_ROOMS_TEST_MODE': '1'}
        yield settings
    finally:
        if started:
            subprocess.run([str(binary / 'pg_ctl'), '-D', str(data), '-m', 'fast', '-w', 'stop'],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # Artefactos privados conservados en /tmp para diagnóstico; sin borrar archivos del usuario.


def grant_runtime(url):
    from sqlalchemy import create_engine
    engine = create_engine(url, hide_parameters=True)
    try:
        with engine.begin() as connection:
            connection.exec_driver_sql('GRANT USAGE ON SCHEMA salas TO agrovoz_salas_test')
            for table in ('participants', 'rooms', 'memberships', 'alerts'):
                connection.exec_driver_sql(f'GRANT SELECT, INSERT, UPDATE ON salas.{table} TO agrovoz_salas_test')
    finally:
        engine.dispose()
