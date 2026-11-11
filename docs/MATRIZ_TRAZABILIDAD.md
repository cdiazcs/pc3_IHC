# Matriz de trazabilidad completa (49 requisitos)

**Base:** matriz LEC06 del proyecto. Cada fila contiene las siete columnas pedidas por la PC2. *Implementado* significa presente en la aplicación local, NO desplegado en producción. La prioridad se mantiene conforme a la base. Este archivo es complementario al CSV editable.

| ID | Tipo | Prioridad | Historia | Estado | Evidencia principal |
|---|---|---|---|---|---|
| RF-01 | RF | Alta | HU-01 | Parcial | Perfil permite cambiar nombre/localidad, sin registro real |
| RF-02 | RF | Alta | HU-02 | Parcial | Seleccionar/agregar cultivos, sin parcelas geográficas |
| RF-03 | RF | Media | HU-18 | Demostrado | Configuración persiste local |
| RF-04 | RF | Alta | HU-03 | Dependiente de navegador | Botón Hablar / permiso Web Speech API |
| RF-05 | RF | Alta | HU-03 | Dependiente de navegador | Transcripción editable si motor disponible |
| RF-06 | RF | Alta | HU-04 | Implementado | Consulta visible y confirmada antes del guardado |
| RF-07 | RF | Alta | HU-08 | Dependiente de navegador | Escuchar/pausar/detener en Resultado |
| RF-08 | RF | Alta | HU-05 | Implementado | input capture="environment" y vista previa |
| RF-09 | RF | Media | HU-05 | Implementado | Validación jpg/png/webp 6 MB |
| RF-10 | RF | Alta | HU-06 | Pendiente | Falta visión artificial |
| RF-11 | RF | Alta | HU-06 | Demostrado | Orientación ficticia con límites explícitos |
| RF-12 | RF | Alta | HU-07, HU-23 | Demostrado | Reglas de texto, no procesamiento LLM |
| RF-13 | RF | Alta | HU-07, HU-19 | Pendiente | Falta RAG y manuales aprobados |
| RF-14 | RF | Alta | HU-07 | Demostrado | Respuesta generada por ejemplos, no fuentes |
| RF-15 | RF | Alta | HU-07 | Pendiente | Advierte ausencia de fuentes verificadas |
| RF-16 | RF | Media | HU-09 | Implementado local | Historial local por cuenta |
| RF-17 | RF | Media | HU-09, HU-21 | Implementado local | Historial de perfil de demo (sin seguridad real) |
| RF-18 | RF | Alta | HU-10 | Implementado local | Formulario borrador de alerta |
| RF-19 | RF | Alta | HU-10 | Demostrado local | Confirmación y publicación local |
| RF-20 | RF | Alta | HU-11 | Demostrado local | Alertas filtradas por comunidad de demo |
| RF-21 | RF | Alta | HU-12 | Parcial | Datos guardados y app cacheada tras 1era carga |
| RF-22 | RF | Alta | HU-12, HU-13 | Demostrado local | Cola local con identificador |
| RF-23 | RF | Alta | HU-13 | Demostrado local | Reconciliación local idempotente, sin servidor |
| RF-24 | RF | Media | HU-14 | Implementado | Ayuda modal dependiente de pantalla |
| RF-25 | RF | Alta | HU-17 | Pendiente | No se reconocen comandos de navegación por voz |
| RF-26 | RF | Alta | HU-16 | Implementado | Mensajes textuales y estados |
| RF-27 | RF | Alta | HU-15 | Parcial | Semántica y alternativa lista; falta auditoría lector |
| RF-28 | RF | Media | HU-19 | Pendiente | Sin administración de manuales |
| RF-29 | RF | Media | HU-20 | Pendiente | Sin moderación de alertas |
| RF-30 | RF | Alta | HU-22 | Parcial | Parcela con botones y lista, sin drag/zoom |
| RF-31 | RF | Alta | HU-23 | Implementado | Textarea de consulta |
| RF-32 | RF | Media | HU-25 | Implementado local | Acceso frecuente con aceptación reversible |
| RF-33 | RF | Baja | HU-24 | Pendiente | No implementado en prototipo |
| RF-34 | RF | Alta | HU-21 | Pendiente | Selector ficticio sin auth |
| RF-35 | RF | Media | HU-18 | Parcial | Localidad declarada, no contexto climático real |
| RNF-01 | RNF | Alta | HU-03, HU-05, HU-09, HU-22 | Implementado | Rutas accesibles con 1 clic desde inicio |
| RNF-02 | RNF | Alta | HU-15, HU-16, HU-17, HU-22 | Parcial | Controles amplios, foco, texto y alternativa; auditar |
| RNF-03 | RNF | Alta | HU-07, HU-14 | Implementado | Textos sencillos y ayuda contextual |
| RNF-04 | RNF | Media | HU-03, HU-06, HU-23 | Parcial | Mensajes de error, sin latencia LLM real |
| RNF-05 | RNF | Alta | HU-12, HU-13 | Parcial | Cache PWA + cola simulada, sin IndexedDB/RPC |
| RNF-06 | RNF | Alta | HU-19, HU-20, HU-21 | Pendiente | No hay backend para controles de autenticación |
| RNF-07 | RNF | Alta | HU-10, HU-21, HU-25 | Parcial | Confirmación de alerta; privacidad local no segura |
| RNF-08 | RNF | Alta | HU-15, HU-22 | Parcial | CSS responsive a varios anchos; validar 200% |
| RNF-09 | RNF | Media | HU-14, HU-22 | Implementado | Componentes y navegación consistente |
| RNF-10 | RNF | Alta | HU-03, HU-05, HU-06, HU-13, HU-23 | Parcial | Errores de archivo/voz, cola para recuperar |
| RNF-11 | RNF | Media | HU-19 | Parcial | Separación funcional en JS y documentación |
| RNF-12 | RNF | Alta | HU-12 | Demostrado local | Datos en localStorage, caché del shell |
| RNF-13 | RNF | Media | HU-07 | Pendiente | Arquitectura futura de adaptador, no implementada |
| RNF-14 | RNF | Alta | HU-06, HU-07, HU-19 | Parcial | No atribuye referencias inexistentes; no RAG |
