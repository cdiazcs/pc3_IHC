# Auditoría de alcance e implementación — AgroVoz PC3

| Módulo | Estado | Implementación realizada |
|---|---|---|
| Parcelas y cultivos | Implementado | Registro, selección y visualización de cultivos. |
| Consultas agrícolas | Implementado | Consultas por texto y voz con confirmación. |
| Inteligencia artificial | Implementado | Integración real de Ollama (`llama3.2:1b`) con FastAPI. |
| Respuestas por voz | Implementado | Reproducción de respuestas mediante Web Speech API. |
| Perfil e historial | Implementado | Preferencias y consultas persistentes mediante `localStorage`. |
| Personalización | Implementado | Sugerencias de preferencias que pueden aceptarse o revertirse. |
| Fotografías | Parcial | Carga y visualización; diagnóstico visual con IA pendiente. |
| PostgreSQL | Implementado | Base de datos para participantes, salas y alertas. |
| Multiusuario | Backend probado | Siete endpoints REST, sesiones demo y control de acceso. |
| Alertas comunitarias | Backend probado | Publicación, persistencia y consulta entre usuarios independientes. |
| PWA | Implementado | Manifiesto, service worker y recursos locales. |
| Diseño emocional | Implementado | Aplicación de los tres niveles de Norman. |
| Pruebas | Implementado | Pruebas de PC2, Ollama y PostgreSQL; validación remota pendiente. |
| GitHub | Implementado | Desarrollo mediante ramas y Pull Requests. |
| Documentación | En actualización | README, arquitectura, trazabilidad e informes PC3. |

## Aportes de los integrantes

| Integrante | Aporte principal |
|---|---|
| **Cristian Díaz** | Integración de Ollama, consultas con IA, voz, personalización y pruebas. |
| **Maurizio Berdiales** | PostgreSQL, salas multiusuario, alertas, API REST y pruebas de persistencia. |
| **Enoc Rosales** | Historias de usuario, requisitos, matriz de trazabilidad, usabilidad y documentación. |

## Conclusión

AgroVoz evolucionó de un prototipo demostrativo en PC2 a una aplicación con inteligencia artificial local y servicios colaborativos respaldados por PostgreSQL.


