# Protocolo breve de usabilidad — Fase III

**Estado: PENDIENTE DE EJECUCIÓN.** No se realizaron sesiones con voluntarios ni
se registraron resultados en esta auditoría. Esta es una plantilla, no evidencia
de satisfacción, tiempos ni éxito. Preparada el 11/11/2026 (America/Lima).

## Objetivo y participantes

Observar si tres voluntarios pueden elegir cultivo, consultar, escuchar, recuperar
una consulta y cambiar una preferencia. Priorizar personas con experiencia agrícola
cuando estén disponibles; registrar el perfil real sin atribuirles representatividad
estadística. Utilizar códigos anónimos U01/U02/U03 solo al realizar las sesiones.
No escribir nombres, teléfonos, direcciones, parcelas reales ni datos sensibles.

Sesión individual orientativa: 15–20 minutos. Facilitador: ______. Observador: ______.
Fecha/hora Perú: ______. Versión/commit o estado de trabajo: ______.
Navegador/Ubuntu/dispositivo/ancho: ______. Proveedor/modelo comprobado: ______.
Modo empleado (IA real/demo): ______. No mezclar resultados de ambos modos.

## Consentimiento y preparación

Leer: “Estamos probando la aplicación, no tus conocimientos. Puedes detenerte en
cualquier momento y no necesitas compartir información personal. Usaremos cultivos
y preguntas ficticias. La orientación automática no es un diagnóstico ni debe
usarse para decidir tratamientos. Nos interesa saber qué resulta claro o confuso”.

Registrar consentimiento voluntario: sí/no ______. Permiso adicional de captura
sin datos personales: sí/no ______. Permiso de audio: sí/no ______. Si no acepta
captura/audio, usar solo notas consentidas. No grabar audio por defecto.

Antes de cada sesión:

1. Abrir un perfil de navegador de prueba sin datos personales, servido por HTTP
   local. Verificar FastAPI y Ollama; registrar si no están disponibles.
2. Seleccionar modo IA local y un perfil demostrativo. Explicar que los perfiles
   son locales, no autenticación ni colaboración entre dispositivos.
3. Mostrar cómo pedir pausa o ayuda. No anticipar dónde están los botones de las
   tareas. Desactivar lectura automática inicialmente; registrar el estado real.
4. Para micrófono, explicar que el reconocimiento del navegador puede depender de
   servicios externos. Permitir que el participante elija teclado.
5. Usar siempre preguntas ficticias, por ejemplo “Las hojas de papa están amarillas
   desde ayer”. No valorar la exactitud agronómica como prueba de usabilidad.

## Tareas y criterios observables

| Tarea | Instrucción al participante | Finalización observable | Inicio/fin de medición |
|---|---|---|---|
| T1 | “Entra a AgroVoz y prepara una consulta de maíz” | llega a Consultar con maíz seleccionado | desde instrucción hasta cultivo visible |
| T2 | “Describe hojas amarillas por voz o por escrito; revisa y envía” | revisa texto, confirma y recibe respuesta identificada como IA real | desde instrucción hasta respuesta visible; registrar espera del modelo por separado |
| T3 | “Escucha la respuesta; pausa, continúa y detén la lectura” | usa controles y confirma si el audio se oye | desde instrucción hasta lectura detenida; si no hay síntesis, marcar bloqueo de entorno |
| T4 | “Busca la consulta que acabas de hacer” | abre la consulta correcta desde historial | desde instrucción hasta consulta recuperada |
| T5 | “Deja el maíz como cultivo inicial y desactiva lectura automática; comprueba que se conserva al recargar” | preferencias correctas tras recarga; sabe revertirlas | desde instrucción hasta verificación y reversión solicitada |

Tarea opcional de recuperación: bloquear solo la URL de consulta desde DevTools,
sin apagar servicios del usuario; pedir que explique el mensaje y encuentre cómo
reintentar. Desbloquear al terminar. No sumar esa tarea a las cinco principales.

## Registro por participante (copiar tres veces al ejecutar)

Código real asignado: ______. Experiencia agrícola declarada, opcional: ______.
Frecuencia de uso de navegador, opcional: ______. Preferencia teclado/voz: ______.
Consentimiento y dispositivo: ______. Limitaciones de entorno: ______.

| Tarea | Resultado: sin ayuda/con ayuda/no finalizada/bloqueada | Tiempo total (s) | Espera IA (s), si aplica | Errores y recuperaciones observados | Ayuda ofrecida | Claridad 1–5 | Comentario literal autorizado |
|---|---|---|---|---|---|---|---|
| T1 | — | — | No aplica | — | — | — | — |
| T2 | — | — | — | — | — | — | — |
| T3 | — | — | No aplica | — | — | — | — |
| T4 | — | — | No aplica | — | — | — | — |
| T5 | — | — | No aplica | — | — | — | — |

“—” significa **sin medir**, no cero ni éxito. Claridad: 1 muy confuso, 2 confuso,
3 intermedio, 4 claro, 5 muy claro. Preguntar después de cada tarea, sin sugerir
respuesta. El observador no debe inferir la calificación ni emociones.

Errores: describir acción, pantalla, consecuencia y recuperación; no culpar al
participante. Ejemplos de categorías (no resultados): cultivo equivocado,
confirmación omitida, confusión IA/demo, pérdida de foco, preferencia no encontrada.
Registrar interrupciones o indisponibilidad de servicio separadamente.

## Preguntas finales

- ¿Qué parte te resultó más clara y cuál fue difícil?
- ¿Pudiste distinguir una respuesta automática de una demostración?
- ¿Qué entendiste que la aplicación podía y no podía comprobar sobre tu cultivo?
- ¿Supiste detener la lectura y cambiar tus preferencias?
- ¿Qué cambiarías primero?

Anotar las respuestas reales; evitar preguntas que presupongan satisfacción.

## Análisis tras ejecutar las sesiones

- Informar tareas finalizadas sin/con ayuda sobre tareas efectivamente intentadas;
  mostrar también bloqueadas y no finalizadas, sin excluirlas en silencio.
- Presentar tiempos por tarea y participante. Separar espera de Ollama del tiempo
  de interacción cuando se haya medido; no inventar la separación después.
- Resumir errores observados y claridad declarada; con tres voluntarios los
  resultados son exploratorios, no una validación estadística de agricultores.
- Vincular cada problema real a una heurística y propuesta concreta. Separar los
  hallazgos del estudio de los de inspección técnica de Fase III.
- Registrar consentimiento de conservación de notas/capturas y fecha acordada de
  eliminación. Solo publicar material previamente autorizado.

## Cierre

Sesiones completadas realmente: ___ / 3. Estado actual: **0 sesiones realizadas**.
Resultados y conclusiones del estudio: **PENDIENTES**.
Responsable de revisión humana y enlace a registros autorizados: ______.
