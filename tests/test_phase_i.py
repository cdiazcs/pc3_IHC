"""Contrato Fase I: sin red, proveedor simulado explícitamente."""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
import main
from services import llm

HTTP_CLIENT = httpx.AsyncClient
QUESTION = {'crop': 'papa', 'question': 'Las hojas están amarillas, ¿qué reviso?'}


class PhaseI(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {
            'AGROVOZ_LLM_BASE_URL': 'http://ollama.test/v1/',
            'AGROVOZ_MODEL': 'llama3.2:1b', 'AGROVOZ_LLM_API_KEY': '',
            'AGROVOZ_LLM_TIMEOUT_SECONDS': '120',
        })
        self.env.start()
        self.addCleanup(self.env.stop)
        self.client = TestClient(main.app)

    def request_provider(self, handler):
        def factory(**kwargs):
            self.assertEqual(kwargs['timeout'], 120)
            self.assertFalse(kwargs['follow_redirects'])
            return HTTP_CLIENT(transport=httpx.MockTransport(handler), **kwargs)
        with patch.object(llm.httpx, 'AsyncClient', side_effect=factory):
            return self.client.post('/api/consult', json=QUESTION)

    def test_health_only_reports_configuration(self):
        with patch.object(llm.httpx, 'AsyncClient', side_effect=AssertionError('No debe llamar al proveedor')):
            response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok', 'provider_configured': True})

    def test_missing_and_blank_configuration(self):
        for base in ('', '   '):
            with self.subTest(base=base), patch.dict(os.environ, {'AGROVOZ_LLM_BASE_URL': base}):
                self.assertFalse(self.client.get('/health').json()['provider_configured'])
                self.assertEqual(self.client.post('/api/consult', json=QUESTION).status_code, 503)

    def test_real_provider_contract_without_mock_advice(self):
        answer = 'No puedo confirmar una causa. Observa las hojas y consulta a un agrónomo.'
        def handler(request):
            import json
            payload = json.loads(request.content)
            self.assertEqual(str(request.url), 'http://ollama.test/v1/chat/completions')
            self.assertEqual(payload['model'], 'llama3.2:1b')
            self.assertIn(QUESTION['question'], payload['messages'][1]['content'])
            self.assertIn('No atribuyas fuentes', payload['messages'][0]['content'])
            self.assertNotIn('authorization', request.headers)
            return httpx.Response(200, json={'choices': [{'message': {'content': answer}}]})
        response = self.request_provider(handler)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(set(data), {'headline', 'observation', 'steps', 'source', 'limitations', 'provider'})
        self.assertEqual(data['observation'], answer)
        self.assertEqual(data['provider'], 'llama3.2:1b')
        self.assertTrue(all(isinstance(data[k], str) for k in data if k != 'steps'))
        self.assertIsInstance(data['steps'], list)
        self.assertTrue(all(isinstance(step, str) for step in data['steps']))

    def test_unreachable_and_timeout(self):
        for error in (httpx.ConnectError, httpx.ReadTimeout):
            def handler(request):
                raise error('sensitive-upstream-detail', request=request)
            with self.subTest(error=error.__name__):
                response = self.request_provider(handler)
                self.assertEqual(response.status_code, 502)
                self.assertNotIn('sensitive-upstream-detail', response.text)

    def test_missing_model_and_upstream_errors(self):
        for status in (404, 429, 500):
            with self.subTest(status=status):
                response = self.request_provider(lambda request: httpx.Response(status, json={'error': 'model missing'}))
                self.assertEqual(response.status_code, 502)

    def test_malformed_provider(self):
        cases = [None, {}, {'choices': []}, {'choices': None}, {'choices': [{}]}]
        cases += [{'choices': [{'message': {'content': value}}]} for value in ('', '   ', None, 12, [])]
        for body in cases:
            with self.subTest(body=body):
                response = self.request_provider(lambda request: httpx.Response(200, json=body))
                self.assertEqual(response.status_code, 502)
        self.assertEqual(self.request_provider(lambda request: httpx.Response(200, text='invalid JSON')).status_code, 502)

    def test_invalid_input(self):
        for body in ({}, {'crop': 'papa'}, {'crop': '', 'question': 'abcdefgh'},
                     {'crop': '   ', 'question': 'abcdefgh'},
                     {'crop': 'papa', 'question': '        '},
                     {'crop': 'papa', 'question': 'corta'},
                     {'crop': 'x' * 61, 'question': 'abcdefgh'},
                     {'crop': 'papa', 'question': 'x' * 701},
                     {'crop': 1, 'question': 'abcdefgh'}):
            with self.subTest(body=body):
                self.assertEqual(self.client.post('/api/consult', json=body).status_code, 422)

    def test_invalid_timeout_configuration(self):
        for value in ('nan', 'inf', '0', '301', 'abc'):
            with self.subTest(value=value), patch.dict(os.environ, {'AGROVOZ_LLM_TIMEOUT_SECONDS': value}):
                self.assertEqual(self.client.post('/api/consult', json=QUESTION).status_code, 503)


if __name__ == '__main__':
    unittest.main(verbosity=2)
