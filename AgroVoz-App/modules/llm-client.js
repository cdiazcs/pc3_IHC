/* Cliente de texto: el contrato excluye fotografías, perfil e historial. */
const DEFAULT_ENDPOINT = 'http://127.0.0.1:8000/api/consult';
const ERROR_MESSAGES = {
  422: 'Revisa la consulta: el cultivo debe tener de 1 a 60 caracteres y la pregunta de 8 a 700.',
  503: 'El modelo no está configurado en el backend. Revisa su configuración y vuelve a intentar.',
  502: 'Ollama no pudo completar una orientación válida. Comprueba que esté disponible y reintenta.',
};

export function validateAdvice(data) {
  const strings = ['headline', 'observation', 'source', 'limitations', 'provider'];
  if (!data || !strings.every(key => typeof data[key] === 'string' && data[key].trim()) ||
      !Array.isArray(data.steps) || !data.steps.length ||
      !data.steps.every(step => typeof step === 'string' && step.trim())) {
    throw new Error('El modelo devolvió una respuesta incompleta. Puedes reintentar.');
  }
  return Object.fromEntries([...strings, 'steps'].map(key => [key, data[key]]));
}

export async function consultLLM({crop, question}, {signal, timeoutMs = 310000, fetchImpl = globalThis.fetch} = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, {once: true});
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetchImpl(DEFAULT_ENDPOINT, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({crop, question}), signal: controller.signal,
    });
    if (!response.ok) throw new Error(ERROR_MESSAGES[response.status] || 'No se pudo completar la consulta. Inténtalo de nuevo.');
    return validateAdvice(await response.json());
  } catch (error) {
    if (controller.signal.aborted) throw new Error('La espera terminó o se canceló la consulta. Puedes reintentar; el modelo pudo haber recibido el texto.');
    if (error instanceof TypeError) throw new Error('No se pudo conectar al backend. Comprueba la conexión y vuelve a intentar.');
    if (error instanceof SyntaxError) throw new Error('El backend devolvió una respuesta ilegible. Puedes reintentar.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
