# Pruebas de AgroVoz — PC3

## 1. Pruebas automatizadas

Se incorporaron pruebas para verificar el funcionamiento de la aplicación, la integración con inteligencia artificial y los servicios colaborativos de PostgreSQL.

| Módulo | Prueba | Resultado reportado |
|---|---|---|
| Frontend | `node tests/smoke.test.cjs` | 8 pruebas aprobadas |
| Sintaxis JavaScript | `node --check AgroVoz-App/app.js` | Sin errores reportados |
| Backend FastAPI | `python tests/backend_smoke.py` | 3 pruebas aprobadas |
| Inteligencia artificial | `python tests/test_phase_i.py` | Integración LLM validada |
| Ollama real | `python tests/phase_i_live.py` | Generación real verificada |
| PostgreSQL y salas | Pruebas del módulo de salas | 25 pruebas aprobadas |



## 2. Checklist de comprobación manual

| ID | Caso de prueba | Resultado esperado | Estado |
|---|---|---|---|
| T01 | Registrar parcela y cultivo | Información guardada correctamente | Por validar |
| T02 | Realizar consulta con Ollama | Respuesta generada por IA real | Backend probado |
| T03 | Consultar mediante micrófono | Reconocimiento correcto de voz | Por validar |
| T04 | Escuchar respuesta | Reproducción y controles funcionales | Por validar |
| T05 | Cambiar de perfil | Historial y preferencias independientes | Por validar |
| T06 | Crear sesión comunitaria | Participante registrado en PostgreSQL | Por validar en interfaz |
| T07 | Crear sala y unirse desde otra sesión | Dos usuarios comparten una sala | Por validar |
| T08 | Publicar alerta comunitaria | Alerta persistente y visible para miembros | Backend probado |
| T09 | Recargar aplicación | Persistencia de preferencias y alertas | Por validar |
| T10 | Utilizar PWA sin conexión | Interfaz disponible desde caché | Por validar |
| T11 | Abrir desde otra computadora | Frontend y API funcionan por HTTPS | Pendiente |
| T12 | Probar accesibilidad y diseño adaptable | Navegación y contenido utilizables | Por validar |

## 3. Metas de usabilidad

Las siguientes metas son objetivos de evaluación, no resultados medidos:

- **Efectividad:** al menos 90 % de tareas completadas.
- **Eficiencia:** máximo tres transiciones para acceder a las funciones principales.
- **Satisfacción:** puntuación mínima esperada de 4/5.
- **Accesibilidad:** navegación por teclado, alternativas a la voz, contraste adecuado y adaptación al zoom de 200 %.
- **Colaboración:** dos usuarios deben poder compartir alertas desde sesiones independientes.

## 4. Conclusión

Las pruebas de PC3 evidencian avances en la integración de **FastAPI, Ollama y PostgreSQL**, además de conservar las funcionalidades desarrolladas en PC2.


