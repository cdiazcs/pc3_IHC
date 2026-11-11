# Fase IV — Integración LLM/voz y salas PostgreSQL

Fecha: 11/11/2026, America/Lima. Rama: `integration/pc3`.

**Veredicto: LISTO PARA COMPLETAR MERGE**, con los límites de demostración indicados abajo. Se resolvió el merge existente sin crear commits, push, otro merge ni reset. El usuario debe revisar y completar el merge cuando lo decida.

## Estado Git observado

Al comenzar, `HEAD` era `89b14a3` y `MERGE_HEAD` era `96cb7c6`. Había nueve rutas sin resolver en `git ls-files -u`. `main` ya contenía el merge de LLM/voz; la premisa de ramas aún independientes ya no describía su estado actual.

La consulta real `git ls-remote --heads origin` confirmó:

| Referencia remota | Commit |
|---|---|
| main | `89b14a38fdee14d3edc08a59eadc6d485e369379` |
| feature/llm-voz | `4082cf627db47eb2c0f4434195a2a434d59d27b8` |
| feature/salas-comunidad | `96cb7c69c35b8b4864f22824c049cb9756c541d3` |
| docs/pc3-calidad | `e32e13d10d3431deeaccc01a0afcf90867b0c017` |

Coincidían con las referencias locales. La primera consulta remota falló por DNS en sandbox; su repetición autorizada funcionó. No se hizo fetch, cambio de rama ni modificación remota.

## Los nueve conflictos y su resolución

| Archivo real | Resolución |
|---|---|
| `.vscode/changelists.json` | Conflicto add/add de configuración personal. Se retiró exclusivamente del índice con `git rm --cached`; el archivo local se conserva con la configuración previa de HEAD, y el contenido conflictivo quedó respaldado en `/tmp/agrovoz_changelists_conflict.json`. `.vscode/` se añadió a `.gitignore`. La solicitud escribía `changeslists.json`; Git identifica `changelists.json`. |
| `AgroVoz-App/app.js` | Ambos imports y clientes. Se conservan flujo LLM, cancelación/reintento, voz, personalización, navegación y accesibilidad; se incorporan selector de comunidad real/local, montaje del cliente y cancelación al navegar. Se combinan panel de interacción y textos de estado, sin sustituir la lógica agrícola de una rama por la otra. |
| `AgroVoz-App/modules/README.md` | Documenta ambos clientes implementados y sus contratos; elimina afirmaciones de módulos todavía reservados. |
| `AgroVoz-App/styles.css` | Conserva estilos de consulta, foco, contraste y adaptación de LLM/voz, además de estilos acotados de salas. |
| `AgroVoz-App/sw.js` | Caché nueva `agrovozv4-integration` y precaché de ambos módulos. Las rutas `/api/` y solicitudes con Authorization quedan fuera del manejador de caché. Manifest y estrategia offline de recursos públicos conservados. |
| `backend/.env.example` | Variables Ollama/modelo/timeout y PostgreSQL runtime/migración/pruebas reunidas, con placeholders y sin contraseñas reales. `.env` no se modificó. |
| `backend/main.py` | Conserva `generate_advice`, validación, `/health` y `/api/consult`; añade import/include de salas y Authorization en CORS. No reintroduce el adaptador LLM antiguo de la rama salas. |
| `backend/requirements.txt` | Unión sin duplicados: FastAPI, Uvicorn, httpx, python-dotenv, SQLAlchemy 2 y psycopg 3. `pip check` no detectó incompatibilidades instaladas. |
| `tests/smoke.test.cjs` | El harness VM reconoce ambos imports y conserva AbortController. Ambos clientes están aislados explícitamente en pruebas PC2, manteniendo las ocho comprobaciones existentes. |

Se compararon las etapas base/HEAD/salas. Los archivos funcionales se combinaron por contenido; no se aplicó automáticamente `--ours` ni `--theirs`. Se marcaron como resueltos con `git add`, sin completar el merge.

## Cambios adicionales necesarios

- `tests/phase_ii_frontend.test.cjs`: el VM de LLM debe reconocer el import de salas y aislar su montaje. Sin ese ajuste, el harness no puede ejecutar la aplicación como script; se conservan sus quince casos de LLM/voz/personalización.
- `tests/phase_ii_browser.cjs`: la comprobación PWA usaba literalmente la caché antigua `agrovozv3-llm`. Ahora comprueba que ambos clientes estén disponibles mediante CacheStorage, incluida recarga offline.
- `tests/phase_iii_browser.cjs`: permite elegir prefijo de evidencia desde el entorno para separar ejecuciones de integración de resultados históricos.
- `tests/integration_sw.test.cjs`: comprueba exclusión de API/Authorization y precaché de ambos clientes.
- `tests/integration_pc3_live.py`: crea PostgreSQL temporal, inicia un único FastAPI, registra ambos routers y demuestra LLM real y colaboración A→B desde ese mismo servidor. No entrega credenciales a los informes.
- Este informe y nuevas evidencias `FASE_IV_*`: conservan resultados de integración. Los runners existentes generan nombres de fases previas; sus resultados se archivaron con prefijo Fase IV y se restauraron los originales versionados para conservar la evidencia histórica.

Los modelos, servicios, migraciones y router PostgreSQL se incorporan desde el merge de salas sin reestructurarlos. El servicio LLM, el cliente LLM y el manifest permanecen con su implementación de main.

## Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `node tests/smoke.test.cjs` | 8/8 comprobaciones PC2 |
| `node tests/phase_ii_frontend.test.cjs` | 15/15, flujo LLM, errores, cancelación, perfil, voz y personalización en DOM simulado |
| `node tests/rooms-client.test.cjs` | 13/13, salas, perfiles, polling, cursor, reintentos y borradores |
| `node tests/integration_sw.test.cjs` | 1/1, recursos de ambos módulos y exclusión de respuestas privadas |
| `backend/.venv/bin/python -m unittest discover -s tests -p 'test_phase*.py'` | 14/14, contrato LLM, configuración, validación, transporte, truncamiento y filtro de salida |
| `backend/.venv/bin/python tests/backend_smoke.py` | 3/3, health, proveedor ausente y entrada inválida |
| `backend/.venv/bin/python tests/run_salas_checks.py` | 25/25, incluyendo 17 PostgreSQL reales y 8 unitarias; además flujo HTTP A→B con reinicio de API |
| `backend/.venv/bin/python tests/run_rooms_browser.py` | PASS, nueve escenarios Chrome y conteos PostgreSQL exactos |
| `AGROVOZ_EVIDENCE_PREFIX=FASE_IV node tests/phase_iii_browser.cjs` | PASS, 16 comprobaciones en Chrome real, con Ollama local y recarga PWA offline |
| `backend/.venv/bin/python tests/integration_pc3_live.py` | PASS, ambos módulos en el mismo FastAPI temporal |
| `backend/.venv/bin/python -m pip check` | Sin dependencias rotas |
| `node --check` de app, SW y harness actualizado; `git diff --check` e inspección de conflictos | Sin errores al cerrar |

Los primeros intentos de composición detectaron errores en el script temporal de resolución; se reconstruyó la combinación desde las etapas originales del índice y se corrigieron antes de validar. Los resultados de esta tabla corresponden a los archivos finales funcionales.

### Evidencia real conjunta

[FASE_IV_CONJUNTA.json](evidencias/FASE_IV_CONJUNTA.json): una misma instancia FastAPI expone `/health`, `/api/consult` y siete operaciones de salas verificadas mediante OpenAPI. A crea/publica, B se une y lee; en esa misma API la consulta Ollama responde **HTTP 200 en 11,679 s**, proveedor `llama3.2:1b`. La lectura de alerta posterior devuelve 200. La respuesta LLM completa está registrada, con límites visibles de orientación no validada profesionalmente.

### Evidencia real de interfaz

- [Salas en Chrome](evidencias/FASE_IV_III_SALAS_BROWSER.json) y [conteos SQL](evidencias/FASE_IV_III_SALAS_POSTGRES.json): tres contextos de navegador independientes, recepción por polling observada en **4.465 ms**, persistencia tras recarga, tercero rechazado con 403/403, acuse 201 perdido y replay sin duplicado, cambio de perfil, borrador conservado al bloquear red y cancelación al salir. Cuatro participantes, una sala, dos membresías y dos alertas para dos publicaciones lógicas.
- [Captura comunidad](evidencias/FASE_IV_III_SALAS_COMUNIDAD.png).
- [LLM, accesibilidad y PWA en Chrome](evidencias/FASE_IV_LLM_NAVEGADOR.json): respuesta real, reintento al reconectar, teclado, modal de ayuda, consentimiento/personalización tras recarga, perfiles, contraste acotado, vistas 1280/640/360 px, micrófono denegado y precaché/offline de ambos clientes.
- [Captura interfaz LLM](evidencias/FASE_IV_LLM_NAVEGADOR.png).
- [Regresión PostgreSQL](evidencias/FASE_IV_II_SALAS_TESTS.json) y [flujo HTTP](evidencias/FASE_IV_II_SALAS_HTTP.json).

Todas las escrituras de estas pruebas se limitaron a clústeres temporales `agrovoz_pc3_test`. No se ejecutaron migraciones en `agrovoz_pc3`, ni operaciones destructivas sobre datos del usuario. Chrome usa perfiles propios y redirección CDP de puerto hacia servidores temporales, sin respuestas simuladas en las pruebas reales. No se usó el servidor habitual del usuario ni se imprimieron secretos.

## Estado final y límites

`git ls-files -u` queda vacío; no quedan marcadores en los archivos funcionales. La rama sigue siendo `integration/pc3`, HEAD y MERGE_HEAD conservan los commits iniciales y el merge permanece abierto, pendiente de commit. `.vscode/changelists.json` existe localmente pero ya no está versionado; `.env` continúa ignorado y fuera del índice.

No quedan errores funcionales bloqueantes en las pruebas ejecutadas. Starlette/TestClient emite un aviso de deprecación de httpx, sin fallos. No se modificaron dependencias para silenciarlo. Se conserva la limitación previa de calidad agrícola del modelo: estas pruebas certifican integración y filtros, no exactitud agronómica.

La prueba de voz en Chrome verifica permiso denegado y alternativa escrita; dictado físico y escucha audible siguen requiriendo validación humana. Las sesiones de salas son demo, no cuentas verificadas. La dirección API y CORS siguen orientados a localhost; un despliegue entre equipos requiere configuración acordada. Las pruebas no acreditan concurrencia de carga, instalación PWA en teléfonos ni el 70% global PC3.

**LISTO PARA COMPLETAR MERGE.** Revisar el diff preparado y completar el merge manualmente cuando corresponda; no se hizo commit, push ni un merge adicional.
