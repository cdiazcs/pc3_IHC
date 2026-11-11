# Auditoría Fase I — AgroVoz PC3

Fecha: 11 de noviembre de 2026 (America/Lima). Alcance: integración inicial FastAPI–Ollama. Plazo declarado: 14:30. Este informe no certifica la hora de entrega ni el 70% global.

## A. Implementación observada y fuentes

No se encontró `CC451-2026-2-PC3.pdf` en el workspace. Se utiliza la rúbrica transcrita por el solicitante: reporte 7 puntos, prototipo 7, sustentación 4 y calidad 2. `PC2IHCInforme.pdf` no sustituye la rúbrica oficial PC3.

El backend implementa `/health` y `/api/consult`, llama al endpoint compatible con OpenAI de Ollama (`/v1/chat/completions`) con `httpx` y devuelve un modelo Pydantic `Advice`. La entrada conserva `crop` (1–60 caracteres) y `question` (8–700), ahora tras quitar espacios al principio/final. Salida: cinco strings (`headline`, `observation`, `source`, `limitations`, `provider`) y `steps: list[str]`. No cambió el contrato.

Solo `observation` contiene el texto generado por el proveedor; titular, pasos, fuente y límites son envoltorios explícitos del adaptador. No se debe presentar ese envoltorio como generación ni como recuperación documental. No hay RAG ni análisis de fotografías.

`AgroVoz-App/app.js`, función `makeRecord()`, llama al backend solamente con modo `server` y conexión. En modo demo u offline llama a `mockAdvice()`; las respuestas demo siguen siendo simuladas. Si falla el backend en modo conectado, informa del error y no sustituye silenciosamente la generación con un mock. No se ejecutó navegador en esta auditoría; la ruta real completa desde la UI sigue necesitando evidencia manual.

### Entorno verificado

- Rama: `feature/llm-voz`. Estado inicial: `.vscode/`, `backend/.env`, `backend/__pycache__/` sin seguimiento. Se conservaron los archivos y la configuración del usuario.
- Python del sistema y del entorno: 3.14.4. Entorno existente: `backend/.venv`.
- Versiones instaladas: FastAPI 0.162.4, Uvicorn 0.54.0, httpx 0.28.1, python-dotenv 1.2.4. `pip check`: sin dependencias rotas. No se instalaron paquetes.
- Ollama real en `127.0.0.1:11434`: versión 0.40.13. `/api/tags` contiene `llama3.2:1b`, 1.2B, Q8_0, tamaño en disco 1.321.098.329 bytes.
- `.env`: las tres variables exigidas existen y no están vacías. Se comprobó mediante booleanos que URL y modelo coinciden con Ollama local y `llama3.2:1b`; no se imprimieron valores secretos. La clave local puede quedar vacía; no se cambió el archivo del usuario. Las pruebas reales fijan explícitamente clave vacía y destino local, sin servicios de pago.
- Antes faltaba `.gitignore`. Después, `git check-ignore` confirma exclusión de `.env`, `.venv` y `__pycache__`; `git ls-files` confirma que esos archivos no están versionados en el índice actual. No se afirma una revisión de secretos de todo el historial.
- La configuración se carga desde `backend/.env`, independientemente del directorio de arranque, con prioridad para variables ya exportadas.

## B. Requisitos verificables de Fase I

Cada fila pesa lo mismo. Solo se cuentan filas **cumplidas**: las parciales, pendientes y bloqueadas no aportan puntos. No se incluyen voz, PWA, salas, video ni porcentaje global de pantallas en el denominador.

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| I01 | Rama y cambios existentes inspeccionados y conservados | Cumplido | `git status`, rama actual; sin cambio de rama |
| I02 | Python y dependencias compatibles disponibles | Cumplido | versiones, `pip check`, ejecución real |
| I03 | Variables locales verificadas y carga reproducible | Cumplido | inspección sin secretos, `load_dotenv`, guía README |
| I04 | Secretos, entorno y cachés excluidos y no versionados | Cumplido | `.gitignore`, `check-ignore`, `ls-files` |
| I05 | Ollama accesible y modelo exacto instalado | Cumplido | `/api/version`, `/api/tags` |
| I06 | Health 200 y semántica limitada a configuración | Cumplido | prueba automática y servidor real |
| I07 | Entrada crop/question validada | Cumplido | casos 422 y consulta real |
| I08 | Generación real FastAPI–Ollama | Cumplido | Uvicorn temporal, HTTP 200, proveedor `llama3.2:1b` |
| I09 | Seis campos y tipos compatibles | Cumplido | aserciones del contrato, respuesta real |
| I10 | Texto real distinguible del mock y metadatos fijos | Cumplido | flujo Python/JS y petición real |
| I11 | Inaccesible, modelo ausente, timeout, entrada y JSON inválidos | Cumplido | MockTransport explícito, casos 422/502/503 |
| I12 | Calidad: español sencillo, incertidumbre, sin fuentes inventadas ni diagnóstico definitivo | Parcial | muestra real con problemas de claridad y truncamiento; evaluación final abajo |
| I13 | Latencia y recursos medidos sin forzar sistema | Cumplido | tiempo real y observación de memoria; límites abajo |
| I14 | Pruebas existentes, mínimas nuevas y sintaxis | Cumplido | 8 UI + 3 backend existentes + 8 pruebas nuevas |
| I15 | Guía, informe y revisión de integración | Cumplido | README, este archivo, diff y base local |

**Cumplimiento conservador: 14/15 = 93,33%.** La calidad de la respuesta requiere cerrar la evidencia descrita en I12; no se otorgan fracciones a una fila parcial.

## C. Comandos y resultados reales

Desde la raíz, usando el entorno existente:

| Comando | Resultado |
|---|---|
| `git branch --show-current` | `feature/llm-voz` |
| `git status --short` | estado inicial y final revisados; sin eliminar trabajo previo |
| `backend/.venv/bin/python --version` | Python 3.14.4 |
| `backend/.venv/bin/python -m pip check` | `No broken requirements found.` |
| `curl --max-time 5 -sS http://127.0.0.1:11434/api/version` | Ollama 0.40.13 |
| `curl --max-time 5 -sS http://127.0.0.1:11434/api/tags` | modelo exacto instalado |
| `backend/.venv/bin/python tests/backend_smoke.py` | PASS 3/3: health, sin configuración y entrada inválida |
| `backend/.venv/bin/python tests/test_phase_i.py` | OK, 8 pruebas; incluyen múltiples subcasos |
| `node tests/smoke.test.cjs` | 8/8 comprobaciones de lógica UI |
| `node --test tests/smoke.test.cjs` | 1 archivo/suite aprobado; contiene las 8 comprobaciones anteriores |
| `node --check AgroVoz-App/app.js` | salida 0 |
| `backend/.venv/bin/python -m py_compile backend/main.py tests/test_phase_i.py tests/phase_i_live.py` | salida 0 |
| `git check-ignore backend/.env backend/.venv/bin/python backend/__pycache__/main.cpython-314.pyc` | tres rutas excluidas |
| `git ls-files backend/.env '*/__pycache__/*' '*venv*'` | sin archivos en seguimiento |
| `git rev-list --left-right --count main...HEAD` | `0 0`: misma base de commits local al auditar |
| `git diff --check` | sin errores de espacios/conflictos |

El sandbox bloqueó sockets de `curl` y dejó esperando la primera ejecución de TestClient. Las comprobaciones de red y las pruebas FastAPI se repitieron con autorización fuera del sandbox y finalizaron. No son fallos de la aplicación. Starlette emite un aviso de deprecación del transporte httpx de TestClient, sin fallos; no se añadió una dependencia de producción para silenciarlo.

### Prueba real reproducible

Comando: `backend/.venv/bin/python tests/phase_i_live.py`. Este script crea y termina solo su propio servidor Uvicorn en un puerto local libre, sin alterar el servidor habitual ni Ollama. Usa el endpoint real, no MockTransport ni TestClient. Valida los seis campos y sus tipos. Pregunta: “Las hojas están amarillas. No sé la causa. ¿Qué puedo revisar sin aplicar químicos?”, cultivo papa.

1. Antes de corregir el timeout: `/health` 200 con configuración verdadera; consulta 502 tras **28,036 s**. Esto demuestra por qué health no acredita inferencia.
2. Con timeout 120 s: `/health` 200; consulta **200 en 34,903 s**. Contrato correcto. El texto generado usó “pueden ser” y no citó fuentes ni diagnosticó de forma definitiva, pero incluyó “mirador o espejo”, sugerencias poco justificadas de modificar riego/fertilización y terminó “agrónomo o a”. El límite `max_tokens=350` puede cortar la respuesta. El prompt por sí solo no garantiza calidad.
3. Se ajustó el prompt a un párrafo de máximo 100 palabras, frases completas y observaciones seguras sin cambios de riego/fertilización sin datos. Resultado de repetición final: **HTTP 200 en 9,344 s**, `/health` 200; contrato y tipos correctos. La respuesta fue breve y completa, usó “es posible” y no inventó fuentes ni emitió diagnóstico definitivo. Aun así dijo “Puedes intentar aplicar un poco de agua y ver si la coloración cambia”, pese a pedir observaciones sin cambios de riego sin datos. I12 permanece parcial por prudencia y calidad, aunque el truncamiento no apareció en esta repetición.

**Limitación de calidad:** los tests simulados acreditan transporte, contrato y manejo de errores, no la exactitud agrícola. Falta una pequeña batería real de preguntas variadas y revisión humana de claridad, incertidumbre, fuentes y frases completas; conservar las respuestas obtenidas. No se certifica calidad general a partir de una sola muestra ni del prompt.

### Rendimiento y recursos

Se observó Intel Core i5-1035G1, 8 CPU lógicas. `free -m`: 6.950 MiB totales visibles, 851 MiB disponibles, swap 4.095 MiB con 4.080 MiB usados. `/api/ps`: modelo cargado de 1.523.497.041 bytes (~1,42 GiB), VRAM 0, contexto efectivo 4096. Es una fotografía del equipo durante la auditoría; el resto de aplicaciones también consume memoria. `ps -C ollama` mostró 20.152 KiB RSS del servidor, que **no incluye por sí solo todo el consumo del runner**. No se midió pico de RAM ni CPU del proceso de inferencia, ni se atribuye toda la presión de memoria a Ollama.

La latencia exitosa de 34,903 s ya excede el timeout anterior de 28 s. Se conservan temperatura y límite de tokens; únicamente se amplió la espera configurable del cliente HTTP (120 s por operación de red; no es una garantía de duración total). Sin cambios de swap, hilos, prioridad, servicios ni parámetros del modelo. No es un benchmark ni una prueba de concurrencia. Revisar la experiencia de espera en Fase II y acordar un objetivo de latencia demostrable.

## D. Archivos revisados y modificados

Revisados: `README.md`, `PC3_EMPEZAR_AQUI.md`, `docs/PC3_RAMAS_Y_CONTRATOS.md`, `docs/PC3_CHECKLIST_RUBRICA.md`, `docs/MATRIZ_TRAZABILIDAD.md`, `docs/PLAN_PRUEBAS.md`, `backend/main.py`, `backend/requirements.txt`, `backend/.env.example`, presencia/configuración de `backend/.env` sin divulgar secretos, `AgroVoz-App/app.js`, `AgroVoz-App/package.json`, `AgroVoz-App/sw.js`, `AgroVoz-App/manifest.webmanifest`, `AgroVoz-App/icons/leaf.svg`, `tests/backend_smoke.py`, `tests/smoke.test.cjs`, `LICENSE` y listado de diagramas/capturas.

Ausentes inicialmente: `.gitignore` (creado), rúbrica PDF PC3 y archivos `AGENTS.md` en el workspace. Los demás archivos solicitados existen. No se asume que las capturas PC2 existentes acrediten ejecución PC3.

Modificados: `backend/main.py`, `backend/requirements.txt`, `backend/.env.example`, `README.md`. Creados: `.gitignore`, `tests/test_phase_i.py`, `tests/phase_i_live.py`, `docs/FASE_I_AUDITORIA.md`. `.vscode/` se conserva sin editar; `.env` no se modifica. No se modificaron UI, salas, comunidad, manifest, service worker ni diseño.

## E. Errores y correcciones

| Hallazgo | Corrección / estado |
|---|---|
| `.env` local no se cargaba por el adaptador | carga por ruta absoluta relativa a main.py, sin sobrescribir entorno exportado |
| `.env` y cachés aparecían como candidatos a Git | exclusiones nuevas; no hubo que quitar secretos del índice actual |
| Ejemplo usaba `llama3.2` sin variante exacta | `llama3.2:1b` en ejemplo |
| Espacios cumplían longitudes mínimas | Pydantic elimina espacios y devuelve 422 cuando corresponda |
| Timeout 28 s insuficiente en consulta observada | timeout configurable 1–300 s, default 120; valores inválidos → 503 |
| Solo tres pruebas básicas de backend | ocho pruebas nuevas con subcasos de proveedor y contrato; script real separado |
| Respuesta demasiado larga/incompleta y consejos poco fundamentados | prompt más breve y prudente; calidad general aún parcial |
| README enfocado en PC2 y comando Windows | sección Ubuntu de Fase I con modo real, pruebas y limitaciones |

No se modificó el contrato ni se añadió fallback agrícola fijo. Para proveedor inexistente, fallo HTTP, timeout y JSON inválido se conserva 502; ausencia de configuración devuelve 503; validación de entrada 422.

## F. Trazabilidad de capacidades y evidencias PC3

| Capacidad | Estado | Archivo/módulo | Evidencia real disponible | Aceptación necesaria | Responsable/fase sugerida |
|---|---|---|---|---|---|
| Interfaz de voz | Implementado sin probar | `app.js`: `startVoice`, `speak`, `confirmQuery` | código de reconocimiento es-PE, texto editable, confirmación y reproducción; sin sesión de micrófono | dictar, corregir, confirmar, escuchar/pausar/detener; permiso denegado y alternativa escrita | Cristian / Fase II |
| LLM real | Verificado (transporte); calidad parcial | `backend/main.py`, `app.js:makeRecord` | Ollama exacto instalado, generación real HTTP 200, tipos comprobados | capturar consulta desde UI en modo servidor y respuestas variadas claras y completas | Cristian / cierre Fase I y Fase II |
| PWA | Implementado sin probar | `manifest.webmanifest`, `sw.js`, `icons/leaf.svg` | manifiesto y caché de recursos presentes; no se probó instalación | instalar desde localhost/HTTPS, recargar offline tras carga inicial, capturar DevTools | responsable PWA / integración |
| Personalización persistente | Verificado en lógica local | `app.js`: `load`, `save`, sugerencia tras uso, preferencias | prueba UI 8/8 incluye aceptación y reversión; localStorage, sin sincronización servidor | recarga real del navegador, persistencia por perfil y revocación; guardar evidencias | Cristian + calidad / Fase II |
| Multiusuario y colaboración | Simulado | `app.js`: `defaults`, `db.alerts`, `syncQueue` | perfiles y alertas locales; pruebas de aislamiento lógico local | A publica y B lee en sesiones/dispositivos independientes contra persistencia compartida | Maurizio / `feature/salas-comunidad` |
| Diseño emocional | Implementado sin probar | `index.html`, `styles.css`, mensajes y flujos de `app.js` | indicios: visceral (iconos/colores), conductual (revisión/feedback), reflexivo (autonomía/preferencias); sin evaluación de usuarios | documentar los tres niveles con capturas y valoración de agricultores, sin confundir intención con efecto demostrado | Enoc + equipo / calidad |

Capturas manuales pendientes para PC3:

1. Terminal con versión/modelo Ollama y servidor ejecutándose, sin `.env` ni claves visibles.
2. `/health` 200 con nota “solo configuración”, petición real y respuesta completa en `/docs` o cliente HTTP, tiempo y proveedor.
3. UI en modo LLM con texto revisado, respuesta y límites; diferenciar visualmente la evidencia demo existente.
4. Casos 422/502/503 y salida de pruebas con fecha/contexto.
5. Voz y PWA en navegador, preferencias tras recarga y, cuando exista, colaboración en dos sesiones. No presentar la simulación como colaboración real.

## G. Relación con los cuatro criterios

| Criterio | Aporte de esta auditoría | Lo que todavía no acredita |
|---|---|---|
| Reporte de avance (7) | estado verificable, contrato, trazabilidad, pruebas y lista de evidencias | historias/criterios PC3 completos y capturas de todos los módulos |
| Prototipo funcional al 70% (7) | integración LLM realmente ejecutada y errores controlados | 70% de pantallas/módulos/código; voz, instalación PWA y colaboración real |
| Sustentación y participación (4) | guion posible: mostrar integración, límites, errores y aporte | no se verificó video, reparto, 3 min por integrante ni duración total ≤9 min |
| Calidad y entregables (2) | guía Ubuntu, pruebas, .gitignore y MIT existente; diagramas C4 presentes | C4 actualizado contra código final, revisión completa de entregables/ZIP y disponibilidad remota GitHub |

README contiene enlace GitHub y datos demo identificados. No se hizo fetch ni comprobación remota del repositorio. Los archivos C4 y LICENSE existen; su presencia no sustituye validación de arquitectura ni entrega.

## H. Riesgos y coordinación

- Calidad agrícola débil del modelo pequeño y salida que puede truncarse: mantener límites visibles y cerrar I12 con evidencia real.
- Presión de RAM/swap y latencia variable: 120 s evita el fallo temprano observado, sin asegurar respuesta rápida o estable bajo carga.
- UI inicia en demo; offline sigue generando orientación simulada. Una grabación incorrecta puede demostrar solo un mock.
- Frontend no probado en navegador; el backend real y el cliente JS no equivalen a una prueba E2E.
- Multiusuario es simulado; instalación PWA, voz y los tres niveles emocionales requieren evidencia propia.
- Las versiones tienen rangos, sin lockfile; futuras instalaciones pueden diferir. Aviso actual de TestClient no invalida las pruebas ejecutadas.
- `git rev-list` local da `0 0` con main; no había divergencia de commits. No se verificó main remoto actualizado ni se hizo merge de prueba. `backend/main.py` y README son puntos de coordinación con otras ramas; no se tocaron módulos de salas. Las nuevas pruebas/docs deben coordinarse con calidad.
- No se hizo commit, push, merge, cambio de rama, eliminación de archivos ni sobrescritura de trabajo de terceros. Este informe no estima una nota /20.

## I. Criterios para iniciar Fase II

1. Mantener en verde las pruebas automáticas de Fase I y las existentes.
2. Conservar la reproducción de generación real y el contrato, con errores 422/502/503 claros.
3. Cerrar I12: probar varias preguntas agrícolas reales con el prompt final, registrar respuestas completas en español sencillo, incertidumbre y ausencia de fuentes o diagnósticos inventados. Revisión humana de claridad y prudencia; no exige atribuir validación profesional inexistente.
4. Acordar con el equipo la latencia admisible y la evidencia de UI; la voz y mejoras de espera pertenecen a Fase II.
5. Coordinar cambios mínimos en main.py/README; no iniciar trabajo de salas ni reestructurar UI desde esta rama.

**Veredicto conservador: FASE I AÚN INCOMPLETA**, por I12 parcial. La conexión real y el contrato están verificados. No significa que la auditoría haya quedado sin ejecutar: los pendientes de producto y de evidencia quedan identificados para su cierre.
