# Resultado de verificaciones automáticas de este paquete


## Pruebas Node (DOM simulado): 8/8 correctas

- Pantalla inicial y navegación.
- Tres alternativas de interfaz.
- Consulta, resultado de demostración e historial.
- Separación de datos por perfil ficticio.
- Cola offline y sincronización local.
- Confirmación de alerta y visibilidad por comunidad.
- Personalización reversible.
- Matriz con 49 requisitos.

Repetir con `node tests/smoke.test.cjs` desde la carpeta raíz.

## Pruebas FastAPI (TestClient): 3/3 correctas

- Endpoint `/health`.
- Respuesta 503 honesta cuando no hay proveedor LLM configurado.
- Validación 422 ante una consulta vacía.

Repetir con `python tests/backend_smoke.py`.

## Limitaciones


