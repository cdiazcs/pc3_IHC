# Módulos PC3

`llm-client.js` implementa la consulta de texto al backend y valida el contrato
existente. Exporta `consultLLM({crop, question}, {signal})` y `validateAdvice(data)`.
No envía fotografías, perfil ni historial. `app.js` conserva la interacción y el
almacenamiento local. Evidencia y límites en `docs/FASE_II_IMPLEMENTACION.md`.

`rooms-client.js` queda reservado para la rama de comunidad; no se implementa aquí.
Mantener el contrato acordado en `docs/PC3_RAMAS_Y_CONTRATOS.md`.
