# Módulos PC3

`rooms-client.js` integra exclusivamente los siete contratos `/api/rooms` implementados por la rama `feature/salas-comunidad`. Se activa explícitamente desde Comunidad; el modo local PC2 permanece separado. Cada perfil conserva su sesión demo y borradores en `agrovoz_rooms_v1.<perfil>`. El token es una credencial de demostración, no una identidad verificada de producción.

El cliente mantiene cursor de lectura, polling secuencial, cancelación y claves idempotentes. Nunca importa alertas simuladas ni historial de consultas al servidor. No existe endpoint de listado nominal de miembros: muestra su cantidad y el rol propio.

`llm-client.js` sigue reservado a su rama correspondiente. Contratos y validación: `docs/POSTGRES_DISENO.md`, `docs/FASE_III_SALAS_VALIDACION.md`.
