# Fase III — Salas y comunidad reales

Responsable: Maurizio. Rama verificada: `feature/salas-comunidad`.
Fecha de validación: 11/11/2026, America/Lima.

**FASE III APROBADA en el alcance de integración frontend de salas.**
Chrome, FastAPI y PostgreSQL reales demostraron colaboración entre sesiones con almacenamiento independiente. Las escrituras se ejecutaron exclusivamente en un clúster temporal con `agrovoz_pc3_test`. Esta fase no insertó datos de prueba en `agrovoz_pc3`, no aplicó migraciones a la base principal y no hizo commit, push ni merge. No acredita autenticación de producción ni el porcentaje global PC3.

## Implementación y compatibilidad

Se revisaron el diseño PostgreSQL, el informe de Fase II, los siete contratos implementados, la interfaz PC2 y sus pruebas. La colaboración PC2 comparte datos locales del navegador; la nueva opción Comunidad real obtiene salas y alertas del servidor. El modo inicial sigue siendo local y no se suben automáticamente alertas simuladas, consultas, fotografías ni historial.

`AgroVoz-App/modules/rooms-client.js` contiene el cliente HTTP, estado, persistencia por perfil y presentación. Usa exactamente `/api/rooms/participants`, `/api/rooms`, `/api/rooms/join`, `/api/rooms/{id}/invitations` y `/api/rooms/{id}/alerts`, con los métodos definidos en Fase II. La API local se encuentra en `http://127.0.0.1:8000`; un despliegue remoto requiere configurar su dirección y CORS antes de publicarlo.

Cada perfil guarda sesión demo, selección y borradores en `agrovoz_rooms_v1.<perfil_local>`. El token del servidor identifica una sesión de demostración de 24 horas, sin verificar identidad personal. Cambiar de perfil cancela solicitudes y utiliza otra clave. Los códigos de invitación solo se muestran al creador al generarlos y permanecen únicamente en memoria; el creador puede renovar uno mediante el contrato existente.

Se muestran salas propias, cantidad de participantes, rol propio y autores de las alertas. No existe endpoint de listado nominal de miembros: no se añadió ni simuló esa capacidad. La cantidad de miembros corresponde a la última actualización de salas.

El polling usa cursor `after_sequence`, paginación y deduplicación por ID. Programa la siguiente lectura unos cuatro segundos después de finalizar la anterior; ante errores espera 8, 16 y hasta 30 segundos. Se cancela al salir, cambiar perfil o sala y se pausa con la página oculta. Las respuestas tardías se descartan. El cursor solo avanza con lecturas confirmadas, sin saltar alertas por recibir antes la respuesta del POST propio.

La publicación conserva texto y `client_request_id` antes de enviar. Un timeout, error o recarga conserva ambos; el reintento usa el mismo cuerpo. La interfaz bloquea envíos concurrentes y confirma publicación solo tras una respuesta HTTP válida. Editar como nueva operación requiere advertencia porque el envío anterior pudo llegar. Los textos de usuarios se escapan y los mensajes de estado usan `textContent`.

## Archivos de esta fase

| Archivo | Cambio y finalidad |
|---|---|
| `AgroVoz-App/modules/rooms-client.js` | Cliente, sesiones aisladas, contratos, polling, borradores y vista de salas |
| `AgroVoz-App/app.js` | Importación, selector local/real y montaje/desmontaje desde Comunidad; navegación PC2 conservada |
| `AgroVoz-App/styles.css` | Estilos acotados de salas, foco y formularios coherentes con AgroVoz |
| `AgroVoz-App/sw.js` | Precaché del nuevo módulo, versión de caché y exclusión explícita de `/api/rooms` |
| `AgroVoz-App/modules/README.md` | Estado real del módulo y límites de integración entre ramas |
| `tests/smoke.test.cjs` | Adaptación del entorno VM al import; las ocho comprobaciones PC2 permanecen |
| `tests/rooms-client.test.cjs` | Trece pruebas del cliente con transporte y reloj controlados |
| `tests/rooms-browser.cjs` | Chrome con tres contextos independientes y API real |
| `tests/run_rooms_browser.py` | Orquestación de PostgreSQL/API temporales y conteos posteriores |
| Este informe y `docs/evidencias/SALAS_FASE_III_*` | Resultados reproducibles y captura |

No se modificó `index.html`: su carga de módulos existente admite el import. El ajuste del service worker es necesario para distribuir el módulo nuevo y evitar caché de respuestas privadas; no se evaluó instalación PWA completa. La lógica LLM y de voz conserva su implementación previa. Los cambios backend presentes en el workspace corresponden a Fase II y siguen pendientes de versionar junto con los nuevos archivos; no se asumió ninguna fusión de `feature/llm-voz`.

## Pruebas ejecutadas y evidencia

| Comando / evidencia | Resultado real |
|---|---|
| `node tests/rooms-client.test.cjs` | 13/13: registro, perfiles, confirmación HTTP, reintentos, timeout, offline, errores, cursor, backoff y cancelación |
| `node tests/smoke.test.cjs` | 8/8 comprobaciones PC2 |
| `backend/.venv/bin/python tests/backend_smoke.py` | 3/3 comprobaciones backend PC2 |
| `backend/.venv/bin/python tests/run_salas_checks.py` | 25/25: ocho unitarias y diecisiete PostgreSQL; además flujo HTTP real A→B tras reiniciar API |
| `backend/.venv/bin/python tests/run_rooms_browser.py` | PASS, nueve escenarios agrupados de navegador y conteos SQL exactos |
| `node --check` de `app.js`, `modules/rooms-client.js`, `sw.js` | Sin errores |
| `git diff --check` | Sin errores |

La regresión backend emite una deprecación de Starlette/TestClient sobre httpx; las pruebas finalizan correctamente. No se cambiaron dependencias para ocultarla.

La ejecución final de navegador terminó a las 03:15:20 America/Lima. Tres contextos privados de Chrome usan el mismo origen frontend con localStorage independiente. CDP cambia únicamente el puerto de la API local por el del servidor temporal; las respuestas proceden de FastAPI/PostgreSQL, sin mocks. El harness requiere el indicador de aislamiento y rechaza usar el puerto API habitual para evitar escribir en la base principal.

| Funcionalidad / aceptación | Evidencia final | Resultado |
|---|---|---|
| A crea sala y B registra otra sesión | IDs de participantes distintos, sala real y código solo del creador | PASS |
| B se une mediante código | Sala propia, rol miembro y dos participantes; B no recibe controles del creador | PASS |
| A publica y B recibe por polling | Mismo ID de alerta; entrega observada en **4.033 ms** | PASS |
| Recargar conserva acceso y alertas | B recupera su token propio y datos PostgreSQL | PASS |
| Tercero no miembro | GET y POST responden **403/403** | PASS |
| Reintento sin duplicados | Se pierde deliberadamente un HTTP **201** después del commit; recarga conserva UUID y replay confirma la misma alerta | PASS |
| Doble envío y contenido HTML | Envío concurrente bloqueado; etiqueta HTML mostrada como texto, sin ejecución | PASS |
| Cambiar perfil | Nueva sesión sin salas, token distinto; regreso recupera la sesión original | PASS |
| Backend inaccesible | Solicitudes bloqueadas en navegador; error visible, borrador y UUID conservados; sin publicación ficticia | PASS |
| Salir de Comunidad | Sin nuevas lecturas del feed durante 4,5 segundos posteriores | PASS |

Conteos finales del clúster de prueba: **4 participantes, 1 sala, 2 membresías y 2 alertas**. Son dos alertas para dos operaciones lógicas pese al reintento y al doble envío. El cuarto participante corresponde al segundo perfil local probado. La prueba de desconexión no creó una tercera alerta.

Evidencias sin tokens ni códigos de invitación:

- [Resultado Chrome](evidencias/SALAS_FASE_III_BROWSER.json).
- [Conteos PostgreSQL](evidencias/SALAS_FASE_III_POSTGRES.json).
- [Captura de B con ambas alertas](evidencias/SALAS_FASE_III_COMUNIDAD.png).
- [Regresión de Fase II](evidencias/SALAS_FASE_II_TESTS.json) y [flujo HTTP](evidencias/SALAS_FASE_II_HTTP.json).

Las primeras ejecuciones detectaron un problema de contexto al invocar temporizadores nativos desde el cliente; se corrigió con funciones envolventes y la repetición completa pasó. También se ajustó la interceptación CDP para perder efectivamente el acuse después del commit. Los archivos de evidencia anteriores contienen la ejecución final, no los intentos fallidos.

## Reproducción y revisión manual

Las pruebas automáticas se ejecutan desde la raíz con el entorno Python existente, PostgreSQL local instalado y Google Chrome. El runner crea y detiene sus propios procesos y clúster; requiere sockets locales habilitados. No necesita paquetes npm adicionales. No ejecutar pruebas de escritura manuales contra `agrovoz_pc3` si se quiere conservar la base principal vacía.

Para revisión visual con una API conectada a una base de prueba: iniciar el frontend por HTTP en localhost, abrir dos perfiles privados independientes y entrar en Comunidad → Comunidad real. Registrar A y B, crear una sala con A, compartir el código fuera de la aplicación y unir B. Publicar una observación, esperar unos cuatro segundos y recargar B. Con una tercera sesión probar el rechazo a la lectura/publicación. Desconectar el backend, escribir otra alerta y verificar error y conservación del texto; restaurarlo y reintentar la misma operación. Cambiar el perfil local y comprobar que solicita otra sesión. La prueba automatizada ya realizó estos escenarios; esta revisión sirve para la sustentación, no sustituye sus resultados.

## Riesgos, rúbrica y entrega

| Aspecto | Límite o coordinación necesaria |
|---|---|
| Sesión demo | Token en localStorage: no hay cuenta verificada, recuperación de identidad ni protección frente a quien controle el mismo navegador. Producción requiere autenticación y despliegue seguro propios. |
| Destino local | La dirección API actual sirve para demostración en el equipo. Dos equipos físicos requieren dirección accesible, orígenes permitidos y configuración de despliegue. La evidencia usa tres contextos del mismo equipo. |
| Membresías | Solo cantidad y rol propio disponibles; listado nominal necesita otro contrato backend acordado. |
| Invitación perdida | No se persiste el código; el creador debe renovarlo. Renovar invalida el anterior. |
| Perfil y almacenamiento | Borrar almacenamiento pierde la credencial demo; los datos persisten en PostgreSQL pero no se promete recuperar acceso sin token. |
| Polling | Cuatro segundos más duración de petición, con backoff ante fallos; 4.033 ms es una observación, no un SLA ni una prueba de carga. |
| Merge | `app.js`, `sw.js`, estilos y pruebas UI requieren revisar conflictos con LLM/voz y calidad; no copiar versiones completas encima de otra rama. Mantener router y contratos de Fase II. |
| PC3 | Aporta multiusuario, colaboración, persistencia y mensajes de estado/confirmación. No acredita por sí solo voz, calidad agrícola del LLM, instalación PWA, evaluación con agricultores, sustentación ni 70% global. |

**Veredicto: FASE III APROBADA para el módulo de salas en entorno de demostración local**, con regresiones y colaboración real verificadas. Lista para preparar la entrega de esta rama, manteniendo credenciales y configuraciones personales fuera de Git. No se realizó commit, push ni merge.
