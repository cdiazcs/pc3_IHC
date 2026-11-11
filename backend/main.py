
import os
from typing import Literal
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx

# API ligera para consultar al modelo.
app = FastAPI(title="AgroVoz LLM adapter", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],
                   allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

# Entrada básica del usuario.
class Query(BaseModel):
    crop: str = Field(min_length=1, max_length=60)
    question: str = Field(min_length=8, max_length=700)

class Advice(BaseModel):
    headline: str
    observation: str
    steps: list[str]
    source: str
    limitations: str
    provider: str

@app.get('/health')
def health():
    # Estado rápido del backend.
    return {'status': 'ok', 'provider_configured': bool(os.getenv('AGROVOZ_LLM_BASE_URL') and os.getenv('AGROVOZ_MODEL'))}

# Consulta al proveedor LLM.
@app.post('/api/consult', response_model=Advice)
async def consult(query: Query):
    base = os.getenv('AGROVOZ_LLM_BASE_URL', '').rstrip('/')
    model = os.getenv('AGROVOZ_MODEL', '').strip()
    key = os.getenv('AGROVOZ_LLM_API_KEY', '').strip()
    if not base or not model:
        raise HTTPException(status_code=503, detail='El proveedor LLM todavía no fue configurado en el backend.')
    # Configuración básica del prompt.
    system = ('Eres un asistente educativo para agricultores. Responde en español claro, nunca afirmes que has visto fotos ni '
              'analizado muestras o que conoces el clima actual. No atribuyas fuentes que no recibiste. Evita dar dosis de '
              'plaguicidas o diagnósticos definitivos. Reconoce la incertidumbre. Sugiere verificación con un agrónomo.')
    payload = {'model': model, 'messages': [
        {'role':'system','content':system},
        {'role':'user','content':f'Cultivo declarado: {query.crop}. Observación o pregunta: {query.question}'},
    ], 'temperature': 0.2, 'max_tokens': 350}
    headers={'Content-Type':'application/json'}
    if key:headers['Authorization']=f'Bearer {key}'
    try:
        # Llama al modelo y valida la respuesta.
        async with httpx.AsyncClient(timeout=28,follow_redirects=False) as client:
            response = await client.post(base+'/chat/completions',headers=headers,json=payload)
            response.raise_for_status()
            data=response.json()
            answer=data['choices'][0]['message']['content']
            if not isinstance(answer,str) or not answer.strip():raise ValueError('La respuesta del LLM llegó vacía.')
    except (httpx.HTTPError, ValueError, TypeError, KeyError, IndexError) as ex:
        raise HTTPException(status_code=502,detail='El servicio LLM no respondió de forma válida. Revisa la configuración.') from ex
    return Advice(
        headline=f'Orientación del modelo para {query.crop}',
        observation=answer[:3500],
        steps=['Contrasta esta orientación con observación en campo y fuentes locales verificadas.',
               'Consulta a un especialista antes de aplicar tratamientos.'],
        source='Generación LLM configurada por el usuario. No se ha integrado recuperación RAG ni manuales aprobados.',
        limitations='Salida automática no validada por un agrónomo; no equivale a diagnóstico técnico.',
        provider=model
    )
