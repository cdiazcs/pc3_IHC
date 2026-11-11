"""Engine diferido, sesiones por petición y errores sin DSN/SQL expuestos."""
from functools import lru_cache

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

from rooms_config import RoomsConfig, RoomsConfigError


@lru_cache(maxsize=4)
def engine_for(config: RoomsConfig):
    engine = create_engine(config.url, pool_size=2, max_overflow=1, pool_timeout=3,
                         pool_pre_ping=True, hide_parameters=True,
                         connect_args={'connect_timeout': 3,
                                       'options': '-c timezone=UTC -c statement_timeout=3000 -c lock_timeout=1000'})
    @event.listens_for(engine, 'connect')
    def validate_connected_role(connection, record):
        with connection.cursor() as cursor:
            cursor.execute('SELECT current_database(),current_user,rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')
            database, role, superuser, createdb, createrole = cursor.fetchone()
        connection.rollback()
        if database != config.url.database or role != config.url.username or superuser or createdb or createrole:
            raise RoomsConfigError('El rol runtime de salas no puede tener privilegios administrativos.')
    return engine


def new_session(config: RoomsConfig):
    return Session(engine_for(config), expire_on_commit=False)
