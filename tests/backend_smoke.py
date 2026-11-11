"""Prueba de contrato HTTP opcional, sin proveedor LLM real ni acceso a red externa."""
import os,sys
sys.path.insert(0,os.path.join(os.path.dirname(__file__),'..','backend'))
from fastapi.testclient import TestClient
from main import app
os.environ.pop('AGROVOZ_LLM_BASE_URL',None)
os.environ.pop('AGROVOZ_MODEL',None)
client=TestClient(app)
a=client.get('/health'); assert a.status_code==200 and a.json()['provider_configured'] is False
b=client.post('/api/consult',json={'crop':'papa','question':'Hojas amarillas en papa'}); assert b.status_code==503
c=client.post('/api/consult',json={'crop':'papa','question':''}); assert c.status_code==422
print('PASS backend: health, falta de proveedor explicita y validacion de entrada (3/3)')
