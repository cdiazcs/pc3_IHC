"""Prueba manual reproducible: requiere Ollama local; no usa claves externas."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time

import httpx

ROOT = Path(__file__).resolve().parents[1]
# Servidor temporal propio; el puerto 8000 y procesos del usuario no se alteran.
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
env = dict(os.environ, AGROVOZ_LLM_BASE_URL='http://127.0.0.1:11434/v1',
           AGROVOZ_MODEL='llama3.2:1b', AGROVOZ_LLM_API_KEY='', AGROVOZ_LLM_TIMEOUT_SECONDS='120')
process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'main:app', '--app-dir',
                            str(ROOT / 'backend'), '--host', '127.0.0.1', '--port', str(port)],
                           env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    with httpx.Client(base_url=f'http://127.0.0.1:{port}', timeout=130, trust_env=False) as client:
        for _ in range(100):
            try:
                health = client.get('/health')
                break
            except httpx.ConnectError:
                if process.poll() is not None:
                    raise RuntimeError('Uvicorn no pudo iniciar')
                time.sleep(.1)
        else:
            raise RuntimeError('Uvicorn no inició a tiempo')
        print('HEALTH', health.status_code, health.json())
        started = time.perf_counter()
        response = client.post('/api/consult', json={
            'crop': 'papa', 'question': 'Las hojas están amarillas. No sé la causa. ¿Qué puedo revisar sin aplicar químicos?'})
        print('ELAPSED_SECONDS', round(time.perf_counter() - started, 3))
        print('HTTP', response.status_code)
        print(json.dumps(response.json(), ensure_ascii=False, indent=2))
        response.raise_for_status()
        data = response.json()
        assert set(data) == {'headline', 'observation', 'steps', 'source', 'limitations', 'provider'}
        assert data['provider'] == 'llama3.2:1b'
        assert isinstance(data['steps'], list) and all(isinstance(x, str) for x in data['steps'])
        assert all(isinstance(data[k], str) and data[k].strip() for k in data if k != 'steps')
finally:
    process.terminate()
    process.wait(timeout=10)
