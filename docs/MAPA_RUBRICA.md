# Rúbrica PC2: entrega, evidencia y pendientes

## Informe (13 puntos)
| Requisito de la rúbrica | Evidencia incluida | Estado |
|---|---|---|
| Análisis no automatizado de stakeholders y discapacidad (1 punto) | Informe cap. 3; análisis documental de 16 perfiles originales | Documentado; faltan entrevistas/observaciones reales |
| Análisis PACT, actividades y requisitos | Informe cap. 3; tabla con implicaciones RF/RNF | Hipótesis justificadas; falta validación in situ |
| RF/RNF completos (2 puntos, en bloque de requisitos) | 35 RF, 14 RNF y CSV editable | Completo documentalmente; parcialmente implementados |
| Historias de usuario y CA | Documento anterior HU-01 a HU-25, ejemplares en informe; anexo PDF | Documentadas originalmente |
| Matriz completa (5 puntos) | `Matriz_Trazabilidad_PC2.csv` 49 filas, 7 columnas | Documentada y etiquetada por estado real |
| Apps similares (1 punto) | Informe cap. 4: Plantix, Agrio, PlantVillage Nuru + URLs | Comparación documental de funciones anunciadas |
| Criterios concretos de usabilidad (1 punto) | Informe cap. 4 y PLAN_PRUEBAS | Metas; pruebas con usuarios no realizadas |
| 3 alternativas de diseño (2 puntos) | Prototipo sección Diseños, informe cap. 5 | Tres conceptos ilustrados, selección provisional |
| Gantt (1 punto) | `GANTT.md`, tabla en informe | Propuesto, ajustar con fechas reales |

## Prototipo de fidelidad media (3 puntos)
| Requisito | Evidencia | Estado |
|---|---|---|
| Diagrama de interacciones de todas las pantallas | diagramas/interacciones.png y fuente .dot | Presente con pantallas y decisiones principales |
| Simulación de flujo completo | `AgroVoz-App/`, guía paso a paso | Navegable; IA, multiusuario remotos no reales |
| Repositorio web ordenado | README, LICENSE, guía, C4, código y datos demo | Carpeta lista para subir; GitHub remoto por crear |

## Sustentación personal (4 puntos)
| Requisito | Evidencia | Estado |
|---|---|---|
| Video único de 2 min por persona, máximo 6 min para tres integrantes | `GUIÓN_SUSTENTACION.md` | Guion preparado; grabación pendiente |
| Aporte personal documentado | `mi-aporte-integrante-3.docx` | Plantilla; personalizar con tareas reales |
| Archivo ZIP y nombre exigido | Este paquete debe nombrarse conforme a la rúbrica al entregar | Preparado con nombre descriptivo, renombrar según integrante |

## Requerimientos comunes de aplicación inteligente
- Voz: operativa según Web Speech; alternativa escrita.
- LLM por API o local: adaptador FastAPI opcional implementado (API OpenAI-compatible), sin modelo/credenciales reales conectados. Modo demostración usado por defecto; RAG pendiente.
- PWA: manifiesto, SW, caché de shell; no es sincronización de servidor.
- Personalización: local reversible.
- Multiusuario: comunidad simulada entre perfiles locales, no colaboración remota.
- Norman visceral/conductual/reflexivo: estética legible, feedback de procesos, control y reversibilidad.

**Advertencia:** ningún prototipo sin backend real debe declararse como cumplimiento íntegro de los requisitos de LLM y multiusuario en producción. Priorizar transparencia en sustentación.
