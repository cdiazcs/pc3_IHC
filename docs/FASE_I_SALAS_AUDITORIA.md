# Fase I Salas — auditoría, arquitectura y preparación

Responsable del módulo: Maurizio. Fecha: 11/11/2026 (America/Lima).
Rama verificada: **feature/salas-comunidad**. Alcance de esta entrega: auditar la
base PC2 y diseñar la colaboración con PostgreSQL; **no implementar todavía salas**.

## 1. Resumen y veredicto de preparación

La rama contiene comunidad simulada en el navegador, sin API de salas, membresías
ni persistencia compartida. El selector de perfiles y la cola offline no prueban
colaboración entre sesiones independientes. El backend solo tiene health y consulta
LLM en su versión base; no se asumen fusionadas mejoras de otras ramas.

Se entrega [POSTGRES_DISENO.md](POSTGRES_DISENO.md), con entidades, integridad,
credenciales demo, autorización, siete contratos HTTP, cursores/polling, configuración,
init idempotente y pruebas aisladas. La única corrección fuera de documentación es
un `.gitignore` nuevo que protege secretos/cachés ya presentes sin borrarlos.

**Fase I de diseño preparada para iniciar la implementación de Fase II.** Esto no
significa que PostgreSQL esté provisionado, que las migraciones estén aplicadas ni
que multiusuario esté funcionando. Antes de ejecutar init deben verificarse base,
roles y permisos dedicados; no se realizaron esas operaciones aquí.

## 2. Rama, estado y protección del trabajo

Comandos ejecutados: `git branch --show-current`, `git status --short`, lecturas
de archivos y comparación de ramas sin checkout/merge. Estado inicial:

```text
feature/salas-comunidad
?? backend/.env
?? backend/__pycache__/
?? backend/services/
?? tests/__pycache__/
```

La carpeta services contenía cachés residuales sin código fuente Python del módulo
LLM en esta rama. No se toman esos restos sin seguimiento como implementación ni
se eliminaron. El commit de base observado fue `e32e13d` (first commit); la comparación
rastreada con main no mostró diferencias iniciales. `git status` conserva archivos
sin seguimiento que `git diff` no incluye.

Faltaba `.gitignore` en esta rama: `.env` y cachés aparecían como candidatos a Git.
Se añadió uno mínimo para `.env`, variantes privadas, `.venv`, venv, pycache, pyc,
pytest cache y node_modules, exceptuando `.env.example`. Después:

- `git check-ignore` confirmó exclusión de `.env`, entorno y cachés de backend/tests.
- `git ls-files backend/.env '*/__pycache__/*' '*venv*'` no devolvió archivos.
- No se leyó ni imprimió contenido de `.env`, ni se cambió su configuración.
- No se hizo commit/push/merge/cambio de rama/PR. No hubo DDL/DML PostgreSQL.

El índice actual no contiene esos secretos/cachés; no se afirma una auditoría de
secretos de todo el historial. El resto de archivos de I/II/III LLM no está en esta
base de salas: las evidencias de otra rama no acreditan funcionalidades aquí.

## 3. Diagnóstico de implementación PC2

| Componente observado | Archivo/función | Estado y evidencia |
|---|---|---|
| Perfiles ficticios | app.js: defaults(), current, account(), demoUser | tres entradas locales; sin alta/login servidor |
| Persistencia local | load(), save(), DB_KEY agrovozdemo_v3, USER_KEY agrovozcurrent_user | JSON en localStorage del origen/navegador |
| Comunidad | pageAlertas() | filtra db.alerts por community y status; no consulta servidor |
| Publicación | alertForm, modal='alert', confirm-alert | confirma texto y hace db.alerts.push; crea demo:true |
| Cola offline | draftAlerts, queue, syncQueue() | copia objetos entre arrays locales, no sincronización remota |
| Duplicados locales | syncQueue(): some(id) | evita insertar dos veces una misma alerta local; no asegura idempotencia HTTP/SQL |
| Identificador | id(), owner=current | UUID/random local y clave del perfil no autenticada; no autorización real |
| Privacidad aparente | filtro por comunidad y separación de cuentas locales | aislamiento de UI; una persona con acceso al navegador puede alterar todos los datos |
| Red | makeRecord() | único fetch detectado va a /api/consult, no a comunidad |
| Backend | main.py | GET /health y POST /api/consult; sin rutas de salas |
| Router comunitario | backend/routers/README.md | reserva futura; rooms.py no existe |
| Cliente comunitario | AgroVoz-App/modules/README.md | rooms-client.js reservado, no implementado |
| Base compartida | requirements.txt | FastAPI, Uvicorn, httpx; sin ORM/driver PG declarados |

No hay creación/unión de salas reales, comprobación de miembros, almacenamiento
PostgreSQL, polling remoto ni demostración A→B entre almacenamientos independientes.
Cambiar Ana/José dentro de la misma app lee el mismo objeto db: es una **simulación**.
Dos pestañas del mismo origen pueden compartir localStorage y tampoco acreditan
un backend colaborativo. La demostración futura usará contextos separados, tokens
independientes y el mismo PostgreSQL a través de HTTP.

Conservar esas funciones PC2 en modo demo claramente identificado. El módulo nuevo
no debe subir automáticamente sus alertas ficticias ni reinterpretar el filtro
community como autorización. Perfil local se usa solo para elegir credencial demo
propia; autor efectivo y membresía siempre se determinan en servidor.

## 4. Entorno comprobado y pruebas reales

| Comando/comprobación | Resultado real |
|---|---|
| `git branch --show-current` | feature/salas-comunidad |
| `git status --short` | estado anterior conservado; después solo .gitignore y los dos documentos nuevos visibles |
| `node --check AgroVoz-App/app.js` | salida 0 |
| `node tests/smoke.test.cjs` | 8/8 comprobaciones PC2 aprobadas |
| `PYTHONDONTWRITEBYTECODE=1 backend/.venv/bin/python tests/backend_smoke.py` | 3/3: health, proveedor no configurado, entrada inválida |
| `python3 --version` | 3.14.4 |
| `node --version` | v22.22.2 |
| `psql --version` | cliente PostgreSQL 18.6 (Ubuntu) |
| paquetes del entorno existente | FastAPI 0.162.4, httpx 0.28.1, Uvicorn 0.54.0 |
| disponibilidad de sqlalchemy y psycopg por importlib | ambos ausentes |
| `git check-ignore` y `git ls-files` | exclusiones verificadas y sin secretos/cachés en índice actual |
| `git diff --check` | sin errores de espacios/conflictos |
| `git diff --stat main..feature/llm-voz` | cambios reales en main.py, app.js, requirements, .env.example, módulos, CSS, SW y tests, entre otros |

La prueba FastAPI se ejecutó fuera del sandbox por la limitación conocida de sockets
/TestClient; terminó correctamente con un aviso de deprecación de Starlette, no un
fallo. No se instalaron dependencias ni se descargaron modelos. No se ejecutaron
pruebas E2E de salas porque las rutas todavía no existen.

`psql --version` solo confirma el cliente: **no confirma servidor activo, base
agrovoz_pc3 existente, permisos, versión de servidor ni conectividad**. No se
estableció conexión PostgreSQL, no se consultaron bases ajenas y no se ejecutó SQL.
No se verificó generación Ollama: no es objetivo ni prerrequisito de diseñar salas.

## 5. Arquitectura propuesta y contratos acordables

Detalle completo, ER Mermaid, columnas/tipos/PK/FK/UNIQUE/índices/timestamps,
restricciones y ejemplos en [POSTGRES_DISENO.md](POSTGRES_DISENO.md).

Decisiones para implementar después:

- PostgreSQL `agrovoz_pc3`, schema `salas`, SQLAlchemy 2 + psycopg 3, Session por
  petición y servicio de dominio desacoplado de FastAPI.
- Entidades participants, rooms, memberships, alerts. Token demo aleatorio en
  Bearer, solo hash en DB; UUID/selector de usuario no otorgan acceso.
- Cada GET/POST privado verifica token y membresía. Invitar por código compartido;
  rotarlo solo por propietario. No confundirlo con identidad personal autenticada.
- `/api/rooms`: conservar convención/archivo del contrato existente; resolver en
  revisión de equipo el cambio de SQLite a PostgreSQL solicitado ahora.
- Alta de participante, crear/listar salas, unirse, regenerar invitación, publicar
  y leer alertas. Contratos con 401/403/404/409/422/429/503 y ejemplos ficticios.
- Idempotencia por sala/autor/request_id, unión única y creación repetible.
- Secuencia por sala incrementada bajo lock hasta commit; cursor estable y paginado
  para no perder publicaciones concurrentes. No confiar solo en UUID/timestamp.
- Polling de 4 s, una lectura en curso, deduplicación por alert.id y cancelación al
  cambiar contexto. Solo lectura avanza cursor; respuesta del POST no lo adelanta.
- Borrador conservado ante error, publicación solo tras confirmación de servidor;
  sin fallback silencioso a una alerta demo.

## 6. Configuración y seguridad previstas

El diseño incluye los valores **de ejemplo** para DATABASE_URL y URL de migración,
con usuarios dedicados y marcador de contraseña, dentro del documento. En esta
fase no se modifican `.env.example`, requirements ni `.env` local, reduciendo
conflictos con LLM y evitando introducir configuración parcial no funcional.

En Fase II:

1. Revisar la instalación/estado de PostgreSQL sin cambiar proyectos ajenos.
2. Provisionar, si procede, base y roles dedicados mediante administrador; la app
   no usa superusuario ni permisos de crear/borrar bases.
3. Runtime solo DML necesario en sus tablas; migrator separado para schema salas.
4. Aplicar init transaccional versionado, con validación de destino/checksum y
   bloqueo asesor. Repetir no duplica ni borra; incompatibilidades detienen el script.
5. Base y roles de prueba separados: agrovoz_pc3_test; TEST_DATABASE_URL explícita,
   bandera de escritura y comprobación real del nombre. Sin fallback a base real.

No ejecutar DROP DATABASE, TRUNCATE, borrado global ni reset de PostgreSQL como
parte de esta auditoría o de una recuperación automática. Si hay datos previos,
revisarlos antes de cualquier migración; no asumir que el nombre objetivo está vacío.

## 7. Plan de pruebas y aceptación del módulo futuro

**Todo en esta tabla es plan pendiente; no son resultados ejecutados.**

| ID | Caso de aceptación | Comprobación futura | Evidencia a capturar |
|---|---|---|---|
| AC1 | A crea sala | 201 y sala+owner confirmados; retry misma clave no duplica | HTTP y dos filas relacionadas en test DB |
| AC2 | B se une | token B distinto, código válido, 201; repetir 200 sin duplicar membresía | sesión aislada B y conteo de dos miembros |
| AC3 | A publica | tras revisión, 201 y una alerta; doble clic/retry devuelve mismo UUID | POST/cuerpo sin autor falsificable; conteo SQL |
| AC4 | B lee | polling GET desde contexto B obtiene alerta de A | Network y pantalla B sin copiar almacenamiento |
| AC5 | sobrevive recarga | nueva lectura obtiene mismo UUID/texto/fecha desde DB | recarga B y fila persistente |
| AC6 | rechaza ajenos | sin token 401; C no miembro 403 en leer/publicar; autor extra 422; miembro no owner no rota | respuestas y DB sin alertas no autorizadas |
| AC7 | errores FastAPI/PG | 503 genérico por configuración/DB; borrador y clave se conservan; reintento no duplica | error simulado seguro y recuperación |
| AC8 | concurrencia/cursor | dos escritores y lector no pierden filas, aun con rollback/lock | sesiones SQL independientes y feed final completo |
| AC9 | aislamiento y texto seguro | sala X no muestra Y; contenido tipo HTML nunca ejecuta | tests de permiso y renderizado como texto |
| AC10 | regresión | PC2 mantiene demo diferenciada; /health y /api/consult conservan contrato | pruebas originales y cruzadas al integrar |

Unitarios sin PG validan reglas/mapeos, no persistencia. Integración real exige
PostgreSQL de prueba; no reemplazarlo por SQLite para certificar restricciones.
Pruebas de concurrencia deben usar sesiones distintas y commits reales. Simular
fallos con dependency overrides/DSN inválida de prueba, sin apagar servidores
compartidos. Ver el plan ampliado y limpieza acotada de fixtures en el diseño.

## 8. Archivos previstos y riesgos de merge

| Fase | Archivos previstos | Alcance / coordinación |
|---|---|---|
| II backend | rooms_config.py, db/base.py, db/session.py, db/models_rooms.py | solo configuración y datos de salas |
| II contratos/servicio | schemas/rooms.py, services/rooms.py, routers/rooms.py y __init__ necesarios | no sobrescribir services/llm.py de otra rama |
| II integración | main.py | import/include_router; añadir Authorization en CORS sin reescribir LLM |
| II configuración | requirements.txt, .env.example | añadir ORM/driver/lector de config y URL PG sin sustituir variables LLM |
| II inicialización | migrations/rooms/001_initial.sql, scripts/init_rooms_db.py | versión repetible; solo schema dedicado tras revisión |
| II tests | tests/test_rooms_api.py, test_rooms_postgres.py, fixtures propias | base de prueba con guardas; no cambios a resultados históricos LLM |
| III frontend | modules/rooms-client.js, app.js con adaptadores mínimos | montar Comunidad real dentro de raíz propia; mantener demo explícita |
| III tests/evidencias | tests/rooms-client.test.cjs, rooms_e2e.*, docs de salas | dos contextos aislados y capturas reales; no copiar evidencias LLM |

Los nombres finales de tests pueden ajustarse al runner, sin alterar contratos.
En JS usar IDs/acciones prefijadas rooms- para evitar colisiones con alertForm,
confirm-alert y módulos LLM. Mantener borrador/estado en el módulo y actualizar
solo su raíz; no rerenderizar toda la app cada 4 s. Los hooks mínimos al renderizar,
entrar/salir de Comunidad o cambiar perfil deberán coordinarse con el autor LLM.

La comparación **de solo lectura** con feature/llm-voz confirma que allí cambiaron
main.py, app.js, requirements, ejemplo de entorno, estilos, service worker y tests.
No están fusionados aquí. Riesgo principal: reemplazar su main.py completo borraría
la modularización LLM; reemplazar app.js borraría estados, voz y preferencias.
Integrar hunks pequeños conservando ambos adaptadores; nunca copiar el archivo de
una rama encima del de la otra. .gitignore puede producir add/add, pero se adoptó
el mismo conjunto mínimo de exclusiones para facilitar resolución posterior.

CORS necesitará Authorization porque esta base solo permite Content-Type. Con
frontend en puerto 8080 y API 8000, el SW actual ignora otro origen; si más adelante
se sirve API en mismo origen, excluir /api/rooms del caché genérico antes de usar
respuestas privadas. No cambiar PWA ahora. No alterar docs de Enoc ni la matriz
compartida: estos dos archivos son el insumo separado para su integración.

## 9. Correspondencia con la rúbrica PC3

No se encontró la rúbrica PDF oficial en la búsqueda del workspace; se usa solo
el desglose conocido y `PC3_CHECKLIST_RUBRICA.md` como referencia interna.

| Criterio conocido | Aporte de esta fase de diseño | Pendiente para acreditar funcionalidad |
|---|---|---|
| Reporte de avance, 7 puntos | diagnóstico, arquitectura, modelo, contratos, AC1–AC10 y plan de pruebas | integración del informe/historias/matriz y capturas reales con calidad |
| Prototipo funcional al 70%, 7 puntos | define cómo demostrar multiusuario y persistencia entre dos contextos | implementar y ejecutar; este diseño no acredita 70% ni colaboración real |
| Sustentación personal, 4 puntos | guion: A crea, B se une, A publica, B lee/recarga y C es rechazado | video y demostración del aporte real de Maurizio |
| Calidad, 2 puntos | separación de módulos, integridad, permisos, idempotencia, pruebas aisladas y Git protegido | código, instalación reproducible, C4 final y revisión cruzada |

Capacidades obligatorias: este módulo se responsabiliza de **multiusuario,
colaboración y persistencia**, con estados comprensibles y confirmación previa.
No acredita voz, LLM, PWA completa, personalización global ni evaluación emocional;
corresponden a otras ramas o a integración final. No asignar nota /20 ni porcentaje
global del prototipo a partir de la presencia de estos documentos.

## 10. Puerta de entrada a Fase II

| Comprobación de preparación | Estado |
|---|---|
| rama correcta y trabajo conservado | verificado |
| código PC2 auditado y simulación identificada | verificado |
| pruebas de base y sintaxis | 8 UI + 3 backend aprobadas |
| arquitectura, ER, integridad y API | documentados, no implementados |
| autorización demo, concurrencia y polling | decisiones explícitas en diseño |
| estrategia de migración y test DB separados | documentada, no ejecutada |
| secretos/cachés fuera del índice y exclusiones | verificado |
| disponibilidad de DB/roles/driver y migración real | pendiente como tarea inicial de II |

**Sí: Fase I está preparada para comenzar Fase II de implementación.** Comenzar
por verificar/provisionar entorno dedicado e instalar dependencias revisadas;
ningún resultado de diseño implica autorización para modificar datos ajenos o
hacer migraciones destructivas. Implementación, SQL real y demostración A→B siguen
pendientes; no se presentan como realizadas.
