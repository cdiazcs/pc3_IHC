# PC3 — responsabilidades y contratos para trabajo por ramas

## Estructura de ramas

- `main`: integración estable. Nadie hace cambios directos una vez creada la base.
- `feature/llm-voz`: integración real del LLM, confirmación de texto de voz y respuesta hablada. Responsable sugerido: Cristian.
- `feature/salas-comunidad`: API de salas, persistencia, publicación y lectura de alertas entre usuarios. Responsable sugerido: Maurizio.
- `docs/pc3-calidad`: historias, matriz, evidencia de pruebas, accesibilidad, C4, reporte y README. Responsable sugerido: Enoc.

## Contratos de integración acordados ANTES de editar

### Integrante LLM
- Mantener POST `/api/consult` con entrada JSON `{ "crop": "papa", "question": "..." }`.
- Responder con `headline`, `observation`, `steps[]`, `source`, `limitations`, `provider` (campos existentes en `backend/main.py`).
- Mantener la alternativa escrita; la voz puede no existir en todos los navegadores.
- Manejar 422, 502 y 503; no incrustar API keys en frontend.
- De ser posible mover cliente JS a `AgroVoz-App/modules/llm-client.js` y lógica Python a `backend/services/llm.py`, dejando adaptadores ligeros en `app.js` y `main.py`.

### Integrante comunidad
- Proponer rutas prefijadas `/api/rooms` para evitar interferir con `/api/consult`.
- Entrada mínima sugerida: usuario, sala, cultivo y texto; validar tamaño y no aceptar HTML activo.
- Persistir en SQLite local, no en `localStorage` compartido.
- Demostrar dos sesiones o dos dispositivos diferentes: usuario A crea alerta y usuario B ve la misma.
- Si modifica `backend/main.py`, limitar el cambio a `app.include_router(...)` y dejar endpoints en `backend/routers/rooms.py`.
- Si modifica `app.js`, limitarlo a importación/invocación de un módulo `AgroVoz-App/modules/rooms-client.js` y coordinar la edición antes de abrir el PR.

### Integrante documentación/calidad
- Escribir en `docs/PC3_*`, `tests/` y evidencias capturadas de la app real.
- Si modifica README o el HTML/CSS, coordinar una ventana de integración para evitar conflictos con los otros PR.
- No asignar "implementado" a funcionalidades que solo existen como mock.

## Política PR

1. Un PR = una funcionalidad enfocada, capturas y pruebas adjuntas.
2. No cambiar archivos fuera de la rama asignada sin informar al equipo.
3. No hacer `push --force` a `main`; no subir `.env` ni credenciales.
4. Probar antes de fusionar: `node --test tests/smoke.test.cjs`, `python3 tests/backend_smoke.py`.
5. Antes de etiquetar PC3, ejecutar prueba manual cruzada por dos integrantes.

## Riesgos actuales de la PC2

- `AgroVoz-App/app.js` es monolítico: conflictos si dos ramas lo editan a la vez.
- El perfil demo y las alertas usan almacenamiento del navegador: NO constituyen multiusuario real entre dispositivos.
- La API LLM requiere proveedor real configurado para demostrar capacidad obligatoria.
- PWA requiere servidor HTTP/localhost o HTTPS para validar instalación y caché.
