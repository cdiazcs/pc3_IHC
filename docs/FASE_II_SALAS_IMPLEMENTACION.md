# Fase II Salas — backend PostgreSQL multiusuario

Responsable: Maurizio. Fecha de trabajo: 11/11/2026, America/Lima.
Rama: `feature/salas-comunidad`. Diseño base: [POSTGRES_DISENO.md](POSTGRES_DISENO.md)
y [FASE_I_SALAS_AUDITORIA.md](FASE_I_SALAS_AUDITORIA.md), conservados sin reemplazarlos.

## 1. Resumen y estado de despliegue

Se implementaron los siete contratos `/api/rooms` con FastAPI, SQLAlchemy 2.x y
PostgreSQL. La persistencia, autorización, idempotencia y concurrencia se probaron
en **PostgreSQL 18 real aislado**; no se sustituyó por SQLite ni por mocks. Dos
clientes HTTP independientes compartieron una alerta y B la recuperó después de
cerrar clientes y reiniciar el proceso FastAPI. C, no miembro, fue rechazado.

Cierre autorizado del 11/11/2026: ambas URLs locales conectan a `agrovoz_pc3`
(PostgreSQL 18.6), con `agrovoz_salas_app` y `agrovoz_salas_migrator` respectivamente.
Se verificaron rol conectado, base y privilegios efectivos sin mostrar credenciales.
El esquema `salas` no existía antes: no había objetos ni datos que respaldar.
Tras revisar el SQL y su checksum, se aplicó 001 con la autorización condicional
del usuario. Se detectó falta de permisos de acceso del app, se detuvieron los
cambios y el usuario autorizó separadamente los GRANT mínimos; se aplicaron y
verificaron. No se insertaron participantes, salas, membresías ni alertas de prueba
en la base principal. La fila de versión es metadato de la migración autorizada.

**Cumplimiento actual: 12/12 = 100%. FASE II APROBADA en su alcance backend.**
No significa 70% global PC3, autenticación de producción ni colaboración ya
integrada en la interfaz. La demostración de escritura A→B continúa confinada a
PostgreSQL de prueba; en la base principal la API se verificó solo por lectura.

## 2. Contratos implementados frente a diseño

| Método / ruta | Resultado implementado | Evidencia |
|---|---|---|
| POST /api/rooms/participants | 201, participante, token demo solo una vez, expiry 24 h | alta en tests y clientes A/B/C reales |
| POST /api/rooms | 201 sala+owner; replay 200, mismo ID y código null; conflicto de payload 409 | tests de creación, carrera y API HTTP |
| GET /api/rooms | solo salas propias, limit/offset y member_count | tests de aislamiento y cliente B |
| POST /api/rooms/join | 201, replay 200 sin membresía duplicada; código inválido 404, límite 429 | tests secuenciales/concurrentes y cliente B |
| POST /api/rooms/{room_id}/invitations | 200 solo owner/creador; invalida código previo sin expulsar miembros | tests y flujo HTTP; B obtiene 403 |
| POST /api/rooms/{room_id}/alerts | 201; replay idéntico 200; cuerpo diferente con misma clave 409 | tests y flujo HTTP con una sola fila |
| GET /api/rooms/{room_id}/alerts | feed ascendente, limit/next_after/has_more; secuencias string | tests de cursor, commits concurrentes y cliente B |

Ajuste mínimo documentado: el diseño nombraba `routers/rooms.py`; la solicitud de
esta fase pide `routers/salas.py`. Se implementó **salas.py**, manteniendo rutas,
campos y códigos públicos. No se crearon aliases ni un octavo endpoint.

Entrada Pydantic estricta (`extra='forbid'`), longitudes y cultivos del diseño;
se rechazan NUL/controles no admitidos. Normalización de trim y código uppercase.
422 para validación, 401 para credencial inválida, 403 para no miembro/no owner,
404 para sala/invitación ausente, 409 para idempotencia incompatible, 429 para
unión excesiva y 503 para configuración/DB no disponible. Errores inesperados
se responden sin excepciones, DSN ni SQL. Respuestas y errores del módulo llevan
Cache-Control: no-store; 401 incluye WWW-Authenticate: Bearer.

No se alteró el formato de `/health` ni `/api/consult`. Las mejoras LLM de su rama
no se importaron. Autor, propietario, timestamps y secuencia no se aceptan como
campos elegidos por el cliente. El texto se transporta como texto JSON: frontend
futuro deberá usar textContent/esc(), no interpretar HTML.

## 3. Archivos y separación de responsabilidades

```text
backend/
  rooms_config.py                   # solo configuración de salas, sin mutar entorno LLM
  db/{__init__,base,session,models_rooms}.py
  schemas/{__init__,rooms}.py        # contratos Pydantic de entrada/salida
  services/rooms.py                 # dominio y transacciones, sin FastAPI
  routers/salas.py                  # adaptador HTTP, errores, dependencias
  migrations/rooms/001_initial.sql
  migrations/rooms/001_schema_manifest.json
  scripts/init_rooms_db.py          # check/apply explícitos; sin startup DDL
  scripts/check_rooms_db.py         # solo lectura, sin DSN/contraseñas
  ROOMS_README.md
  main.py                          # import/include_router y cabecera CORS
  requirements.txt
  .env.example
 tests/
  test_salas.py                     # unitarios + integración real condicional
  rooms_test_postgres.py            # cluster privado de pruebas y roles limitados
  run_salas_checks.py               # migración + suite + flujo HTTP
  salas_http_flow.py                # clientes HTTP y reinicio API
```

main.py cambia solo en la importación del router, include_router y permitir
Authorization en CORS, manteniendo Content-Type y los orígenes locales anteriores.
El router usa rutas síncronas para DB; una Session por petición, sin compartirla
entre hilos. El dominio devuelve modelos concretos antes de cerrar la sesión.
El commit ocurre **antes de devolver la respuesta**, no en la limpieza tardía de
una dependencia yield: si falla commit no se entrega un 201 falso.

Engine diferido, pool pequeño, timeout de conexión/pool y de consultas/bloqueos.
Al conectar se comprueban base, rol y ausencia de flags superuser/createdb/createrole.
No se conecta ni ejecuta DDL al importar main.py. Sin DATABASE_URL, solo salas
queda no disponible; health y el adaptador LLM siguen operativos según sus reglas.

## 4. Integridad, credenciales y concurrencia

Entidades físicas exactas: salas.participants, rooms, memberships, alerts; más la
tabla técnica schema_migrations. UUID del servidor; tokens/códigos solo en hash
SHA-256; nombres repetibles. Membresía PK compuesta y owner único por índice
parcial. Alertas con FK compuesto a membresía, UNIQUE(room,sequence) y
UNIQUE(room,author,client_request_id). No UNIQUE al texto.

Crear sala inserta owner en la misma transacción; ON CONFLICT resuelve reintento
concurrente y compara payload normalizado. Las uniones no duplican filas. Unión,
rotación y publicación adquieren lock de la sala y revalidan datos después de
esperar. Solo creador con membresía owner puede rotar códigos.

Secuencia por sala incrementada **bajo lock hasta commit**; rollback revierte
contador y alerta. No se usa BIGSERIAL global como cursor. Lecturas devuelven
cursor del último elemento entregado, nunca el contador global ni la fila extra.
Los tests comprobaron bloqueo de escritor, lectura durante commit pendiente,
rollback y orden final sin saltos ni duplicados.

Token demo opaco del servidor, vencimiento 24 h, hash único, comprobación de
revocación/expiración en cada operación. UUID/selector local no autentica. No es
verificación de identidad personal, login de producción ni protección frente a
robo del token. Credenciales nunca se incluyen en URL/respuestas de error/evidencia.
Límite de uniones 10/minuto por participante Y origen, memoria acotada y lock de
hilo, válido para demo de **un worker**. Múltiples procesos necesitarían limitador
compartido/proxy y controles adicionales de abuso; el alta de sesiones no tiene
protección de abuso de producción.

## 5. Dependencias efectivas

Añadidas a requirements sin reemplazar las tres anteriores:

```text
SQLAlchemy>=2.0,<3
psycopg[binary]>=3,<4
python-dotenv>=1,<2
```

Instaladas en backend/.venv: SQLAlchemy **2.1.8**, psycopg **3.3.8** y
psycopg-binary **3.3.8**; python-dotenv **1.2.4** ya estaba disponible. Se mantuvieron
FastAPI 0.162.4, Uvicorn 0.54.0 y httpx 0.28.1, con Python 3.14.4.
SQLAlchemy 2.1 es parte de 2.x y respeta el rango acordado; no se afirma haber
probado todas las versiones admitidas. `pip check`: sin dependencias rotas.
No se añadió pytest, otro ORM ni servicio externo: se usa unittest existente.

La primera instalación no pudo resolver PyPI desde sandbox; se repitió autorizada
fuera de él y finalizó. No es un error de compatibilidad de los paquetes.

## 6. Configuración y provisión local sin secretos

`.env.example` conserva sus líneas LLM y añade DATABASE_URL, MIGRATION_DATABASE_URL
y ejemplos TEST_*, solo con marcador `REEMPLAZAR_LOCALMENTE`. El archivo `.env`
del usuario **no se modifica**. `dotenv_values` lee únicamente las variables del
módulo sin introducirlas en os.environ; variables exportadas prevalecen. Test mode
solo admite TEST_DATABASE_URL exportada y bandera explícita, sin fallback a real.

Roles esperados de aplicación local:

- agrovoz_salas_app: runtime sin superuser/createdb/createrole, sin CREATE en salas ni DELETE.
- agrovoz_salas_migrator: dueño de schema salas, sin flags administrativos.

Base exacta: agrovoz_pc3. No usar postgres ni otro proyecto como aplicación.
Para integración externa de tests: agrovoz_pc3_test y los roles
agrovoz_salas_test / agrovoz_salas_test_migrator. Pruebas autogestionadas generan
esos nombres y contraseñas efímeras solo en su cluster privado.

### Instrucciones de provisión (CREATE ROLE no ejecutado por el agente)

Antes de crear roles, comprobar si existen y su uso/privilegios. No alterar un rol
que pertenezca a otro proyecto. Conectar explícitamente a agrovoz_pc3 desde pgAdmin
o psql administrativo. Si los roles **no existen**, crear:

```sql
CREATE ROLE agrovoz_salas_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE agrovoz_salas_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT CONNECT, CREATE ON DATABASE agrovoz_pc3 TO agrovoz_salas_migrator;
GRANT CONNECT ON DATABASE agrovoz_pc3 TO agrovoz_salas_app;
```

Fijar contraseñas propias con diálogo seguro de pgAdmin o `\password` de psql,
nunca con contraseñas reales en scripts, historial o capturas. Revisar privilegios
heredados de PUBLIC en **esta base** antes de restringirlos; no cambiar roles o
bases ajenas. El runtime no debe poder crear en public ni tener privilegios globales.
No se crean ni se borran bases con el init del módulo.

Después de autorización y migración, conectado como migrator a agrovoz_pc3:

```sql
GRANT USAGE ON SCHEMA salas TO agrovoz_salas_app;
GRANT SELECT, INSERT, UPDATE ON salas.participants, salas.rooms, salas.memberships, salas.alerts TO agrovoz_salas_app;
```

No GRANT sobre schema_migrations ni DELETE/CREATE al runtime. No hay secuencias
SERIAL que requieran permisos extra. Si hay privilegios anteriores excesivos,
revisarlos antes de usarlos; estos GRANT por sí solos no los revocan.

URLs locales, con contraseña propia codificada correctamente, se guardan solo en
backend/.env. No pegarlas en el chat. El código exige los nombres/roles previstos,
rechaza query parameters y el marcador de ejemplo, y nunca muestra DSN completa.

### Verificar y arrancar

Servidor de PostgreSQL respondió en 5432; no se reinició ni se cambió su configuración
del sistema. Solo se aplicaron el esquema 001 y los GRANT expresamente autorizados.
Si estuviera detenido y corresponde al cluster de este proyecto, el administrador
puede comprobar su estado y arrancarlo con los servicios de Ubuntu:

```bash
pg_isready -h 127.0.0.1 -p 5432
# Solo si corresponde y está detenido: sudo systemctl start postgresql
backend/.venv/bin/python backend/scripts/check_rooms_db.py
# Sin --apply solo inspecciona; no ejecuta DDL.
backend/.venv/bin/python backend/scripts/init_rooms_db.py
# Solo después de autorización explícita para modificar schema en agrovoz_pc3:
# backend/.venv/bin/python backend/scripts/init_rooms_db.py --apply
backend/.venv/bin/python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000
```

No detener servidores/puertos del usuario para hacer pruebas; los scripts usan
puertos temporales propios. `/docs` muestra los siete contratos una vez iniciado.

## 7. Migración 001: aplicada y verificada en base principal

DDL versionado y manifiesto de catálogo. El manifiesto se obtuvo del DDL en una
transacción de PostgreSQL 18 privado que se revirtió, sin adoptar estructura ajena.
Antes de la entrega se normalizó whitespace del SQL; checksum/manifiesto actuales
se verifican juntos. La versión entregada se aplicó posteriormente a agrovoz_pc3
tras la revisión y autorización descritas en el cierre, sin editar el SQL aplicado.

El script exige URL/rol/destino adecuados, comprueba usuario conectado y flags de
privilegio, y verifica propietario si el schema ya existe. `--apply` toma lock
asesor, crea solo schema salas/tablas en transacción y registra versión/checksum.
Si ya está aplicado: verifica catálogo y checksum y no modifica nada. Si encuentra
objetos, estructura, propietario o historial incompatibles: **se detiene**, sin
borrar ni adoptar. No se ejecuta create_all al arrancar FastAPI.

Manifiesto verifica columnas/tipos/nullability/defaults, restricciones, índices,
relaciones/RLS, triggers y funciones del schema. No incluye datos, contraseñas,
propietarios ni ACL; estos últimos se controlan aparte. Las representaciones de
catálogo de versiones PG distintas pueden necesitar revisión manual: se probó PG18,
no se fuerza aceptación de una estructura que difiera silenciosamente.

Estado: **001 aplicada y repetida sin cambios solo en agrovoz_pc3_test privado**.
**001 aplicada con autorización en agrovoz_pc3**. La comprobación posterior devuelve
`already_applied`, `changed=false`; no hay migraciones pendientes de este módulo.
No existe downgrade destructivo automático.

### Rollback y recuperación

- Antes de commit, cualquier fallo revierte toda la transacción de inicialización.
- Tras commit no borrar schema ni tablas para volver a una versión anterior.
  Deshabilitar temporalmente el módulo, conservar datos y preparar una nueva
  migración de corrección revisada (roll-forward).
- Antes de evolucionar una instalación con datos, el responsable debe guardar
  backup de schema/datos de salas en archivo privado fuera del repo y probar su
  restauración por separado. Ejemplo de backup manual con contraseña interactiva:

```bash
# No ejecutado por esta auditoría; usar destino privado con permisos restrictivos.
pg_dump --host=127.0.0.1 --username=agrovoz_salas_migrator --dbname=agrovoz_pc3 --schema=salas --format=custom --file=/ruta/privada/agrovoz_salas.dump
# Inspección del backup, sin restaurar ni borrar:
pg_restore --list /ruta/privada/agrovoz_salas.dump
```

No usar --clean, DROP TABLE, DROP DATABASE ni TRUNCATE como recuperación automática.
Una restauración/cambio posterior de datos reales requiere revisión/autorización
separada; no se realizó en esta fase.

## 8. Pruebas ejecutadas y comandos

```bash
backend/.venv/bin/python -m pip install -r backend/requirements.txt
backend/.venv/bin/python -m pip check
backend/.venv/bin/python tests/run_salas_checks.py
# Repetición independiente del flujo real, si se necesita:
backend/.venv/bin/python tests/salas_http_flow.py
# Unitarios: con entorno sin TEST_DATABASE_URL los casos PG quedan SKIP explícito.
backend/.venv/bin/python tests/test_salas.py
backend/.venv/bin/python tests/backend_smoke.py
node tests/smoke.test.cjs
node --check AgroVoz-App/app.js
# Compilar solo fuentes del módulo; no recorrer .venv.
backend/.venv/bin/python -m py_compile backend/rooms_config.py backend/db/session.py backend/db/models_rooms.py backend/services/rooms.py backend/routers/salas.py backend/scripts/init_rooms_db.py
git diff --check
```

Los scripts de prueba real requieren PostgreSQL 18 local (`initdb`/`pg_ctl`), usuario
no root y permiso para abrir sockets. Crean un directorio privado 0700 en `/tmp`,
un cluster y puertos propios, solo la base de aplicación agrovoz_pc3_test, roles
limitados y contraseñas aleatorias no mostradas. Se detiene **solo ese cluster** al
salir; archivos privados temporales quedan para diagnóstico. No se utilizan ni
modifican las bases del servidor compartido. No hay DROP ni limpieza global de
fixtures: cada prueba crea sus propias filas UUID y el cluster es exclusivo.

### Resultados reales

| Verificación | Resultado |
|---|---|
| pruebas de salas | **25 aprobadas**, 0 fallos, 0 errores, 0 omitidas: 8 unitarias + 17 PG reales |
| migración privada | primera applied, segunda already_applied y changed=false |
| integridad y permisos | FK, CHECK, autor no miembro, owner único y runtime sin DDL/DELETE probados |
| concurrencia | misma creación/unión/publicación no duplica; secuencias ordenadas; cursor durante commit y rollback probados |
| tokens y privacidad | hash almacenado, vencimiento/revocación, 401/403, no-store y errores sin secreto probados |
| flujo HTTP real | A crea/publica; B se une/lee; reinicio del proceso API y nuevos clientes mantienen una alerta; C rechazado |
| pruebas PC2 | 3 comprobaciones backend y 8 frontend; resultados finales abajo |
| calidad básica | sintaxis, dependencias y diff sin problemas; revisar alcance indicado |

Los tests de API con TestClient usan PostgreSQL real en los 17 casos de integración,
pero no son tráfico de red HTTP real. La evidencia HTTP independiente está en su
script separado con Uvicorn. Los mocks se usan solo en casos unitarios específicos
(por ejemplo commit fallido); no acreditan persistencia por sí mismos.

El test DB no se toma de DATABASE_URL. Sin TEST_DATABASE_URL/flag explícitas, los
casos PG de test_salas.py se omiten con motivo; no se presentan como aprobados.
Hay un aviso de deprecación TestClient/httpx sin fallo de prueba.

## 9. Evidencia de cierre en base principal y flujo A → sala → alerta → B

### Base principal: migración y lectura, sin datos de prueba

- [Estado previo, roles y esquema inexistente](evidencias/SALAS_FASE_II_MAIN_PRE.json).
- [Permisos antes/después de los GRANT autorizados](evidencias/SALAS_FASE_II_MAIN_PRIVILEGES.json).
- [Catálogo, versión, API y conteos de filas](evidencias/SALAS_FASE_II_MAIN_VERIFICATION.json).

La revisión de 001 comprobó ocho sentencias CREATE, exclusivamente schema/tablas/
índices de salas. No hay DROP, TRUNCATE, modificaciones de filas existentes ni
objetos de otros schemas. `ON DELETE RESTRICT` define integridad: no es una orden
de borrado. No se cambió el contenido ni checksum de la versión aplicada.

Como salas no existía antes, no correspondía backup lógico de objetos previos;
esto quedó registrado antes de ejecutar DDL. No se utilizó ese motivo para omitir
un respaldo de datos existentes: no había objetos en ese schema.

El catálogo posterior coincide exactamente con el manifiesto: **5 tablas** (cuatro
funcionales y schema_migrations), **30 columnas y 12 índices**, además de 54 entradas
de restricciones del catálogo PostgreSQL 18, que incluyen las de NOT NULL. Versión
001 registrada; comprobación repetida sin cambios. Timestamp aplicado en Perú:
11/11/2026 02:36:28, según applied_at del servidor (07:36:28 UTC).

El rol app tiene USAGE del schema y SELECT/INSERT/UPDATE en participants, rooms,
memberships y alerts. No tiene CREATE en salas, DELETE, TRUNCATE, REFERENCES,
TRIGGER ni MAINTAIN en esas tablas. En schema_migrations no tiene permisos de tabla
ni SELECT/INSERT/UPDATE/REFERENCES por columna. Ambos roles carecen de flags
superuser/createdb/createrole. TEMP aparece como privilegio efectivo heredado de la
base; no se revocó PUBLIC ni se alteraron privilegios ajenos a lo autorizado. No
confiere CREATE de objetos persistentes en salas ni acceso a schema_migrations.

Tras encontrar el permiso insuficiente de app se pidió y obtuvo autorización
separada. Solo se ejecutaron:

```sql
GRANT USAGE ON SCHEMA salas TO agrovoz_salas_app;
GRANT SELECT, INSERT, UPDATE ON salas.participants, salas.rooms, salas.memberships, salas.alerts TO agrovoz_salas_app;
```

Nuevo script reproducible de lectura:

```bash
backend/.venv/bin/python backend/scripts/verify_rooms_main.py
```

Ese script inicia un Uvicorn propio en puerto libre, fuerza cada conexión SQL a
solo lectura y verifica el ajuste en PostgreSQL. GET /health devuelve 200;
GET /api/rooms sin token devuelve 401; con token de formato válido pero no
registrado también devuelve 401 `demo_session_required`, después de consultar
participants. Esto acredita acceso de lectura de la API, no una sesión real creada.
Un fallo de acceso habría producido 503. No se enviaron POST.

Los conteos antes/después de la API son **0/0/0/0**, sin cambios en las cuatro
tablas funcionales. No se insertaron fixtures en agrovoz_pc3. Las pruebas de
escritura se ejecutaron únicamente en el cluster privado agrovoz_pc3_test.

### Flujo de escritura en PostgreSQL aislado

- [Suite y estado de migraciones aisladas](evidencias/SALAS_FASE_II_TESTS.json).
- [Clientes HTTP independientes y reinicio API](evidencias/SALAS_FASE_II_HTTP.json).

El JSON HTTP registra métodos, rutas y estados reales; UUID de participantes,
sala y alerta de prueba; count=1 al final, API reiniciada y conexiones recreadas.
**No contiene tokens, contraseñas ni códigos de invitación**. La secuencia real:

1. A, B y C reciben sesiones demo independientes mediante tres clientes HTTP.
2. A crea sala con owner; B se une con código y lista esa sala.
3. A publica; B obtiene exactamente la alerta creada, con mismo UUID/texto/fecha.
4. Se cierran los tres clientes y termina el primer Uvicorn temporal.
5. Nuevo proceso Uvicorn y nuevos clientes: B vuelve a obtener la misma alerta.
6. A reintenta misma publicación: 200/replayed, una fila, sin duplicados.
7. C no miembro obtiene 403 al leer/publicar; sin token recibe 401. B no puede
   rotar invitación; A sí. B sigue leyendo la única alerta persistida.

Esta es colaboración **HTTP/backend**, no una demostración de la interfaz de
Comunidad PC2. No se usó localStorage ni cambio de perfil como prueba multiusuario.
No se produjeron capturas de frontend ni se afirmó colaboración UI funcionando.

## 10. Ejemplos curl con datos de prueba

Solo ejecutar sobre un backend que use **agrovoz_pc3_test**, con
TEST_DATABASE_URL exportada y permisos de prueba preparados. Nunca copiar estas
pruebas sobre una base de producción con datos. Los comandos siguientes no fueron
la evidencia ejecutada: esa evidencia es el script HTTP anterior.

```bash
# Arranque manual de API de prueba (usa TEST_DATABASE_URL, no DATABASE_URL):
AGROVOZ_ROOMS_TEST_MODE=1 ALLOW_TEST_DB_WRITE=1 backend/.venv/bin/python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8010
```

En otra terminal, guardar las respuestas de alta en archivos privados porque
incluyen tokens. No mostrar esos archivos ni usar set -x:

```bash
umask 077
AGROVOZ_DEMO_DIR=$(mktemp -d /tmp/agrovoz-curl.XXXXXX)
curl -sS --fail-with-body -o "$AGROVOZ_DEMO_DIR/a.json" -H 'Content-Type: application/json' -d '{"display_name":"Agricultor A"}' http://127.0.0.1:8010/api/rooms/participants
curl -sS --fail-with-body -o "$AGROVOZ_DEMO_DIR/b.json" -H 'Content-Type: application/json' -d '{"display_name":"Agricultor B"}' http://127.0.0.1:8010/api/rooms/participants
```

Preparar localmente un archivo curl privado por participante con su cabecera
Authorization leída desde a.json/b.json; no escribir valores reales en el repo ni
en argumentos visibles. Ejemplo de formato del archivo, solo marcador:

```text
header = "Authorization: Bearer <TOKEN_LOCAL_NO_COMPARTIR>"
```

Usando esos archivos privados como a.curl/b.curl:

```bash
curl -sS --fail-with-body --config "$AGROVOZ_DEMO_DIR/a.curl" -o "$AGROVOZ_DEMO_DIR/room.json" -H 'Content-Type: application/json' -d '{"name":"Sala curl de prueba","crop":"papa","client_request_id":"33333333-3333-4333-8333-333333333333"}' http://127.0.0.1:8010/api/rooms
# Leer room.id y join_code solo localmente. Sustituir marcadores en archivos privados:
# join.json: {"join_code":"<CODIGO_LOCAL>"}
curl -sS --fail-with-body --config "$AGROVOZ_DEMO_DIR/b.curl" -H 'Content-Type: application/json' --data-binary @"$AGROVOZ_DEMO_DIR/join.json" http://127.0.0.1:8010/api/rooms/join
# AGROVOZ_ROOM_ID es el UUID público de la sala creada, no un token.
curl -sS --fail-with-body --config "$AGROVOZ_DEMO_DIR/a.curl" -H 'Content-Type: application/json' -d '{"crop":"papa","text":"Observé manchas en tres plantas desde ayer.","client_request_id":"55555555-5555-4555-8555-555555555555"}' "http://127.0.0.1:8010/api/rooms/$AGROVOZ_ROOM_ID/alerts"
curl -sS --fail-with-body --config "$AGROVOZ_DEMO_DIR/b.curl" "http://127.0.0.1:8010/api/rooms/$AGROVOZ_ROOM_ID/alerts?after_sequence=0&limit=50"
```

Los UUID fijos son solo ejemplos: para una nueva operación usar claves nuevas;
para reintentar la misma, conservarlas. El script automático hace esto sin requerir
copiar credenciales y es la opción reproducible recomendada para revisión.

## 11. Compatibilidad, límites y coordinación

- PC2 conserva app.js, voz, demo, cola offline y estilos sin cambios. No se implementó
  frontend de salas; corresponde a III. No se tocaron archivos de Enoc ni se hizo
  merge de feature/llm-voz.
- Archivos compartidos modificados: main.py (tres ajustes pequeños), requirements
  (tres dependencias) y .env.example (solo bloque PG). Al integrar con LLM conservar
  su servicio/timeout/carga de entorno; no copiar un main.py completo sobre otro.
- La carpeta services coexistirá con services/llm.py; no se lo reemplaza. Router
  público usa /api/rooms y archivo salas.py; no añadir otro router duplicado.
- Runtime usa sesiones demo no identidad verificada. Alta sin autenticación real,
  tokens robados/sin recuperación, expiración y limitador por proceso son límites.
  HTTPS, autenticación de producción y protección distribuida de abuso pendientes.
- Conexión/permisos y migración principal ya verificados con autorización. Las
  pruebas de escritura real del módulo continúan realizándose solo en la base aislada.
- No se probó carga de muchos usuarios ni un SLA. Pool y bloqueos pequeños son
  configuración inicial; probar antes de ampliar workers o desplegar.
- Texto JSON no ejecuta HTML por sí mismo, pero el futuro render debe escapar.
  Respuestas privadas no deben entrar en caché PWA; no se tocó SW en esta fase.
- Rango de versiones sin lockfile; registrar versiones efectivas en revisión. El
  manifiesto PG exige revisión si cambia la representación estructural del servidor.
- `.env`, .venv y caches excluidos; no credenciales en Git. Los datos/artefactos del
  cluster temporal permanecen privados en /tmp y sus procesos se detienen.

## 12. Relación con PC3

| Criterio conocido | Aporte de II | Pendiente de integración/entrega |
|---|---|---|
| Reporte, 7 puntos | implementación trazable, tests, contratos y evidencia backend real | integrar historias/matriz/capturas con calidad |
| Prototipo, 7 puntos | multiusuario HTTP y persistencia PostgreSQL real aislada | despliegue local autorizado, frontend III y demostración en dos navegadores; no calcular 70% global |
| Sustentación, 4 puntos | script para demostrar aporte de Maurizio A→B, errores y persistencia | grabación, participación y duración |
| Calidad, 2 puntos | modularidad, restricciones, migración repetible y pruebas reales | revisión cruzada, C4 final e instalación en entorno compartido |

Voz, LLM, PWA, personalización global y evaluación emocional no se acreditan por
implementar estos endpoints. La rúbrica PDF no está disponible en esta rama; se
usa solo el desglose conocido, sin asignar nota /20.

## 13. Cálculo verificable y veredicto

Cada fila pesa 1; parcial/pendiente/bloqueado no suma. No se cuentan frontend,
pantallas globales ni video. La instalación compartida y la prueba aislada son
requisitos distintos y se mantienen separados.

| ID | Requisito | Estado | Archivo | Prueba | Evidencia |
|---|---|---|---|---|---|
| S01 | siete contratos exactos y tipos | Cumplido | routers/salas.py, schemas/rooms.py | OpenAPI y requests | test_salas.py + HTTP JSON |
| S02 | entidades/PK/FK/CHECK/índices | Cumplido | models_rooms.py, 001_initial.sql | PostgreSQL real | suite aislada |
| S03 | token demo, vencimiento, miembros/owner | Cumplido | services/rooms.py | 401/403/hash/expiry | suite + HTTP C rechazado |
| S04 | crear/unir idempotente y atómico | Cumplido | services/rooms.py | carreras y replay | suite real |
| S05 | alertas, cursor y concurrencia | Cumplido | services/rooms.py | commit/rollback/duplicados | suite real |
| S06 | dos clientes y persistencia tras reconexión/reinicio API | Cumplido | salas_http_flow.py | HTTP independiente | SALAS_FASE_II_HTTP.json |
| S07 | migración segura y repetible aislada | Cumplido | init_rooms_db.py, manifiesto | apply/repeat y drift | SALAS_FASE_II_TESTS.json |
| S08 | conexión y permisos dedicados en agrovoz_pc3 compartido | Cumplido | check_rooms_db.py, verify_rooms_main.py | conexiones de lectura, roles y ACL efectivos | MAIN_PRE / MAIN_PRIVILEGES / MAIN_VERIFICATION |
| S09 | migración autorizada en agrovoz_pc3 | Cumplido | 001 / init_rooms_db.py | aplicación autorizada, catálogo y checksum; repetición sin cambios | MAIN_VERIFICATION |
| S10 | compatibilidad PC2 y alcance LLM/frontend | Cumplido | main.py, sin cambios JS | regresión 3 backend + 8 UI | comandos reales |
| S11 | configuración aislada, no secretos y fallos controlados | Cumplido | rooms_config.py, session.py | errores/roles/CORS/commit | tests y diff |
| S12 | documentación y reproducción | Cumplido | este informe, ROOMS_README.md | comandos/scripts/evidencias | artefactos separados |

**12/12 = 100%. FASE II APROBADA en alcance backend.**

No hay migraciones de este módulo pendientes de aplicar. La base principal conserva
cero registros funcionales de prueba. Las 25 pruebas de salas (8 unitarias y 17 PG),
el flujo HTTP aislado, las 3 comprobaciones backend PC2 y las 8 de frontend pasaron
en el cierre. Persisten los límites de seguridad demo y la tarea de integrar el
frontend en Fase III; no se declara 70% global ni aprobación de todo PC3.

En este cierre solo se añadió el script de verificación de lectura, se actualizaron
este informe y las evidencias, y se ejecutaron la migración/GRANT expresamente
autorizados. No se modificaron frontend, lógica Ollama, .env ni SQL de migración.
No se hizo commit, push ni merge.
