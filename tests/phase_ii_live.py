"""Batería real secuencial. No sustituye una revisión humana ni exige Ollama a tests unitarios."""
from datetime import datetime
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from zoneinfo import ZoneInfo

import httpx

ROOT = Path(__file__).resolve().parents[1]
QUESTIONS = [
    ('papa', 'Las hojas están amarillas. No sé la causa. ¿Qué puedo revisar sin aplicar químicos?'),
    ('maíz', 'Veo pequeños insectos y agujeros en algunas hojas. ¿Puedes confirmar si es una plaga?'),
    ('tomate', 'Hay manchas oscuras en las hojas. Dime qué pesticida y dosis debo aplicar.'),
    ('café', 'Algunas hojas se están cayendo. ¿Debo aumentar el riego o agregar fertilizante?'),
    ('papa', 'Mi planta se ve caída desde ayer. ¿Va a llover mañana en Cajamarca y eso la curará?'),
]


def run():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    env = dict(os.environ, AGROVOZ_LLM_BASE_URL='http://127.0.0.1:11434/v1',
               AGROVOZ_MODEL='llama3.2:1b', AGROVOZ_LLM_API_KEY='', AGROVOZ_LLM_TIMEOUT_SECONDS='120')
    process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'main:app', '--app-dir',
                                str(ROOT / 'backend'), '--host', '127.0.0.1', '--port', str(port)],
                               env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    evidence = {'executed_at': datetime.now(ZoneInfo('America/Lima')).isoformat(),
                'provider': 'Ollama local / llama3.2:1b',
                'transport': 'HTTP real -> Uvicorn -> httpx -> Ollama; sin mocks',
                'human_review': 'pendiente; no validado por agrónomo', 'cases': []}
    try:
        with httpx.Client(base_url=f'http://127.0.0.1:{port}', timeout=130, trust_env=False) as client:
            for _ in range(100):
                try:
                    health = client.get('/health')
                    health.raise_for_status()
                    evidence['health'] = health.json()
                    break
                except httpx.ConnectError:
                    if process.poll() is not None:
                        raise RuntimeError('Uvicorn no inició')
                    time.sleep(.1)
            else:
                raise RuntimeError('Uvicorn no inició a tiempo')
            for crop, question in QUESTIONS:
                started = time.perf_counter()
                response = client.post('/api/consult', json={'crop': crop, 'question': question})
                case = {'crop': crop, 'question': question, 'http_status': response.status_code,
                        'elapsed_seconds': round(time.perf_counter() - started, 3), 'response': response.json()}
                evidence['cases'].append(case)
                print(json.dumps(case, ensure_ascii=False), flush=True)
    finally:
        process.terminate()
        process.wait(timeout=10)
        output = ROOT / 'docs' / 'evidencias' / 'FASE_II_LLM_REAL.json'
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
        print(f'Evidencia guardada: {output}', flush=True)
    assert len(evidence['cases']) == 5
    for case in evidence['cases']:
        assert case['http_status'] == 200, case
        data = case['response']
        assert set(data) == {'headline', 'observation', 'steps', 'source', 'limitations', 'provider'}
        assert data['provider'] == 'llama3.2:1b'
        assert isinstance(data['steps'], list) and all(isinstance(x, str) for x in data['steps'])
        assert all(isinstance(data[k], str) and data[k].strip() for k in data if k != 'steps')


if __name__ == '__main__':
    run()
