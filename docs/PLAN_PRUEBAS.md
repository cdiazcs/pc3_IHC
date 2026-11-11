# Pruebas de la PC2

## Pruebas automatizadas
`node tests/smoke.test.cjs` desde la raíz de la entrega: valida en un DOM simulado la generación de pantallas, persistencia, aislamiento de perfiles de demo, historial y cola offline. `node --check AgroVoz-App/app.js` verifica sintaxis. **No** son pruebas de usabilidad con agricultores.

El adaptador opcional se verifica con `python tests/backend_smoke.py` (3 pruebas de contrato HTTP sin inferencia real).

## Checklist de comprobación manual (registrar fecha, evaluador y evidencia)
| ID | Caso | Resultado esperado | Estado de evidencia |
|---|---|---|---|
| T01 | Navegar inicio → consultar | Consulta visible en <= 2 transiciones | Pendiente de constancia humana |
| T02 | Enviar pregunta válida | Confirmación antes del guardado | Pendiente |
| T03 | Enviar sin texto | Aviso y no se guarda | Pendiente |
| T04 | Cargar JPG y confirmar | Vista previa y confirmación | Pendiente |
| T05 | Micrófono denegado | Alternativa textual | Pendiente; depende del navegador |
| T06 | Escuchar, pausar, detener | Se controla la lectura | Pendiente; depende del navegador |
| T07 | Publicar alerta / cancelar | Solo publicar tras confirmar | Pendiente |
| T08 | Cambiar Ana → José → Rosa | Historial propio, alertas por comunidad | Pendiente |
| T09 | Simular offline y restaurar | Pendientes conservados y sincronización local | Pendiente |
| T10 | Pantalla 360/768/1280 y zoom 200 % | Sin pérdida de contenido importante | Pendiente |
| T11 | Usar Tab/Enter, lector de pantalla | Orden de foco lógico y controles etiquetados | Pendiente |
| T12 | Reabrir localhost sin red después de carga inicial | Shell desde caché de PWA | Pendiente |

## Metas de usabilidad (hipótesis, NO resultados)
- Efectividad: al menos 90 % de tareas realizadas sin ayuda.
- Eficiencia: máximo 3 transiciones desde inicio para Consultar, Revisar planta e Historial.
- Satisfacción: al menos 4/5 (muestra y método a acordar).
- Accesibilidad: controles de objetivo alrededor de 44 × 44 px CSS, contraste >= 4,5:1 para texto normal y zoom al 200 %.

