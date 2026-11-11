# Actualización del módulo LLM + voz para integrar con calidad

| ID existente | Estado propuesto del módulo | Evidencia | Aceptación pendiente |
|---|---|---|---|
| RF-04 | Implementado; micrófono físico pendiente | `app.js:startVoice`, prueba de callbacks/permiso | dictado real es-PE en navegador compatible |
| RF-05 | Implementado, lógica probada | transcripción editable; no envío automático | corrección manual de dictado real y confirmación |
| RF-06 | Implementado y probado en navegador | confirmación nativa con cultivo/pregunta y alcance del envío | revisión cruzada humana |
| RF-07 | Implementado; audio físico pendiente | `speak`, `pauseSpeech`, `stopSpeech`, preferencia persistente; tests | escuchar, pausar, reanudar y detener con audio real |
| RF-11 | Demo conservada y diferenciada | modo demo y cola PC2 siguen pasando; badge sin IA | no confundirla con inferencia |
| RF-12 | LLM real integrado; calidad parcial | cliente modular → FastAPI → servicio → Ollama; evidencia JSON/Chrome | revisión humana de utilidad agrícola |
| RF-14 | Generación real con límites explícitos; parcial | cinco respuestas reales finales y captura; sin RAG | I12 no se cierra por transporte ni mocks |
| RF-15 | Pendiente recuperación de fuentes | `source` declara ausencia de RAG/manuales | fuera de esta fase: fuentes verificadas |
| RF-16 | Historial local verificado | recarga Chrome conserva consulta del usuario | no acredita persistencia remota |
| RF-17 | Separación local probada; sin autenticación | cambio de cuenta cancela consulta; test sin filtración | seguridad real no pertenece a este módulo |
| RF-31 | Alternativa escrita verificada | envío desde textarea en Chrome a Ollama | revisión humana de accesibilidad |
| RF-32 | Preferencias locales conservadas | pruebas PC2 y lectura automática desactivada tras recarga Chrome | persistencia entre dispositivos no implementada |
| RNF-03 | Parcial | estados claros, prompt breve; respuestas reales aún poco útiles | revisión de español sencillo y utilidad |
| RNF-04 | Parcial | espera visible, duplicados bloqueados; latencias reales registradas | acordar y verificar objetivo bajo carga |
| RNF-10 | Mejorado y probado para texto/LLM | errores, reintento, abort, sin fallback; UI Chrome | errores físicos de voz en navegador objetivo |
| RNF-11 | Modularizado para LLM | `services/llm.py`, `modules/llm-client.js`; app conserva adaptadores | revisión de integración con otras ramas |
| RNF-13 | Adaptador real implementado y probado | servicio HTTP asíncrono compatible con proveedor configurado | otros proveedores no probados |
| RNF-14 | Parcial | límites visibles, rechazos de tratamientos/truncamiento conocidos | filtro no certifica exactitud ni ausencia universal de invenciones |


