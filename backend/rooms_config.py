"""Configuración exclusiva de salas. No muta entorno ni configura el LLM."""
from dataclasses import dataclass, field
import os
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy.engine import URL, make_url


class RoomsConfigError(ValueError):
    pass


def read_setting(name: str) -> str:
    if name in os.environ:
        return os.environ[name].strip()
    return (dotenv_values(Path(__file__).with_name('.env')).get(name) or '').strip()


def validate_url(raw: str, *, test: bool, migration: bool = False) -> URL:
    if not raw:
        raise RoomsConfigError('Falta configurar la conexión PostgreSQL de salas.')
    try:
        url = make_url(raw)
        expected_db = 'agrovoz_pc3_test' if test else 'agrovoz_pc3'
        expected_role = ('agrovoz_salas_test_migrator' if migration else 'agrovoz_salas_test') if test else (
            'agrovoz_salas_migrator' if migration else 'agrovoz_salas_app')
        if url.drivername != 'postgresql+psycopg' or url.database != expected_db or url.username != expected_role:
            raise ValueError('Destino/rol no permitido')
        if test and url.host not in ('127.0.0.1', 'localhost'):
            raise ValueError('Pruebas solo locales')
        if url.query:
            raise ValueError('Parámetros de conexión deben configurarse en el módulo')
        if not url.host or (url.port is not None and not 1 <= url.port <= 65535):
            raise ValueError('Host/puerto inválido')
        if not url.password or url.password == 'REEMPLAZAR_LOCALMENTE':
            raise ValueError('Credencial no configurada')
        return url
    except Exception as ex:
        raise RoomsConfigError('URL de salas inválida: revisa driver, base, rol y credencial dedicada.') from ex


def test_write_allowed() -> bool:
    return os.getenv('ALLOW_TEST_DB_WRITE') == '1'


@dataclass(frozen=True)
class RoomsConfig:
    url: URL = field(repr=False)
    test: bool = False

    @classmethod
    def load(cls):
        test = os.getenv('AGROVOZ_ROOMS_TEST_MODE') == '1'
        if test:
            if not test_write_allowed():
                raise RoomsConfigError('Las pruebas requieren ALLOW_TEST_DB_WRITE=1.')
            raw = os.getenv('TEST_DATABASE_URL', '')  # Nunca fallback a .env o DATABASE_URL.
        else:
            raw = read_setting('DATABASE_URL')
        return cls(validate_url(raw, test=test), test)
