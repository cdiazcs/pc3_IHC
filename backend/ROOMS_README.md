# Backend de salas — Maurizio

Implementa los siete contratos `/api/rooms` de `docs/POSTGRES_DISENO.md`.
Router real: `routers/salas.py` (nombre solicitado en Fase II); no hay rutas duplicadas.
El frontend PC2 sigue siendo demo. No requiere Ollama para usar salas.

Desde la raíz:

```bash
backend/.venv/bin/python -m pip install -r backend/requirements.txt
# Comprobación de lectura; DATABASE_URL y MIGRATION_DATABASE_URL se configuran localmente.
backend/.venv/bin/python backend/scripts/check_rooms_db.py
# Inspección de migración, sin cambios.
backend/.venv/bin/python backend/scripts/init_rooms_db.py
# Solo después de autorización explícita para el esquema agrovoz_pc3:
# backend/.venv/bin/python backend/scripts/init_rooms_db.py --apply
backend/.venv/bin/python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Pruebas sin credenciales de producción, en un PostgreSQL 18 privado bajo `/tmp`:

```bash
backend/.venv/bin/python tests/run_salas_checks.py
# Alternativa: solo flujo HTTP real con dos procesos API sucesivos.
backend/.venv/bin/python tests/salas_http_flow.py
```

No ejecutan DROP ni contactan el servidor PostgreSQL del usuario. El helper crea
solo la base de aplicación `agrovoz_pc3_test` y roles de prueba en su cluster propio;
se detiene al terminar. Credenciales efímeras privadas, no registradas en evidencias.
Requiere binarios locales `/usr/lib/postgresql/18/bin/{initdb,pg_ctl}` y no root.
Sin ese entorno, configurar una base de prueba según el informe, no usar producción.

Detalle de instalación, permisos, ejemplos, evidencias y pendientes:
[FASE_II_SALAS_IMPLEMENTACION.md](../docs/FASE_II_SALAS_IMPLEMENTACION.md).
