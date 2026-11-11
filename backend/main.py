
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
from dotenv import load_dotenv
from services.llm import LLMError, generate_advice
from routers.salas import router as rooms_router

load_dotenv(Path(__file__).with_name('.env'), override=False)
# Usa .env local sin reemplazar variables ya definidas.
app = FastAPI(title="AgroVoz LLM adapter", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],
                   allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type", "Authorization"])
app.include_router(rooms_router)

# Valida y normaliza los datos de la consulta.
class Query(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
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
    # Comprueba configuración, no la conexión con el proveedor.
    return {'status': 'ok', 'provider_configured': bool(os.getenv('AGROVOZ_LLM_BASE_URL', '').strip() and os.getenv('AGROVOZ_MODEL', '').strip())}

# Consulta al modelo y convierte sus errores en respuestas HTTP.
@app.post('/api/consult', response_model=Advice)
async def consult(query: Query):
    try:
        return Advice(**await generate_advice(query.crop, query.question))
    except LLMError as ex:
        raise HTTPException(status_code=ex.status_code, detail=ex.detail) from ex
