# Módulos PC3 integrados

`llm-client.js` exporta `consultLLM({crop, question}, {signal})` y `validateAdvice(data)`. Consulta el backend, valida el contrato y no envía fotografías, perfil ni historial. `app.js` conserva voz, interacción y personalización. Evidencia: `docs/FASE_II_IMPLEMENTACION.md`.

`rooms-client.js` integra los siete contratos `/api/rooms`, con activación explícita desde Comunidad y modo local PC2 separado. Cada perfil conserva sesión demo y borradores en `agrovoz_rooms_v1.<perfil>`. El token no acredita identidad personal de producción. Implementa polling secuencial, cancelación, cursor y claves idempotentes; no sube alertas simuladas ni historial. Muestra cantidad de miembros y rol propio, sin inventar un endpoint de listado nominal.

Diseño y validación: `docs/POSTGRES_DISENO.md`, `docs/FASE_III_SALAS_VALIDACION.md` y `docs/FASE_IV_INTEGRACION.md`.
