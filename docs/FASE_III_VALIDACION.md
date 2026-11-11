# Fase III — validación de usabilidad, personalización y accesibilidad

Fecha: 11/11/2026, America/Lima. Rama: `feature/llm-voz`.
Plazo declarado por el solicitante: 11/11/2026 a las 14:30, Perú; este informe no
certifica la entrega. No se encontró `CC451-2026-2-PC3.pdf` en el workspace. Se usan
solo los criterios PC3 conocidos: reporte 7, prototipo 7, sustentación 4, calidad 2;
voz, LLM, PWA, personalización continua, multiusuario y diseño emocional.

## 1. Resumen ejecutivo

Se verificó nuevamente la integración heredada y se corrigieron problemas de
control de preferencias, navegación, teclado, dictado repetido y adaptación a
pantallas estrechas. Chrome ejecutó consultas reales a Ollama y recuperación tras
un fallo de red, con historial persistente y sin fallback a demo. La evaluación
es una inspección técnica, no una prueba con agricultores.

**Cumplimiento operativo de Fase III: 17/20 = 85%.** Tres verificaciones siguen
parciales: dictado físico, audio audible y revisión completa de zoom/tecnologías
de asistencia. **FASE III INCOMPLETA** hasta completar esas evidencias. La calidad
agrícola I12 heredada sigue parcial y requiere revisión independiente; no se
resuelve por tener HTTP 200 ni por pasar pruebas simuladas.

## 2. Estado heredado y alcance preservado

Se leyeron README, PC3_EMPEZAR_AQUI, las auditorías I/II, checklist y contratos;
se inspeccionaron main.py, services/llm.py, app.js, index.html, styles.css, módulos
y pruebas. Todos los archivos solicitados existen salvo la rúbrica PDF oficial.
No se encontraron AGENTS.md en el workspace. La rama fue confirmada antes de editar.

- Fase I documentaba 14/15 y conexión real; no se considera aprobada por inferencia.
- Fase II implementó servicio/cliente modular, espera, errores y voz; dejó I12 y
  audio físico pendientes. Se ejecutaron otra vez sus pruebas y su flujo de
  navegador, ampliado para esta fase, no se reutilizan sus resultados como actuales.
- El backend no se modificó en Fase III. Se conservan entrada crop/question y los
  seis campos de respuesta, 422/502/503 y timeout configurable. Health no acredita
  generación. Solo observation contiene texto generado; el resto es envoltorio.
- Antes de trabajar había cambios sin commit de I/II y `.vscode/` sin seguimiento.
  Se conservaron. No se modificaron `.env`, salas, comunidad, contratos, matriz
  compartida, README ni documentos de otros autores durante Fase III.
- No se hizo commit, push, merge, cambio de rama, PR ni eliminación de trabajo.

Archivos modificados **en esta fase**: `AgroVoz-App/app.js`, `AgroVoz-App/styles.css`,
`tests/phase_ii_frontend.test.cjs`, `tests/phase_ii_browser.cjs`. Nuevos:
`tests/phase_iii_browser.cjs`, `tests/phase_iii_browser_checks.cjs`, este informe,
`FASE_III_PRUEBAS_USABILIDAD.md` y evidencias con prefijo FASE_III. El árbol también
muestra archivos de fases previas: no se atribuyen como trabajo nuevo aquí.

## 3. Matriz de heurísticas de Nielsen

Referencia: [diez heurísticas, NN/g](https://www.nngroup.com/articles/ten-usability-heuristics/).
Escala de inspección aplicada por el agente: 0 sin problema observado, 1 menor
fricción, 2 problema de uso, 3 problema importante de control/datos, 4 impide la
tarea principal. Es severidad técnica inicial con justificación, no una medición
con usuarios. No se asigna 0 a toda la interfaz por aprobar un escenario.

| Heurística | Problema observado / severidad inicial | Archivo/interfaz | Corrección o pendiente | Aceptación verificable |
|---|---|---|---|---|
| B1 Visibilidad | 0: espera y pregunta ya visibles en II; deben conservarse | app.js, consulta | comprobación real mantenida, con cancelar espera | esperar respuesta con pregunta visible, sin segundo envío |
| B2 Lenguaje cercano | 2: banner hablaba de RAG/LLM sin explicación agrícola | app.js, resultado | banner habla de orientación automática y manuales verificados; el proveedor sigue identificado | distinguir IA/demo y leer límites sin depender de siglas; comprensión humana pendiente |
| B3 Control/libertad | 2: no había botón para abandonar la espera larga | app.js, estado | Cancelar espera aborta cliente y conserva texto; no promete detener Ollama | cancelar, no guardar resultado tardío y volver a consultar |
| B4 Consistencia | 2: resultado marcaba Inicio como sección activa | app.js, shell | se identifica como Consultar | resultado real/demo mantiene Consultar activo |
| B5 Prevención | 3: Restaurar preferencias activaba voz y revocaba consentimiento de aprendizaje | app.js, perfil | Quitar acceso sugerido solo revierte ese acceso, sin tocar voz/aprendizaje/cultivo | aceptar/quitar y recargar conserva las otras opciones |
| B6 Reconocimiento | 2: al entrar a Consultar el modo estaba oculto en perfil | app.js, consulta | indicador IA local o demostración y enlace a perfil | modo visible antes de confirmar |
| B7 Eficiencia | 1: cultivo elegido para iniciar consultas no tenía preferencia persistente explícita | app.js, perfil | selector de cultivo inicial por perfil, con valor previo como alternativa | guardar maíz, recargar y abrir Consultar con maíz; otro perfil conserva el suyo |
| B8 Minimalismo/legibilidad | 1: estado de consulta aparecía aun en pantallas sin consulta; etiquetas de menú móvil se apretaban | app.js, styles.css | panel limitado al flujo o consulta en curso; menú sin encoger etiquetas | Inicio sin estado ocioso; menú móvil desplazable sin solapamiento |
| B9 Recuperación | 2: No, gracias desactivaba toda la personalización; controles de reintento no se actualizaban con ciertos errores de voz | app.js, preferencias/estado | rechazo específico persistente, sin revocar consentimiento; reintento se actualiza al cambiar estado | error → revisar → confirmar → resultado real; rechazo no altera voz/aprendizaje |
| B10 Ayuda | 2: ayuda carecía de explicación de modos/reintento y gestión de foco/Escape | app.js, ayuda | texto contextual ampliado; foco contenido en Ayuda, Escape y retorno al control | abrir con Enter, Tab se mantiene dentro, Escape cierra y devuelve foco |

Otros hallazgos relevantes corregidos: salto al contenido se interpretaba como
ruta `main` y podía volver a Inicio; eventos repetidos del mismo resultado de voz
podían concatenar dos veces; desborde horizontal a 640 px; borde/foco claro de
campos con poco contraste. Se verifican abajo. No se modificó el diálogo de
publicación de comunidad: su accesibilidad completa queda para revisión de esa rama.

## 4. Accesibilidad: evaluación acotada

Referencia técnica: [WCAG 2.2, W3C](https://www.w3.org/TR/WCAG22/).
Se identifican criterios aplicables; **no se declara conformidad WCAG 2.2 AA**.

| Requisito | Criterios de referencia | Evidencia y alcance | Estado/pendiente |
|---|---|---|---|
| F1 Teclado | 2.1.1, 2.1.2 | Chrome: salto, secuencia cultivo → pregunta → Hablar, ayuda con Tab/Escape | verificado en esos recorridos; resto de pantallas pendiente |
| F2 Foco | 2.4.3, 2.4.7, 2.4.11 | foco visible de 3 px, destino main, retorno desde ayuda; CSS específico en barra lateral | falta revisar todos los estados y posibles elementos que oculten foco |
| F3 Etiquetas | 1.3.1, 3.3.2, 4.1.2 | labels reales de cultivo/pregunta comprobados en Chrome; leyendas de grupos, texto en botones | otros formularios/lector de pantalla pendientes |
| F4 Anuncios | 4.1.3 | región persistente aria-live=polite y estados textuales, sin reemplazarla al renderizar | estructura comprobada; audición con lector pendiente |
| F5 Iconos | 1.1.1, 2.4.6 | botones Hablar/Escuchar/Pausar/Reanudar/Detener tienen texto | revisión integral de nombres con tecnología asistiva pendiente |
| F6 Contraste | 1.4.3, 1.4.11 | cinco pares acotados y foco medidos; borde de campos reforzado | no se midieron todos los colores/estados/páginas |
| F7 Sin micrófono | 2.1.1 | consulta real escrita y denegación de micrófono en Chrome | verificado; no implica voz funcional |
| F8 No solo color | 1.4.1 | modo, estado y errores tienen texto e indicadores | inspección de flujo; otros módulos pendientes |
| F9 Pantallas/zoom | 1.4.4, 1.4.10 | 1280, 640 y 360 px, sin desborde de página en Consultar | zoom real 200% y revisión de otras pantallas pendientes |
| F10 Sin síntesis | 1.3.3, 2.1.1 como referencias del flujo | tests sin API conservan texto/alternativa; no depende de oír la respuesta | audio físico, voces instaladas y lectores pendientes |

Mediciones guardadas en JSON de Chrome:

| Par evaluado | Relación | Referencia usada |
|---|---|---|
| Texto principal sobre fondo claro | 10,83:1 | 4,5:1 para texto normal |
| Texto de botón secundario | 6,16:1 | 4,5:1 |
| Borde de campo blanco | 3,72:1 | 3:1 para componente |
| Foco de campo sobre blanco | 10,15:1 | 3:1 |
| Texto de error sobre blanco | 7,30:1 | 4,5:1 |

Los primeros cuatro pares se obtienen de estilos computados; el par de error usa
el color declarado de ese estado y fondo blanco. No se comparan colores de
capturas comprimidas. No es un escáner automático de todos los nodos.

Primer recorrido: a 640 px la página tenía scrollWidth 648 frente a clientWidth
625. Tras `min-width:0` en los contenedores de grid y límites de ancho, los valores
finales fueron 1265/1265, 625/625 y 345/345 (scrollWidth/clientWidth) para ventanas
1280/640/360. La barra del menú puede desplazarse horizontalmente dentro de su
propio contenedor; no fuerza scroll horizontal de toda la página. Su separación
se comprobó después de impedir el encogimiento de enlaces. Esto no acredita el
zoom del navegador: reducir viewport no sustituye esa prueba manual.

## 5. Diseño emocional de Norman

Decisiones de diseño e intención, sin atribuir efectos medidos en personas:

| Nivel | Decisión concreta | Elemento real / evidencia | Límite |
|---|---|---|---|
| Visceral 1 | conservar verde, iconos de cultivo y jerarquía AgroVoz | estilos/consulta, captura móvil | no se midió primera impresión |
| Visceral 2 | reforzar legibilidad con borde/foco y evitar etiquetas superpuestas | CSS, ratios y captura a 360 px | no demuestra preferencia estética de agricultores |
| Conductual 1 | esperar con pregunta visible, bloqueo de duplicados y cancelación | estado de consulta; tests y Chrome | cancelar cliente puede no detener la inferencia recibida |
| Conductual 2 | recuperar de error conservando texto y confirmando de nuevo | botón de reintento, consulta real posterior | latencia variable; sin garantía bajo carga |
| Reflexivo 1 | explicar señal de personalización y pedir aceptación específica | conteo local, acceso sugerido, reversión sin alterar consentimiento | no es aprendizaje automático ni sincronización remota |
| Reflexivo 2 | mantener historial, modo/origen y límites explícitos | resultado real/demo, historial por perfil, captura | no acredita confianza ni validez agronómica |

## 6. Voz: implementación y evidencia separadas

| Caso | Verificación realizada | Resultado real / límite |
|---|---|---|
| C1 es-PE | código y callbacks de reconocimiento configurados; Chrome declara soporte | dictado físico no probado |
| C2/C3 alternativa y edición | textarea, consulta escrita real, test de transcripción corregida | ruta escrita verificada; transcripción de audio pendiente |
| C4 confirmación | diálogo nativo de revisión usado antes de peticiones reales | verificado; voz no envía sola |
| C5 estados | escucha/transcripción en callbacks; espera/error en Chrome | callbacks son pruebas simuladas, no audio real |
| C6 escuchar/pausar/reanudar/detener | API simulada con controles y cambios de estado | audio audible/voz instalada pendiente |
| C7 preferencia | lectura apagada se conserva tras recarga; prueba simulada de lectura activada | se conserva consentimiento; autoplay físico pendiente |
| C8 permiso/soporte | permiso microphone denegado por CDP a Chrome; mensaje visible real | alternativa escrita operativa; ausencia de API cubierta por test |
| C9 duplicados | cada índice final del dictado se consume una vez; nueva lectura cancela la anterior | tests incluyen evento repetido y callback tardío; no prueban dos audios físicos |
| C10 red | ayuda explica dependencia del navegador y posibles servicios externos | no se afirma voz totalmente offline |

Al empezar a dictar se detiene la lectura para evitar realimentación. Al salir o
cambiar perfil se cancelan callbacks anteriores. El botón Detener dictado conserva
la transcripción final que el navegador pueda entregar antes de onend.

## 7. Personalización persistente y reversible

`preferredCrop` se guarda por perfil solo mediante una elección explícita en Mi
perfil. Perfiles anteriores sin ese campo usan el primer cultivo registrado;
no hay migración destructiva. `voice`, `learning`, `quickAccess`, modo e historial
existentes se conservan. Seleccionar otro cultivo en una consulta no cambia a
escondidas la preferencia inicial.

La sugerencia de acceso aparece con `learning=true`, al menos tres consultas
guardadas y sin aceptación/rechazo previo. El mensaje explica el conteo real de
ese perfil, no emociones inferidas. `quickSuggestionDismissed` registra el rechazo
de esa sugerencia; no revoca `learning`. Quitar o desmarcar el acceso conserva voz,
cultivo y consentimiento y evita insistir al recargar. Los otros controles siguen
permitiendo ajustes explícitos.

Chrome comprobó dos consultas reales más una demo, tres registros, sugerencia,
aceptación y reversión; tras recarga conservó voz desactivada, aprendizaje activado,
maíz inicial e historial. Al cambiar a otro perfil, el historial estaba vacío y
su cultivo era tomate; cambiarlo a café no afectó al perfil original. Tests
adicionales cubren rechazo, recarga, cancelación y preferencias sincrónicas. Son
perfiles locales sin autenticación, persistencia remota ni sincronización.

## 8. Escenarios E2E y alcance de las pruebas

| ID | Escenario | Método | Resultado | Evidencia/límite |
|---|---|---|---|---|
| E01 | confirmar consulta → FastAPI → Ollama → resultado identificado | Chrome, HTTP real | verificado | observación generada en JSON; no mock |
| E02 | repetir envío durante espera | Chrome | una sola petición, pregunta visible y controles bloqueados | primera consulta sin duplicados |
| E03 | bloquear URL de consulta | bloqueo de red de Chrome, sin apagar servidores | texto conservado, error/reintento, sin registro simulado | bloqueo controlado, no se apagó Ollama |
| E04 | desbloquear y reintentar con confirmación | Chrome → proveedor real | segunda respuesta y un registro adicional | no solo prueba unitaria |
| E05 | recargar tras consulta | Chrome/localStorage | historial y preferencia conservados | almacenamiento de navegador |
| E06 | señal de uso, aceptar y quitar acceso | Chrome; dos reales y una demo | conserva las otras preferencias tras recarga | no evaluación de usuarios |
| E07 | cambiar perfil/cultivo inicial | Chrome | historial y preferencias aislados localmente | no seguridad entre usuarios reales |
| E08 | teclado: salto, campos, ayuda | Input.dispatchKeyEvent de Chrome | foco, secuencia, Tab/Escape y retorno correctos en recorrido | no cubre todos los diálogos |
| E09 | viewport/contraste | estilos y geometría Chrome | pares acotados y tres anchos pasan | zoom/lector pendientes |
| E10 | micrófono denegado | permiso real de navegador mediante CDP | mensaje claro, teclado disponible | no dictado positivo |
| E11 | recargar offline | red emulada offline + SW real | app y módulo LLM disponibles desde caché | sin inferencia offline ni instalación PWA completa |
| E12 | cancelar consulta y evitar callbacks/voz duplicados | pruebas de lógica con transporte/API simulados | aprobado | **no se presenta como E2E ni audio físico** |
| E13 | imagen excluida del payload | cliente bajo test y petición real capturada | solo crop/question | fotografía no se analiza |

## 9. Comandos ejecutados y resultados

Desde la raíz, entorno `backend/.venv` ya existente, sin instalar dependencias:

| Comando | Resultado observado |
|---|---|
| `git branch --show-current` / `git status --short` | rama correcta; cambios previos conservados |
| `backend/.venv/bin/python tests/test_phase_i.py` | 8 pruebas OK |
| `backend/.venv/bin/python tests/backend_smoke.py` | 3/3 comprobaciones OK |
| `backend/.venv/bin/python tests/test_phase_ii.py` | 6 pruebas OK |
| `node tests/phase_ii_frontend.test.cjs` | 15 pruebas OK: 9 heredadas + 6 nuevas de III |
| `node tests/smoke.test.cjs` | 8/8 comprobaciones PC2 OK, incluida comunidad simulada |
| `node --test tests/smoke.test.cjs tests/phase_ii_frontend.test.cjs` | dos archivos/suites pasan; no contar como dos pruebas internas solamente |
| `node --check AgroVoz-App/app.js` | sintaxis OK |
| `node --check AgroVoz-App/modules/llm-client.js` | sintaxis OK |
| `node --check AgroVoz-App/sw.js` | sintaxis OK |
| `node --check tests/phase_iii_browser_checks.cjs` | sintaxis OK |
| `backend/.venv/bin/python -m compileall -q backend/main.py backend/services tests` | salida 0 |
| `node tests/phase_iii_browser.cjs` | 16 comprobaciones Chrome aprobadas; JSON final `status=PASS` |
| `git diff --check` | sin errores |
| `git ls-files backend/.env '*/__pycache__/*' '*venv*'` | ninguna ruta en seguimiento |
| `git check-ignore backend/.env backend/.venv/bin/python backend/services/__pycache__/llm.cpython-314.pyc` | tres rutas excluidas |

Las pruebas FastAPI y Chrome se ejecutaron fuera del sandbox debido a las
restricciones ya verificadas de sockets. No hubo rechazo de aprobación automática.
TestClient mantiene un aviso de deprecación, sin fallo. La prueba nueva de voz
simulada se ajustó para comparar cancelaciones adicionales, separándolas de la
cancelación legítima al navegar; el producto no necesitó un cambio por ese fallo.

La primera prueba Chrome encontró el desborde (evidencia inicial conservada), se
corrigió y se repitió. Un intento posterior falló por usar el nombre de permiso
CDP audioCapture donde Chrome esperaba microphone; se corrigió el script. Ese
fallo era de automatización, no una denegación de voz funcional del producto.
La apertura de Ayuda requirió que el evento Enter de CDP incluyera su carácter
y una espera explícita del diálogo; con ello el recorrido Tab/Escape pasó.
El registro final contiene 16 comprobaciones aprobadas y ninguna excepción JS
no controlada en los recorridos probados.

Se reutiliza el escenario de II mediante un prefijo de salida y una extensión
optativa; la ejecución normal de II conserva su comportamiento. En III se crean
servidores propios y perfil Chrome temporal en `/tmp`; CDP redirige solo el puerto
8000 del cliente al FastAPI temporal porque el servidor del usuario ya lo ocupaba.
No se utiliza ni se detiene ese servidor del usuario. Todas las respuestas reales
proceden de Ollama local, con clave vacía en el proceso de prueba. No se alteran
`.env` ni parámetros del equipo/modelo. No se sustituye el proveedor por una fixture.

No se repitió la batería agrícola histórica de cinco preguntas: no cambió el
backend y el objetivo aquí es el flujo/UX; sus resultados siguen en el informe II.
Las nuevas consultas reales no constituyen una nueva certificación agrícola.

## 10. Evidencias verificables

- [Chrome final: resultados, respuestas, contraste y anchos](evidencias/FASE_III_NAVEGADOR.json).
- [Captura del resultado real](evidencias/FASE_III_NAVEGADOR.png).
- [Captura de Consulta a 360 px](evidencias/FASE_III_MOVIL.png).
- [Registro inicial con desborde encontrado](evidencias/FASE_III_NAVEGADOR_INICIAL.json).
- [Protocolo y plantilla para voluntarios](FASE_III_PRUEBAS_USABILIDAD.md).

Se inspeccionó visualmente la captura móvil; motivó separar las etiquetas del menú.
Las fechas efectivas de ejecución están en JSON (UTC, convertir a Lima UTC−05).
No se presentan capturas PC2 ni baterías de II como si fueran evidencia nueva.
La captura de resultado acredita origen/transporte, no calidad agronómica.

## 11. Pendientes manuales y protocolo exacto

Usar los comandos locales ya documentados, sin reemplazar servidores ajenos:
`backend/.venv/bin/python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000`
y `python3 -m http.server 8080 --directory AgroVoz-App`. Abrir localhost:8080 y
confirmar que la versión corresponde a estos cambios.

1. **Dictado positivo:** modo IA local, cultivo papa, Hablar y permitir micrófono;
   dictar una pregunta ficticia. Corregir texto, detener, verificar que no se
   duplica, cancelar primera confirmación y después confirmar. Registrar navegador,
   permiso, texto final y petición. No prometer reconocimiento totalmente offline.
2. **Audio audible:** respuesta real → Escuchar → Pausar → Reanudar → Detener.
   Verificar una sola lectura, reproducción nueva cancela la anterior y preferencia
   apagada/encendida se respeta. Documentar voces instaladas y cualquier bloqueo
   de autoplay. La alternativa escrita debe seguir operativa.
3. **Zoom/lector:** Chrome a zoom real 200%; recorrer Consulta, Resultado, Historial
   y Perfil con Tab/Shift+Tab/Enter, luego lector de pantalla. Confirmar anuncios,
   foco visible no oculto, nombres y reflujo. No sustituirlo por viewport de 640 px.
4. **Ayuda y otros diálogos:** Ayuda del módulo ya tiene foco y Escape probados;
   revisar accesibilidad de formularios/diálogos ajenos con sus responsables.
5. **I12:** revisar las respuestas agrícolas con criterios de utilidad e incertidumbre.
   Sigue pendiente de I/II; evitar diagnósticos/tratamientos basados solo en IA.
6. **Voluntarios:** ejecutar el protocolo separado si hay tres personas disponibles;
   actualmente cero sesiones, sin tiempos, encuestas ni satisfacción inventados.

## 12. Riesgos y conflictos de integración

- `app.js` sigue compartido: integrar sus cambios de consulta/perfil/teclado con
  cuidado al incorporar comunidad. No se alteraron datos ni handlers de salas.
- CSS de foco, campos y contenedores es global por necesidad de accesibilidad:
  puede cambiar presentación de otras pantallas. PC2 pasa, pero revisar visualmente
  esos módulos en la integración; no afirmar cobertura E2E de comunidad.
- La ampliación optativa del runner Chrome depende de Node con WebSocket, Chrome,
  puerto 8080 libre y Ollama local. Perfil temporal y procesos son propios.
- Un filtro de texto no valida exactitud agrícola. Se conserva I12 parcial; idioma
  simple y confianza percibida no se acreditan con transporte HTTP.
- Cancelar espera no garantiza cancelar la inferencia recibida. No hay objetivo de
  latencia bajo carga medido aquí. No se modificaron RAM, swap, hilos ni servicios.
- Aislamiento de perfiles local no es autenticación ni colaboración real. No se
  agregaron sincronización, salas, visión ni fuentes documentales.
- Se verificó exclusión de `.env`, entornos y cachés, y que las peticiones solo
  contienen cultivo/pregunta; no se imprimieron secretos. No es una revisión de
  secretos de todo el historial Git ni de otros archivos de autores.
- Documentos compartidos de Enoc no se alteraron ni se contactó a integrantes.
  Este informe está separado para posterior revisión e integración.

## 13. Correspondencia PC3

| Criterio conocido | Aporte verificable de III | Lo que queda pendiente |
|---|---|---|
| Reporte de avance, 7 | heurísticas, accesibilidad, decisiones Norman, pruebas y evidencia trazable | integración de historias/matriz del equipo y capturas de todos los módulos |
| Prototipo funcional, 7 | consulta real, recuperación, perfiles/preferencias y caché comprobados; voz implementada | voz física, I12, instalación PWA completa y multiusuario real de otra rama; no se calcula 70% global |
| Sustentación personal, 4 | escenarios reproducibles para demostrar aporte y límites | video, participación y duración no verificados |
| Calidad, 2 | regresiones, sintaxis, diff, evidencias y protocolo sin datos ficticios | revisión cruzada, C4 integrado y revisión de entregables finales |

No se estiman puntos obtenidos ni nota /20.

## 14. Criterios de aceptación y cálculo

Cada fila pesa 1, sin otorgar fracciones a parcial. Los criterios se limitan a
Fase III; no se cuentan pantallas globales, colaboración ni video. Preparar un
protocolo es distinto de ejecutar el estudio: solo la preparación se incluye.
Documentar un bloqueo acredita transparencia, no una prueba exitosa del hardware.

| ID | Criterio verificable | Estado | Evidencia |
|---|---|---|---|
| V01 | rama, cambios conservados y restricciones Git/secretos | Cumplido | status, ignore, índice; sin acciones de publicación |
| V02 | regresiones y contrato backend | Cumplido | 8 + 3 + 6 verificaciones |
| V03 | regresiones frontend y pruebas nuevas | Cumplido | 8 PC2 + 15 pruebas del flujo |
| V04 | consulta real con contrato y payload solo texto | Cumplido | Chrome → FastAPI → Ollama |
| V05 | IA/demo diferenciadas y sin fallback por error | Cumplido | Chrome resultado/red bloqueada y tests |
| V06 | espera con pregunta y bloqueo de duplicados | Cumplido | Chrome y tests |
| V07 | error, reintento real y cancelación controlada | Cumplido | Chrome reintento; cancelación en test |
| V08 | historial persistente por perfil local | Cumplido | recarga y cambio de perfil Chrome |
| V09 | cultivo/voz/preferencias explícitas persistentes | Cumplido | perfil y recarga Chrome |
| V10 | sugerencias por uso, aceptación/reversión y consentimiento | Cumplido | uso de tres consultas, tests y Chrome |
| V11 | diez heurísticas con severidad y aceptación | Cumplido | sección 3 |
| V12 | al menos dos decisiones por nivel Norman | Cumplido | seis decisiones, sección 5 |
| V13 | teclado, etiquetas y foco en recorrido del módulo | Cumplido | Chrome, salto/campos/ayuda |
| V14 | estructura de anuncios y alternativas textuales | Cumplido | región persistente, mensajes y pruebas sin APIs |
| V15 | contraste acotado de texto/controles/estados | Cumplido | cinco pares medidos; no certificación integral |
| V16 | pantallas estrechas, zoom real y tecnología asistiva | Parcial | anchos pasan; zoom 200%/lector pendientes |
| V17 | voz de entrada positiva en entorno real | Parcial | callbacks/es-PE y denegación real; dictado físico pendiente |
| V18 | lectura audible y controles/preferencia en entorno real | Parcial | APIs simuladas y preferencia persistente; audio físico pendiente |
| V19 | protocolo y plantilla para tres voluntarios sin inventar resultados | Cumplido | archivo separado; 0 sesiones reales |
| V20 | informe, evidencias, riesgos y próximos pasos | Cumplido | documentos y artefactos FASE_III |

**17 cumplidos / 20 criterios = 85%. FASE III INCOMPLETA.**

Para cerrar: completar V16–V18 y registrar evidencia real sin sobrescribir estos
resultados; revisar además I12 heredado antes de presentar orientación agrícola
como confiable. Los ocho criterios generales de finalización se cubren mediante
estos veinte criterios operativos: regresiones V02–03, E2E V04–07, voz V17–18,
personalización V08–10, evaluación V11–16, correcciones V06–15, documentos V19–20
y alcance V01. Las verificaciones humanas no se convierten en éxito al documentarlas.
