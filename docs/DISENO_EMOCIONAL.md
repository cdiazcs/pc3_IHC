# Fase 2 — Diseño emocional y navegación por voz

Fecha: 11/11/2026, America/Lima. Rama conservada: `main`.
Alcance: exclusivamente Fase 2; se conservan los cambios previos de personalización y del usuario. Sin commit, push, merge, cambio de rama, lectura de `.env`, migraciones o modificaciones backend.

**Estado: implementación funcional probada en lógica/DOM; validación visual parcial.** El zoom CSS 200 % presenta un pendiente explícito. Dictado físico, escucha audible, vibración de hardware, zoom nativo y revisión con lector de pantalla requieren evidencia manual. No se certifica cumplimiento WCAG completo ni efecto emocional demostrado en usuarios.

## 1. Norman aplicado a AgroVoz

El nivel visceral corresponde a la primera percepción de la interfaz; el conductual, a su comprensión y funcionamiento durante una tarea; el reflexivo, a cómo el usuario interpreta y valora la experiencia. Aquí se implementan mecanismos observables en esos tres niveles. Su presencia no demuestra que agricultores experimenten una emoción determinada: ese resultado necesita evaluación con usuarios.

| Nivel | Funcionalidad | Archivo y referencia actual | Función / mecanismo | Evidencia |
|---|---|---|---|---|
| Visceral | Identidad verde agrícola y brote breve de bienvenida | `AgroVoz-App/app.js:164`, `styles.css:53` | `pageInicio`, `.welcome-sprout`, keyframes `sprout-in` | Chrome observa bienvenida; no bloquea navegación |
| Conductual | Estado accesible, indicador Ollama y cancelación | `app.js:43` | `setInteraction`, `interactionPanel`, `cancelActiveQuery` | Regresiones frontend de consulta, errores y duplicados |
| Conductual | Micrófono con pulso y modos separados | `app.js:89`, `app.js:114`, `app.js:273` | `voiceControls`, `startCommands`, `startVoice`, `cancelListening` | Pruebas DOM de exclusión, permisos y dictado |
| Conductual | Guardado confirmado y vibración opcional | `app.js:85`, `app.js:372`, `modules/rooms-client.js:220` | `sensorySuccess`, guardado de parcela, callback `onPublished` | Pruebas de persistencia fallida y HTTP pendiente/error/replay |
| Reflexivo | Valoración corregible de orientación real | `app.js:74` | `learningFeedback`, evento `feedback` de Fase 1 | Pruebas de aislamiento, voto único y learning OFF |
| Reflexivo | Resumen semanal con fechas reales | `modules/personalization.js:14` | `weeklySummary`, `weeklyView` | Cinco pruebas específicas de resumen/consentimiento |
| Accesibilidad transversal | Movimiento reducido y controles táctiles | `styles.css:64`, `styles.css:69` | Media query, foco y botón Comandos | Chrome: animación none y botón 118,91×44 CSS px |

Las referencias corresponden al código de esta entrega; no son capturas de versiones anteriores.

## 2. Nivel visceral

Se conservan paleta, tipografía, iconografía agrícola y tarjetas existentes. La figura local de brote se anima con CSS durante 650 ms, una vez al mostrar Inicio por primera vez en la carga de página. Los siguientes renderizados y visitas a Inicio en esa carga son estáticos. No hay recursos de imagen remotos ni bibliotecas nuevas. El contenido y los controles permanecen disponibles durante la animación.

`prefers-reduced-motion: reduce` desactiva bienvenida, pulso y barra animada; el estado textual permanece. Se ajustó el reflujo del encabezado al añadir Comandos. Chrome midió las seis pantallas principales sin desborde horizontal a 360, 768 y 1280 CSS px.

## 3. Nivel conductual

### Micrófono y procesamiento

El pulso aparece solo si existe reconocimiento activo y el estado es Escuchando. Al terminar la captura se comunica Procesando voz; un resultado permite revisar la transcripción. Se conserva detener dictado para recibir su resultado final y se añade Cancelar escucha para abortarlo. No hay inicio automático.

Los dos modos usan la misma referencia `recording`. No se permite comenzar otra escucha mientras esté activa o cancelándose; se espera `onend` antes de liberar el recurso. El cambio de perfil o ruta cancela el reconocimiento, y sus respuestas tardías se descartan. Iniciar escucha detiene síntesis; iniciar lectura cancela escucha para evitar ejecutar comandos a partir del audio reproducido.

### Ollama

Se conserva el cliente real, el indicador `aria-busy`, la animación de procesamiento, la cancelación y el bloqueo de envío duplicado. La animación termina con éxito, error o cancelación. El anuncio persistente solo se actualiza si el mensaje cambia. No se sustituyen respuestas fallidas por orientación demo, ni se modifica el prompt agrícola o el contrato `/api/consult`.

### Guardado y retroalimentación sensorial

Añadir un cultivo a parcelas muestra éxito solo si `save()` devuelve verdadero. Si falla, se revierte la adición en memoria y aparece un error. Las alertas reales mantienen el éxito después de recibir HTTP válido y validar el contrato; el nuevo callback `onPublished` se ejecuta exclusivamente entonces, sin emitirlo en errores ni replays. No afecta peticiones, claves idempotentes, cursor o membresías.

La vibración de 35 ms está desactivada por defecto. Mi perfil permite aceptarla y desactivarla; además, no se ejecuta con movimiento reducido. Se protege ausencia de `navigator.vibrate`, falta de soporte y excepciones. No se añadieron sonidos de confirmación, por lo que no hay audio adicional que cancelar ni posible bucle por un tono nuevo. La síntesis de respuestas existente conserva sus controles y preferencia propia.

La confirmación local PC2 sigue etiquetada como demostración y separada de las alertas reales. No se presenta como colaboración PostgreSQL.

## 4. Nivel reflexivo y continuidad de Fase 1

Después de una consulta real se muestra **¿Te sirvió esta orientación?**, con Sí/No y estado `aria-pressed`. Solo una pulsación registra la valoración. Se usa la operación de personalización de Fase 1, con un voto vigente por ID de respuesta; cambiarlo sustituye el anterior. Los perfiles permanecen aislados y OFF impide guardar nuevas valoraciones. Una valoración no modifica ni regenera la respuesta del LLM. La valoración de consultas demo previa se conserva con rótulo explícito de demostración y no alimenta el resumen de consultas LLM.

El objeto de personalización versión 1 se extiende de forma compatible mediante `events`, inicializado solo al existir eventos nuevos fechados. Se guardan eventos de consultas **LLM terminadas correctamente** y de valoraciones sobre respuestas reales. Cada evento contiene ID local de respuesta, fecha y los campos mínimos de modalidad/cultivo o voto; no contiene texto, emoción, audio, fotografías ni credenciales. No se transforma el historial anterior ni los contadores acumulados en eventos fechados inventados.

Inicio muestra **Tu semana con AgroVoz** sobre una ventana móvil de siete días hasta la fecha actual: consultas, cultivo predominante, modalidad y valoraciones realizadas en el periodo. Excluye fechas inválidas y futuras; los empates son explícitos. Sin consultas nuevas suficientes muestra **No hay datos suficientes**. Con learning OFF no se calcula el resumen ni se registra el diario nuevo, y se conservan datos anteriores.

El diario conserva como máximo 500 eventos; si se recorta se anuncia esa limitación. Corregir una valoración sustituye su evento fechado. Olvidar valoraciones elimina sus eventos; olvidar modalidades, cultivos, ritmo o franjas elimina también eventos detallados de consultas, para que el resumen no reconstruya lo olvidado. Los demás conteos acumulados de Fase 1 se conservan según la categoría elegida. Restablecer aprendizaje elimina el diario junto con sus métricas, sin borrar historial, preferencias o PostgreSQL.

## 5. Navegación por voz

Botón visible **🎙️ Comandos** en todas las pantallas y ayuda expandible con lista accesible. El parser puro `modules/voice-commands.js:2` normaliza mayúsculas, espacios y tildes, pero solo acepta frases completas de la lista, sin puntuación adicional ni instrucciones compuestas:

| Frase | Resultado |
|---|---|
| ir a inicio | Inicio |
| ir a parcelas | Mis parcelas |
| ir a consultar | Consultar |
| ir a historial | Historial |
| ir a comunidad | Comunidad, con modo local/real existente |
| ir a perfil | Mi perfil |
| leer respuesta | Reutiliza síntesis sobre la última respuesta real disponible del perfil |
| detener | Cancela lectura y escucha; no publica, consulta ni modifica datos |

Dictado introduce texto y nunca llama al parser: dictar “ir a inicio” en Consultar conserva esa frase como pregunta, sin navegar. Comandos no escribe en la pregunta, no guarda transcripciones y no las envía al LLM. Solo anuncia la acción reconocida mediante texto controlado por la aplicación.

Si no hay respuesta real propia, leer respuesta comunica la ausencia sin leer una demo o datos de otra cuenta. Un comando desconocido comunica: **No entendí el comando. Puedes intentarlo otra vez o usar los botones.**

Sin SpeechRecognition, o con permiso denegado, ausencia de voz o error, enlaces y botones siguen disponibles. La Web Speech API depende del navegador y puede necesitar internet y servicios del fabricante; AgroVoz no promete reconocimiento local/offline. No se certifica la captura acústica a partir del parser ni de los dobles de reconocimiento utilizados en pruebas DOM.

## 6. Archivos de Fase 2

| Estado | Archivo | Cambio |
|---|---|---|
| Nuevo | `AgroVoz-App/modules/voice-commands.js` | Parser estricto y puro |
| Modificado | `AgroVoz-App/app.js` | Comandos, coordinación de escucha, bienvenida, confirmación real y vibración optativa |
| Modificado sobre Fase 1 | `AgroVoz-App/modules/personalization.js` | Diario fechado mínimo y resumen semanal, eliminación coordinada |
| Modificado | `AgroVoz-App/modules/rooms-client.js` | Callback sensorial posterior al HTTP confirmado |
| Modificados | `AgroVoz-App/styles.css`, `AgroVoz-App/sw.js` | Estados, tamaños, movimiento reducido; precaché del nuevo módulo y versión `agrovozv6-emotional-voice` |
| Nuevos | `tests/voice-commands.test.cjs`, `tests/emotional-design.test.cjs` | Parser y resumen/consentimiento |
| Nuevo | `tests/emotional-browser.cjs` | Verificación en Chrome con servidor estático temporal; no inicia backend ni abre `.env` |
| Modificados | `tests/phase_ii_frontend.test.cjs`, `tests/rooms-client.test.cjs` | Integraciones de voz, persistencia y callback HTTP |
| Modificados | `tests/smoke.test.cjs`, `tests/integration_sw.test.cjs` | Carga del parser real en VM y comprobación de precaché |
| Nuevos | Este documento y `docs/evidencias/FASE_2_*` | Evidencia real y diagnóstico pendiente |

Backend, modelos PostgreSQL, migraciones, manifest y contratos no se modificaron. Las eliminaciones documentales preexistentes del usuario no se restauraron ni ampliaron.

## 7. Pruebas ejecutadas

| Ejecución | Resultado real final |
|---|---|
| `node --check AgroVoz-App/app.js` y checks de módulos/SW/script de navegador | Sin errores de sintaxis |
| `node --test tests/*.test.cjs` | **7 archivos aprobados, 0 fallos** |
| `node tests/voice-commands.test.cjs` | **10/10**: ocho frases, normalización y rechazo estricto |
| `node tests/emotional-design.test.cjs` | **5/5**: fechas, ventana, voto único, aislamiento y OFF |
| `node tests/phase_ii_frontend.test.cjs` | **29/29**: conserva 22 anteriores y añade siete de comandos/feedback |
| `node tests/personalization.test.cjs` | **20/20**, regresión Fase 1 |
| `node tests/rooms-client.test.cjs` | **14/14**, incluye espera HTTP, error y replay sin señal falsa |
| `node tests/integration_sw.test.cjs` | **1/1**, API privada excluida y módulos precacheados |
| `node tests/smoke.test.cjs` | **8/8** comprobaciones PC2 |
| `node tests/emotional-browser.cjs` | **PARTIAL**: comprobaciones visuales descritas abajo; pendiente de zoom explícito |
| `git diff --check -- AgroVoz-App tests` | Sin errores en código/pruebas de estas fases |
| `git diff --check` global | Dos avisos preexistentes en documentos del usuario, conservados |

Se investigaron los fallos antes de continuar: un cierre de cadena en el HTML de ayuda, expectativas de micrófono cuyo doble no emitía `onend`, una prueba que intentaba reasignar `save` constante en vez de provocar fallo real de storage, uso incorrecto del método del harness de borradores y un selector mal escapado del script Chrome. Todos fueron corregidos y las pruebas de lógica se repitieron hasta pasar. Chrome también detectó la precedencia del estilo `.btn.small`: se corrigió y midió Comandos a 44 px de alto.

### Evidencia Chrome

[Informe de navegador](evidencias/FASE_2_DISENO_NAVEGADOR.json), [captura de Inicio](evidencias/FASE_2_DISENO_INICIO.png) y [diagnóstico de zoom CSS](evidencias/FASE_2_ZOOM_CSS_DIAGNOSTICO.json).

Comprobado con recursos reales HTTP locales y Chrome: bienvenida, ayuda de ocho comandos, seis pantallas a 360/768/1280 sin desborde, viewport 640/DPR 2 sin desborde, animación desactivada por movimiento reducido, foco y dimensión del control, estado semanal vacío y service worker con módulo nuevo en caché. La ejecución final no registra excepciones JavaScript de la aplicación. La captura está tomada con viewport reducido/DPR 2 y ayuda expandida; no representa una conversación LLM.

**Pendiente investigado:** al aplicar `body.style.zoom=2`, Chrome midió `scrollWidth=1277` y `clientWidth=1265`, una diferencia de 12 px. La inspección no encontró elementos cuyo rectángulo derecho excediera el área útil; el reflujo equivalente a 640 CSS px/DPR 2 sí pasa. No se concluye que esto certifique zoom nativo ni se oculta el resultado: el JSON final permanece PARTIAL y el diagnóstico fallido se conserva. Hay que revisar zoom nativo del navegador al 200 % y decidir si requiere una corrección adicional.

No se arrancaron ni probaron contra red Ollama/PostgreSQL en esta fase: la regresión de transporte es con respuestas controladas en tests. No se deduce una validación E2E del backend a partir de estas pruebas. No se leyó `.env` para efectuar verificaciones.

## 8. Cumplimiento y pendientes

| Requisito | Estado |
|---|---|
| Bienvenida, pulso contextual, estados y reducción de movimiento | Implementado; comprobación CSS/Chrome y DOM |
| Confirmación real, bloqueo de duplicados y vibración voluntaria | Implementado; pruebas de persistencia y HTTP; vibración física pendiente |
| Valoraciones aisladas, corregibles y OFF | Implementado y probado |
| Resumen con eventos nuevos fechados y estado vacío | Implementado y probado |
| Ocho comandos, dictado separado y exclusión simultánea | Implementado; parser y handlers probados, captura acústica pendiente |
| Responsive 360/768/1280, foco y control Comandos 44×44 | Comprobado en Chrome |
| Zoom 200 % | Validación parcial; pendiente nativo y diagnóstico CSS de 12 px |
| Certificación WCAG AA, lector de pantalla y experiencia emocional de agricultores | No certificada; requiere evaluación manual |
| Ollama/PostgreSQL E2E actuales | No ejecutados en esta fase; contratos/código backend conservados |

## 9. Capturas y comprobaciones manuales para sustentación

1. Inicio al entrar: brote breve y resumen semanal vacío; repetir con preferencia de movimiento reducido.
2. Comandos con ayuda visible; decir cada frase, mostrar pantalla destino y anuncio. Probar una frase agrícola ambigua en Comandos y luego en Dictado.
3. Micrófono escuchando/procesando/cancelado; intento de cambiar de modo sin terminar la escucha; permiso denegado y alternativa escrita.
4. Consulta real Ollama pendiente, cancelada, fallida y exitosa, sin mostrar secretos. Mostrar Sí/No, cambiar valoración y comprobar perfil independiente/OFF.
5. Resumen semanal tras nuevas consultas reales; comprobar fechas y que los datos antiguos no aparecen inventados.
6. Parcela guardada y error de almacenamiento; alerta real con acuse HTTP y backend desconectado. Vibración solo con aceptación y dispositivo compatible.
7. Capturas a 360/768/1280 y zoom nativo 200 %; verificar teclado y lector de pantalla. Registrar el resultado del pendiente de zoom antes de declarar aceptación visual completa.

Mensaje de commit sugerido: `feat: añadir diseño emocional y navegación por voz`.

No se avanzó a Fase 3 ni se realizó commit, merge o push.
