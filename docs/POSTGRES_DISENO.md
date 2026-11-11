# AgroVoz PC3 — diseño PostgreSQL del módulo de salas

Estado: **PROPUESTA PARA FASE II; NO IMPLEMENTADO NI EJECUTADO**.
Responsable: Maurizio. Rama inspeccionada: `feature/salas-comunidad`.
Fecha de diseño: 11/11/2026, America/Lima. Base objetivo: `agrovoz_pc3`.

## 1. Decisiones y límites

Persistencia compartida en PostgreSQL y acceso exclusivamente mediante FastAPI.
Conservar el prefijo `/api/rooms` y `backend/routers/rooms.py` acordados en el
contrato del equipo: son compatibles con “/api/salas o convención compatible”.
No mantener dos nombres de rutas equivalentes ni cambiar `/api/consult`.

El contrato heredado propone SQLite; la instrucción actual del solicitante cambia
la decisión a **PostgreSQL**. Se registra aquí para revisión del equipo, sin
sobrescribir `PC3_RAMAS_Y_CONTRATOS.md`. No hay datos SQLite que migrar detectados
ni se da por fusionada la rama LLM. No se implementa el motor de IA en este módulo.

Usar SQLAlchemy 2.x, driver psycopg 3 y endpoints síncronos `def` para consultas
bloqueantes en el pool de trabajo de FastAPI. Una Session por petición, cerrada
siempre; nunca compartirla entre solicitudes/hilos. El servicio de dominio no
importará FastAPI: sus errores se traducirán a HTTP en el router. Esta separación
es coherente con la [gestión de sesiones documentada por SQLAlchemy](https://docs.sqlalchemy.org/en/20/orm/session_basics.html).
No añadir Redis, WebSockets, Celery ni un segundo ORM para este alcance.

Dependencias **previstas, aún no instaladas ni añadidas**:

```text
SQLAlchemy>=2.0,<3
psycopg[binary]>=3,<4
python-dotenv>=1,<2
```

La última permite leer solo configuración de salas desde `.env`, sin escribirla
en `os.environ` ni cambiar indirectamente la configuración LLM. Entorno exportado
prevalece sobre archivo. Verificar ruedas/compatibilidad con Python 3.14 antes de
fijar versiones efectivas. Para tests, pytest es dependencia de desarrollo; los
tests unittest existentes se mantienen ejecutables.

## 2. Arquitectura prevista

```mermaid
flowchart LR
  A[Navegador A: sesión demo propia] --> C[modules/rooms-client.js]
  B[Navegador B: almacenamiento independiente] --> D[modules/rooms-client.js]
  C --> E[FastAPI: router /api/rooms]
  D --> E
  E --> F[Dependencia: token demo y Session]
  F --> G[Servicio de salas: autorización y transacción]
  G --> H[SQLAlchemy 2 + psycopg 3]
  H --> I[PostgreSQL agrovoz_pc3: schema salas]
```

Estructura, sin crearla en Fase I:

```text
backend/
  rooms_config.py          # solo variables del módulo; sin conexión al importar
  db/
    __init__.py
    base.py                # metadata del módulo
    session.py             # engine lazy, Session por petición
    models_rooms.py        # cuatro entidades y tabla técnica de versiones
  schemas/
    __init__.py
    rooms.py               # entrada/salida; extra='forbid'
  services/
    rooms.py               # reglas, transacciones, errores de dominio
  routers/
    rooms.py               # adaptador HTTP/dependencias
  migrations/rooms/
    001_initial.sql        # exclusivamente schema salas; a revisar antes de ejecutar
  scripts/
    init_rooms_db.py        # init versionado, transaccional y repetible
AgroVoz-App/modules/
  rooms-client.js           # API, credencial por perfil, polling, deduplicación
```

En main.py solo se prevén importación y registro:

```python
from routers.rooms import router as rooms_router
app.include_router(rooms_router)
```

El router tendrá prefix `/api/rooms`. La ausencia de DATABASE_URL hará que rutas
de salas devuelvan 503, sin impedir arrancar el adaptador LLM. Sin DDL ni carga de
base durante importación/startup. Engine creado de forma diferida, pequeño pool
inicial (2 conexiones + 1 adicional, un worker); ajustar solo después de medir.
No modificar timeouts/modelo/configuración ni endpoints Ollama.

## 3. Identidad de demostración y autorización

**Un UUID enviado por el cliente no autentica a una persona.** No aceptar `ana`,
`jose`, `rosa`, `user_id` ni `owner` del payload como autoridad. Tampoco aceptar
`X-User-Id` como credencial. El nombre declarado no prueba identidad y puede
repetirse; no se pondrá UNIQUE al nombre.

Propuesta mínima para la demo: registrar un participante nuevo con nombre de uso;
el servidor genera UUID y un token opaco aleatorio de 32 bytes (codificado URL-safe).
Guardar únicamente SHA-256 de ese token en PostgreSQL. Devolver el token una sola
vez al crearlo, con vencimiento de 24 horas; usar `Authorization: Bearer <token>`
en rutas protegidas. Buscar por hash y comprobar expiración/revocación en servidor.
No ponerlo en URL, logs, capturas, localStorage de la demo original ni `.env`.

El módulo podrá guardar la credencial bajo su **propia clave local por perfil**
`agrovoz_rooms_v1.<perfil_local>` para sobrevivir recarga; no se enviará toda la base
local. Un XSS puede robar ese token: es una limitación explícita de la demo y no
se usará información sensible. Cambiar de perfil cancela polling/peticiones y
selecciona otra credencial, nunca reutiliza la de A como la de B. Dos pestañas con
almacenamiento compartido no bastan para probar dos personas: usar dos contextos
de navegador aislados. Al perder o expirar el token, una nueva inscripción crea
otro participante y exige volver a unirse; no recuperar identidad por nombre/UUID.

El token acredita posesión de una sesión **demo**, no identidad personal verificada,
contraseña, correo, roles de producción ni consentimiento de otra persona. Un
atacante con token robado puede suplantar esa sesión. En despliegue real se deberá
sustituir por autenticación y sesiones seguras, HTTPS y protección de abuso.

Para cada petición privada:

1. Resolver participante desde token válido (si falta, está vencido o no existe: 401).
2. Validar datos con límites; no permitir sobreescribir autor, secuencia, timestamps.
3. Comprobar membresía en PostgreSQL para esa sala (no miembro: 403). No confiar en
   el filtro de comunidad del navegador. Sala inexistente: 404.
4. En POST de alerta, autor derivado de credencial y membresía comprobada dentro
   de la transacción. El FK compuesto también impide asociar autor ajeno a sala.
5. Rotación de invitación solo por creador con membresía owner. Los demás miembros
   pueden leer/publicar, no generar códigos nuevos. No se diseñan bajas ni borrado
   de miembros/alertas en esta primera implementación.

Conocer el código de invitación permite unirse: es una autorización por invitación
compartida, no una invitación nominativa. Código aleatorio de 12 caracteres del
alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`; normalizar uppercase, validar formato,
almacenar solo su hash SHA-256, UNIQUE. No listar ni registrar códigos. Limitar
intentos de unión (propuesta para demo: 10/minuto por sesión y origen; en varios
workers requerir limitador compartido o proxy, fuera de esta entrega mínima).

## 4. Modelo entidad-relación

```mermaid
erDiagram
  PARTICIPANTES ||--o{ SALAS : crea
  PARTICIPANTES ||--o{ MEMBRESIAS : pertenece
  SALAS ||--|{ MEMBRESIAS : contiene
  SALAS ||--o{ ALERTAS : recibe
  MEMBRESIAS ||--o{ ALERTAS : autoriza_autor
  PARTICIPANTES {
    uuid id PK
    varchar display_name
    bytea token_hash UK
    timestamptz token_expires_at
    timestamptz revoked_at
    timestamptz created_at
  }
  SALAS {
    uuid id PK
    uuid created_by FK
    uuid creation_request_id
    varchar name
    varchar crop
    bytea join_code_hash UK
    bigint last_alert_sequence
    timestamptz created_at
    timestamptz updated_at
  }
  MEMBRESIAS {
    uuid room_id PK,FK
    uuid participant_id PK,FK
    varchar role
    timestamptz joined_at
  }
  ALERTAS {
    uuid id PK
    uuid room_id FK
    uuid author_id FK
    uuid client_request_id
    bigint sequence
    varchar crop
    varchar text
    timestamptz created_at
  }
```

Nombres físicos: `salas.participants`, `salas.rooms`, `salas.memberships`,
`salas.alerts`. Todas las columnas son NOT NULL salvo donde se indique. UUID v4
se genera en servidor con biblioteca estándar; no exigir extensiones PostgreSQL.
Timestamps de servidor TIMESTAMPTZ, serializados RFC3339 UTC con `Z`; el cliente
presenta hora Perú. No ordenar por el reloj del navegador.

### 4.1 participants

| Columna | Tipo | Clave/restricción/uso |
|---|---|---|
| id | UUID | PK; identidad interna generada en servidor |
| display_name | VARCHAR(50) | CHECK longitud de trim entre 1 y 50; no UNIQUE |
| token_hash | BYTEA | UNIQUE; CHECK octet_length=32; nunca token en claro |
| token_expires_at | TIMESTAMPTZ | CHECK mayor que created_at |
| revoked_at | TIMESTAMPTZ NULL | NULL significa no revocado; validar en cada petición |
| created_at | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP |

El hash identifica una sola sesión demo por participante en esta fase. No hay
rotación automática de token ni recuperación por nombre. No indexar nombre si no
hay búsqueda por nombre; lookup de token usa índice UNIQUE existente.

### 4.2 rooms

| Columna | Tipo | Clave/restricción/uso |
|---|---|---|
| id | UUID | PK |
| created_by | UUID | FK participants(id), ON DELETE RESTRICT |
| creation_request_id | UUID | enviado por cliente como idempotency key de creación |
| name | VARCHAR(80) | CHECK longitud trim 1–80; nombres pueden repetirse |
| crop | VARCHAR(20) NULL | CHECK cultivo canónico o NULL para sala general |
| join_code_hash | BYTEA | UNIQUE; CHECK octet_length=32 |
| last_alert_sequence | BIGINT | DEFAULT 0; CHECK >=0; contador transaccional por sala |
| created_at | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP; servicio actualiza al publicar/rotar |

UNIQUE `(created_by, creation_request_id)` hace repetible la creación. Crear sala
y membresía owner en la misma transacción. Invariante del servicio: owner coincide
con created_by; no es un CHECK entre tablas. Debe probarse explícitamente.

### 4.3 memberships

| Columna | Tipo | Clave/restricción/uso |
|---|---|---|
| room_id | UUID | PK compuesto; FK rooms(id), ON DELETE RESTRICT |
| participant_id | UUID | PK compuesto; FK participants(id), ON DELETE RESTRICT |
| role | VARCHAR(10) | CHECK IN ('owner','member') |
| joined_at | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP |

PK `(room_id, participant_id)` impide unión repetida. Índice parcial UNIQUE
`(room_id) WHERE role='owner'` impide dos propietarios de la misma sala; la creación
transaccional asegura que exista uno. No se eliminan miembros para ocultar alertas
anteriores. Si se diseña baja futura, modelarla sin romper la autoría histórica.

### 4.4 alerts

| Columna | Tipo | Clave/restricción/uso |
|---|---|---|
| id | UUID | PK generado por servidor |
| room_id | UUID | FK rooms(id), ON DELETE RESTRICT |
| author_id | UUID | junto a room_id, FK a memberships(room_id, participant_id), ON DELETE RESTRICT |
| client_request_id | UUID | clave de publicación del cliente; reutilizar al reintentar |
| sequence | BIGINT | CHECK >0; asignado con bloqueo de sala, no por cliente |
| crop | VARCHAR(20) | CHECK en cultivos canónicos |
| text | VARCHAR(500) | CHECK longitud trim 12–500 |
| created_at | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP; solo servidor |

UNIQUE `(room_id, sequence)` y UNIQUE `(room_id, author_id, client_request_id)`.
No hacer UNIQUE al texto: dos agricultores pueden observar lo mismo legítimamente.
No fotos, audio, datos LLM ni historial privado en esta tabla.

Cultivos canónicos: `papa`, `maiz`, `tomate`, `cafe`, `trigo`, `otro`. API rechaza
NUL/caracteres de control no admitidos; permite texto plano con saltos de línea.
Normalizar trim antes de validar y de comparar reintentos. Datos que contienen
marcas HTML se tratan únicamente como texto: jamás ejecutar, interpolar sin escape
ni usar innerHTML para contenido del servidor. Reutilizar esc() o textContent.

### 4.5 Índices previstos

| Índice | Propósito |
|---|---|
| PK/UNIQUE de cada tabla | identidad, token, invitación, unión y reintento únicos |
| memberships(participant_id, joined_at, room_id) | listar salas propias sin explorar todas las membresías |
| rooms(created_by) | lookup del creador/FK; revisar si el índice UNIQUE de creación ya cubre el patrón antes de duplicar |
| UNIQUE alerts(room_id, sequence) | paginación por sala y cursor, sin índice duplicado |
| UNIQUE alerts(room_id, author_id, client_request_id) | idempotencia y lookup de autor dentro de sala |
| índice parcial memberships(room_id) WHERE role='owner' | propietario único |

Evitar índices redundantes. PostgreSQL crea índices para PK/UNIQUE, pero no todos
los lados referenciantes de FK; revisar patrones reales antes de añadir otros.
Referencia de integridad: [restricciones PostgreSQL](https://www.postgresql.org/docs/current/ddl-constraints.html).

Tabla técnica adicional `salas.schema_migrations`: `version VARCHAR(40) PK`,
`checksum CHAR(64) NOT NULL`, `applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`.
No es una entidad de usuario ni aparece como capacidad colaborativa.

## 5. Transacciones, duplicados y cursores seguros

**Creación de sala:** idempotencia por creador/creation_request_id. Primera petición:
201 con código de invitación. Repetición del mismo payload normalizado: 200, misma
sala y sin otra membresía; código NULL porque solo se almacenó hash. Si el cliente
perdió el código, el owner usa el endpoint de generar otra invitación. Igual clave
con otro nombre/cultivo: 409. Nunca crear segunda sala por timeout/reintento.

**Unión:** código válido + token válido; INSERT membresía ON CONFLICT DO NOTHING,
y luego leer estado. Primera unión 201, repetida 200, sin duplicar participante.
Para evitar una unión con código invalidado concurrentemente, unión y rotación
adquieren el mismo lock de fila de sala. La unión revalida el hash después del
lock y antes de insertar; la rotación revalida owner bajo el lock y confirma su
nuevo hash en la misma transacción. Si la rotación confirmó primero, el código
anterior falla con 404; miembros admitidos antes no se expulsan.

La capacidad [ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html)
se usa dentro de transacciones; no sustituye comprobar autorización ni comparar
el payload de una clave idempotente.

**Publicación:** una transacción por POST:

1. Resolver token; adquirir `SELECT ... FOR UPDATE` de esa sala.
2. Revalidar membresía y permisos dentro de esa transacción.
3. Buscar `(room_id, author_id, client_request_id)` existente. Si el texto/cultivo
   coincide tras normalización: devolver el mismo registro, 200. Si difiere: 409.
4. Incrementar rooms.last_alert_sequence y usar el valor en la alerta; insertar y
   actualizar timestamp de sala. Commit antes de devolver 201.
5. Cualquier error: rollback completo; no devolver publicación exitosa ni incrementar
   contador fuera de transacción. Serializar solo publicaciones de la misma sala.

El bloqueo se conserva hasta commit. Si una publicación se revierte, también lo
hace el contador. Así otro escritor de esa sala no puede confirmar una secuencia
posterior mientras la anterior siga pendiente. Un cursor sobre BIGSERIAL global
**no ofrece esa garantía por sí solo**: una transacción lenta con ID menor podría
confirmar después de que el lector avanzó a uno mayor. Tampoco usar solo timestamps.

No hay borrado/edición de alertas en este alcance. En lectura, validar membresía,
consultar `sequence > after_sequence ORDER BY sequence ASC LIMIT limit+1`. Responder
el cursor del último elemento **entregado**, no el contador actual ni la fila extra.
Sin elementos, conservar el cursor recibido. Valores BIGINT se serializan como
strings decimales para no perder precisión en JavaScript; cliente trata el cursor
como opaco. Validar entero 0..9223372036854775807 en servidor.

Deadlock/serialización: rollback y 503 recuperable; cliente reintenta con la misma
clave idempotente. No bucles de retry infinitos. Una sesión DB independiente por
petición evita compartir una transacción entre clientes. psycopg documenta las
[limitaciones de concurrencia de conexiones y cursores](https://www.psycopg.org/psycopg3/docs/advanced/async.html).

## 6. Contratos HTTP propuestos

**Todos los ejemplos son ficticios; no son salidas de endpoints existentes.** UUID,
fecha y código son datos ilustrativos. Autorización requerida en todo salvo
registro de participante. No incluir credenciales en URLs ni respuestas de error.

### 6.1 POST /api/rooms/participants

Entrada: `{"display_name":"Agricultor A"}`. Validar 1–50 caracteres.
Respuesta 201 (token opaco, solo esta vez):

```json
{"participant":{"id":"11111111-1111-4111-8111-111111111111","display_name":"Agricultor A","created_at":"2026-11-11T12:00:00Z"},"access_token":"<TOKEN_DEMO_GENERADO_SOLO_EN_IMPLEMENTACION>","token_type":"bearer","expires_at":"2026-11-12T12:00:00Z"}
```

No aceptar id/hash/rol elegidos por cliente. No reintentar automáticamente el alta
si se perdió el token: informar que se creará otra sesión demo al repetirla.

### 6.2 POST /api/rooms

Entrada:

```json
{"name":"Papa Valle Verde","crop":"papa","client_request_id":"33333333-3333-4333-8333-333333333333"}
```

Respuesta 201:

```json
{"room":{"id":"22222222-2222-4222-8222-222222222222","name":"Papa Valle Verde","crop":"papa","created_at":"2026-11-11T12:01:00Z","my_role":"owner","member_count":1},"join_code":"K7M9P4Q2R6TX","replayed":false}
```

Respuesta de reintento 200: misma estructura, mismo room, `join_code:null`,
`replayed:true`. Advertir que el código no se puede recuperar por hash; ofrecer
regenerarlo. `client_request_id` mapea a creation_request_id del almacenamiento.

### 6.3 GET /api/rooms?limit=50&offset=0

Solo salas con membresía del actor. `limit` 1–100, `offset` >=0; orden estable
joined_at DESC, room_id DESC. Offset es suficiente para este listado pequeño;
no usarlo para el feed de alertas concurrentes.

```json
{"items":[{"id":"22222222-2222-4222-8222-222222222222","name":"Papa Valle Verde","crop":"papa","created_at":"2026-11-11T12:01:00Z","my_role":"owner","member_count":2}],"has_more":false,"next_offset":null}
```

Sin salas: items vacío, nunca devolver salas ajenas, hashes o códigos.

### 6.4 POST /api/rooms/join

Entrada: `{"join_code":"K7M9P4Q2R6TX"}`. Actor B derivado de su Bearer propio.
Primera unión 201; repetida 200:

```json
{"room":{"id":"22222222-2222-4222-8222-222222222222","name":"Papa Valle Verde","crop":"papa","created_at":"2026-11-11T12:01:00Z","my_role":"member","member_count":2},"membership":{"participant_id":"44444444-4444-4444-8444-444444444444","role":"member","joined_at":"2026-11-11T12:02:00Z"},"already_member":false}
```

Repetida: `already_member:true`, membresía original y su fecha, sin duplicados.
Código inexistente/revocado: 404 invite_not_found. Exceso de intentos: 429.

### 6.5 POST /api/rooms/{room_id}/invitations

Solo owner/creador, sin payload. Genera otro código e invalida el anterior para
nuevas uniones; no elimina miembros existentes. Respuesta 200:

```json
{"room_id":"22222222-2222-4222-8222-222222222222","join_code":"N8W3K6Q9M2RT"}
```

No reintentar automáticamente esta rotación: si se pierde su respuesta, pedir
acción explícita de generar un código nuevo. No mostrar códigos en el feed.

### 6.6 POST /api/rooms/{room_id}/alerts

Entrada:

```json
{"crop":"papa","text":"Observé manchas en las hojas de tres plantas desde ayer.","client_request_id":"55555555-5555-4555-8555-555555555555"}
```

201 primera publicación; 200 mismo reintento:

```json
{"alert":{"id":"66666666-6666-4666-8666-666666666666","room_id":"22222222-2222-4222-8222-222222222222","sequence":"1","author":{"id":"11111111-1111-4111-8111-111111111111","display_name":"Agricultor A"},"crop":"papa","text":"Observé manchas en las hojas de tres plantas desde ayer.","created_at":"2026-11-11T12:03:00Z"},"replayed":false}
```

Repetida: mismo UUID/sequence/texto/fecha, replayed=true. Texto diferente con misma
clave: 409. No aceptar author/owner/sequence/foto del cliente; 422 por campos extra.

### 6.7 GET /api/rooms/{room_id}/alerts?after_sequence=0&limit=50

Solo miembros. Respuesta 200:

```json
{"items":[{"id":"66666666-6666-4666-8666-666666666666","room_id":"22222222-2222-4222-8222-222222222222","sequence":"1","author":{"id":"11111111-1111-4111-8111-111111111111","display_name":"Agricultor A"},"crop":"papa","text":"Observé manchas en las hojas de tres plantas desde ayer.","created_at":"2026-11-11T12:03:00Z"}],"next_after":"1","has_more":false}
```

Sin novedades: `{"items":[],"next_after":"1","has_more":false}` si cursor=1.
Con más páginas, has_more=true y próxima petición usa next_after. Cursor inicial
0 devuelve historial completo paginado. No usar ETag ni cache compartida de este
feed en esta fase.

### 6.8 Errores y cabeceras

Formato propio del módulo para errores de dominio:

```json
{"detail":{"code":"not_a_member","message":"Únete a la sala antes de consultar o publicar alertas."}}
```

| HTTP | code / circunstancia | Acción del cliente |
|---|---|---|
| 401 | demo_session_required / token inválido/vencido | pedir nueva sesión; no suplantar por nombre |
| 403 | not_a_member / owner_required | ofrecer unirse con código; no mostrar datos privados |
| 404 | room_not_found / invite_not_found | revisar sala/código sin revelar códigos válidos |
| 409 | idempotency_conflict | conservar borrador; nueva clave solo si es otra publicación |
| 422 | validación de FastAPI | mantener su detalle estándar; señalar campos, no alterar errores LLM |
| 429 | join_rate_limited | esperar Retry-After |
| 503 | rooms_not_configured / database_unavailable / database_busy | conservar borrador y reintentar; sin éxito local ficticio |
| 500 | internal_error inesperado | mensaje genérico, identificador de incidente, sin SQL ni credenciales |

Respuestas protegidas y registro de token: `Cache-Control: no-store`. 401 incluirá
WWW-Authenticate: Bearer. CORS conservará orígenes locales autorizados y añadirá
solo `Authorization` a allow_headers junto a Content-Type; no habilitar `*` ni
credenciales de cookies. GET/POST actuales bastan. Ese es un segundo ajuste mínimo
a main.py, además de include_router, a coordinar con LLM. No middleware global que
modifique el formato de errores de /api/consult.

## 7. Polling y UX sin duplicados

Intervalo base **4 segundos**, dentro de los 3–5 solicitados. Un solo GET en curso
por sala/perfil. Programar setTimeout después de concluir, sin setInterval que
solape peticiones. Timeout de red acotado; errores aumentan espera (4/8/16/30 s con
pequeño jitter), se informa desconexión y se ofrece Reintentar. No prometer latencia
máxima de 4 s si el servidor está lento. Al recuperar conectividad, lectura inmediata.

Cancelar con AbortController al salir de Comunidad, cambiar sala/perfil o cerrar
el cliente; usar generación de sesión para ignorar respuestas tardías. Pausar en
pestaña oculta y consultar al volver. Agotar páginas has_more antes de programar
polling normal, siempre con una sola petición de lectura activa.

Mantener Map por alert.id. La respuesta de publicar y la de polling pueden contener
la misma alerta: se fusionan por ID. Solo la lectura secuencial avanza next_after;
**no avanzar cursor a la secuencia de la publicación propia**, pues podría saltar
alertas intermedias de otros usuarios. Una publicación pide refresh inmediato; si
hay lectura en curso, marcar refresh pendiente, no iniciar otra paralela.

Deshabilitar Publicar mientras haya POST activo. Generar client_request_id al
confirmar el borrador; conservarlo ante timeout/desconexión y usarlo al reintentar
el mismo texto. Si se edita tras confirmar, tratar como nuevo borrador/clave con
revisión explícita. Mantener mensaje “Enviando”, “Publicado” solo tras confirmación
del servidor, o “No se pudo publicar; tu borrador sigue disponible”.

Separar modo comunidad real de demo local. No importar ni publicar automáticamente
`db.alerts`, drafts o cola PC2 al servidor: contienen simulaciones. Offline real
permite mantener borrador propio, **no fingir publicación**, ni sincronizar con
syncQueue() local. Vista caché, si se añade, debe indicar fecha y datos no actualizados;
los mensajes autenticados no deben entrar al caché genérico del service worker.

## 8. PostgreSQL, configuración y permisos

Proponer dos roles dedicados, ninguno superusuario:

- `agrovoz_salas_migrator`: login de despliegue, propietario del schema salas;
  sin CREATEDB/CREATEROLE/REPLICATION. Admin provisiona la base por separado.
- `agrovoz_salas_app`: login runtime, CONNECT a agrovoz_pc3, USAGE en schema salas
  y solo SELECT/INSERT/UPDATE en las cuatro tablas. Sin DDL/DELETE ni privilegios
  en otras bases/schemas; sin acceso de escritura a schema_migrations.

El administrador debe revisar privilegios heredados/PUBLIC y propiedad existente,
no modificar roles o proyectos ajenos a ciegas. No crear ni alterar agrovoz_pc3 si
existe sin inspección previa y decisión del responsable. No usar usuario postgres
en la aplicación. Contraseñas se fijan interactivamente por administrador, nunca
en SQL versionado, comandos visibles, logs ni capturas.

**Plantilla que deberá añadirse a backend/.env.example en Fase II, sin aplicarla aquí:**

```dotenv
# Propuesta: sustituir localmente por un secreto propio; no es una contraseña real.
DATABASE_URL=postgresql+psycopg://agrovoz_salas_app:REEMPLAZAR_LOCALMENTE@127.0.0.1:5432/agrovoz_pc3
# Solo init/migraciones; no usar con las peticiones de la app.
MIGRATION_DATABASE_URL=postgresql+psycopg://agrovoz_salas_migrator:REEMPLAZAR_LOCALMENTE@127.0.0.1:5432/agrovoz_pc3
```

No sobrescribir variables Ollama existentes ni imprimir DSN completas. URLs con
caracteres especiales en contraseña necesitan codificación o construcción mediante
SQLAlchemy URL; nunca concatenar valores arbitrarios en SQL. Solo consultas
parametrizadas y nombres de tablas fijos. El archivo local `.env` no se edita en
esta fase de diseño. `.gitignore` nuevo lo excluye, además de entornos y cachés.

Runtime: conexión y adquisición de pool con límites cortos; statement_timeout y
lock_timeout acotados para este módulo (propuesta: 3 s y 1 s). Ajustar tras medir;
no cambiar configuración global del servidor. Si faltan tablas/migración, 503
service_not_ready y log técnico saneado, no intentar crearlas en la petición.

## 9. Inicialización idempotente y evolución

Se propone script propio versionado para este esquema pequeño, sin dependencia
Alembic inicialmente. No usar create_all en cada arranque como sustituto de control
de versiones. Alembic puede incorporarse si el esquema evoluciona sustancialmente.

Algoritmo de init previsto, **sin ejecución en esta Fase I**:

1. Recibir MIGRATION_DATABASE_URL explícita; comprobar current_database() ==
   agrovoz_pc3 (o agrovoz_pc3_test en modo de prueba separado). Rechazar cualquier
   otro destino y usuario runtime. No crear/eliminar bases desde el script.
2. Dentro de una transacción, obtener bloqueo asesor de migración para evitar dos
   inicializaciones simultáneas en esta misma base/schema.
3. Revisar existencia de schema y tablas antes de adoptar nada. Si hay objetos no
   reconocidos o incompatibles, abortar para revisión; no alterarlos ni borrarlos.
4. Primera instalación vacía: crear solo schema salas y cuatro tablas, restricciones,
   índices y schema_migrations. Insertar versión 001 y checksum.
5. Segunda ejecución: verificar versión/checksum y estructura esperada, sin reinserción
   de datos ni DDL repetido. Si difiere checksum/esquema, fallar explícitamente.
6. Cambios futuros: una nueva versión revisada; no editar migraciones ya aplicadas.
   Commit atómico; ante error rollback. No usar DROP, TRUNCATE ni reset automático.

No incluir semillas automáticas de alertas en la base real. Si se quieren datos
simulados, script opcional separado y etiquetado, nunca evidencia de colaboración.

## 10. Pruebas y base separada

Base de integración: **agrovoz_pc3_test**, con roles exclusivos
`agrovoz_salas_test` y `agrovoz_salas_test_migrator`. Provisionamiento administrativo
pendiente; no se hizo conexión ni escritura a PostgreSQL para este diseño.

Variables de tests previstas, mediante entorno dedicado y nunca por defecto:

```dotenv
TEST_DATABASE_URL=postgresql+psycopg://agrovoz_salas_test:REEMPLAZAR_LOCALMENTE@127.0.0.1:5432/agrovoz_pc3_test
TEST_MIGRATION_DATABASE_URL=postgresql+psycopg://agrovoz_salas_test_migrator:REEMPLAZAR_LOCALMENTE@127.0.0.1:5432/agrovoz_pc3_test
ALLOW_TEST_DB_WRITE=1
```

El fixture debe exigir bandera y nombres exactos; verificar también current_database()
en la conexión, rol/host local y separación de DATABASE_URL real. **Nunca fallback
a DATABASE_URL**. Sin configuración, integrar tests como skip con motivo explícito,
no contarlos como aprobados. No usar SQLite en memoria para certificar semántica PG.

| Nivel | Casos previstos | Evidencia necesaria |
|---|---|---|
| Unitario sin PG | validación, permisos del servicio, errores mapeados, cursor, payload, lógica de polling con reloj/red simulados | salida de tests; no demuestra persistencia PG |
| Integración PG de prueba | FK/UNIQUE/CHECK, token expirado, miembro/no miembro, creación/alta/unión, persistencia, rollback | pruebas ejecutadas realmente contra agrovoz_pc3_test |
| Idempotencia concurrente | 2+ POST iguales → una fila/mismo ID; misma clave y cuerpo distinto → 409; dos uniones → una membresía | conteo DB y respuestas; sesiones SQL distintas |
| Orden de commit | A retiene lock y B publica; lectores no pierden alertas antes/después de commit/rollback | feed final contiene ambas en orden, sin saltar cursor |
| Pool/errores | dependencia no configurada, conexión inválida de prueba, timeout/lock y rollback | 503 genérico, borrador conservado, sin SQL/secreto expuesto |
| E2E dos contextos | A crea sala, B se registra/se une; A publica; B lee y recarga; C no miembro rechazado | video/capturas + Network + fila persistida, sin copiar localStorage |
| Regresión PC2/LLM | smoke existentes; /health y /api/consult sin cambios; demo sigue claramente marcada | tests heredados y prueba cruzada tras futura integración |

Cada ejecución usa UUID propios de fixtures. Tests de concurrencia emplean conexiones
independientes y commits reales en **base de prueba**. Limpieza solo de filas de
esa ejecución y en orden FK, tras verificar destino; nunca DROP DATABASE, reset
real ni truncado global. El runtime no tiene DELETE: limpieza de fixtures, si se
implementa, usa rol de prueba autorizado, nunca credenciales de producción.

Simular caída con dependency override o DSN de puerto inválido en tests; no detener
PostgreSQL compartido. Cualquier prueba destructiva queda fuera del alcance.

## 11. Fases II/III y criterios de aceptación

Fase II: cerrar configuración/roles, revisar init, crear tablas/schemas/servicio/router,
registrar router y ejecutar tests PostgreSQL aislados. Fase III: integrar módulo JS,
polling/UX, dos sesiones reales, recarga, errores y evidencias. No empezar modificando
el monolito ni asumir integradas las mejoras LLM de otra rama.

| Criterio de demostración futura | Aceptación observable |
|---|---|
| AC1 Crear sala | A con token obtiene 201; sala y owner confirmados en PG; retry no duplica |
| AC2 Unir B | B con token propio y código obtiene 201; segundo intento 200; dos membresías |
| AC3 Publicar A | tras confirmación, 201 con UUID/sequence; repetir misma clave → mismo UUID y una fila |
| AC4 Leer desde B | contexto sin almacenamiento de A obtiene alerta vía GET en polling; no localStorage compartido |
| AC5 Recargar | B recarga y vuelve a obtener la alerta persistida; autor y fecha no cambian |
| AC6 Rechazar ajenos | sin token 401; C con token pero no miembro 403 en GET/POST; falsificar author_id → 422; B no rota invitación |
| AC7 Fallos de servicio/PG | configuración ausente/conexión fallida → 503; UI conserva borrador, reintenta sin duplicados ni éxito demo |

El diseño está listo para comenzar código de Fase II; provisión, migración real y
validación colaborativa siguen pendientes. No se afirma haber demostrado AC1–AC7.
