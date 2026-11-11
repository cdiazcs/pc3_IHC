# Auditoría de alcance e implementación 

| Módulo | Estado | Limitación o evidencia |
|---|---|---|
| Parcelas, selección de cultivos y lista equivalente | Implementado | Botones y lista, actualiza contexto de consulta. No cartografía real. |
| Perfil persistente | Implementado localmente | `localStorage`, tres perfiles ficticios. Sin identidad verificada. |
| Consulta escrita + confirmación | Implementado | Validación y confirmación antes de registrar. |
| Reconocimiento de voz | Implementado dependiente del navegador | Web Speech API; probar permisos y compatibilidad en máquina final. |
| Lectura de respuesta por voz | Implementado dependiente del navegador | `speechSynthesis`, pausa y detención. |
| Carga y vista previa de imagen | Implementado | JPG/PNG/WEBP, límite 6 MB, compresión local. |
| Diagnóstico visual real | Pendiente | No hay IA visual, no afirmar diagnóstico. |
| Adaptador de proveedor LLM | Implementado como integración opcional | `backend/main.py` permite conectar un proveedor OpenAI-compatible con variables de entorno; **sin proveedor real conectado ni prueba de inferencia**. |
| RAG con fuentes aprobadas | Pendiente | No se recuperan manuales, no hay bibliografía técnica usada por el modelo. |
| Alertas comunitarias | Demostrado | Visibles entre tres cuentas locales ficticias; no hay servidor. |
| Historial por perfil | Implementado localmente | No proporciona privacidad de producción. |
| PWA y caché de shell | Implementado | manifest + service worker. Se necesita primer acceso por localhost/HTTPS. |
| Guardado de cola offline | Demostrado | Cola local; procesamiento al volver en línea no contacta backend. |
| Personalización reversible | Implementado localmente | Propuesta después de 3 consultas, aceptación y reversión. |
| Lienzo accesible y alternativa textual | Parcial | Alternativa de lista sí; pruebas reales con lector de pantalla pendientes. |
| Multiusuario, autenticación y roles seguros | Pendiente | Solo conmutador de demostración. |
| Panel de administración y fuentes versionadas | Pendiente | Plan posterior. |
| Quechua preparado | Pendiente | Documento conceptual, no incluido en prototipo. |
| Backend FastAPI y adaptador configurable | Código disponible opcional | Contrato probado sin proveedor externo; sin implementación de cuentas o persistencia remota. |
| Supabase, autenticación real y persistencia remota | Pendiente | Arquitectura objetivo únicamente. |
| PACT y métricas | Documentados como hipótesis | No sustituir investigación con agricultores. |
| Diagrama C4, README, guía, licencia y datos simulados | Incluidos | Archivos `docs/`, `README`, `LICENSE`. |
| Video de 2 min / integrante | Pendiente de grabación | Grupo debe aportar voz y evidencia personal. |
| GitHub público/compartido | Pendiente de publicar | No se crea un repositorio remoto desde este ZIP. |

