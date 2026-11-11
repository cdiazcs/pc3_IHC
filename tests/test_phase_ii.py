"""Pruebas del servicio modular con MockTransport; sin Ollama."""
import asyncio
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from services import llm

HTTP_CLIENT = httpx.AsyncClient


class PhaseII(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {
            'AGROVOZ_LLM_BASE_URL': 'http://ollama.test/v1', 'AGROVOZ_MODEL': 'llama3.2:1b',
            'AGROVOZ_LLM_API_KEY': '', 'AGROVOZ_LLM_TIMEOUT_SECONDS': '145',
        })
        env.start()
        self.addCleanup(env.stop)

    def generate(self, handler):
        def factory(**kwargs):
            self.assertEqual(kwargs['timeout'], 145)
            return HTTP_CLIENT(transport=httpx.MockTransport(handler), **kwargs)
        with patch.object(llm.httpx, 'AsyncClient', side_effect=factory):
            return asyncio.run(llm.generate_advice('papa', 'Hojas amarillas desde ayer'))

    def test_service_sends_only_question_crop_and_system(self):
        def handler(request):
            payload = json.loads(request.content)
            self.assertEqual(set(payload), {'model', 'messages', 'temperature', 'max_tokens'})
            self.assertEqual(len(payload['messages']), 2)
            self.assertNotIn('historial', payload['messages'][1]['content'])
            return httpx.Response(200, json={'choices': [{'message': {'content': 'Mencionas hojas amarillas. No puedo confirmar una causa. Observa cuántas plantas están afectadas.'}, 'finish_reason': 'stop'}]})
        self.assertEqual(self.generate(handler)['provider'], 'llama3.2:1b')

    def test_rejects_truncated_generation(self):
        with self.assertRaises(llm.LLMError) as caught:
            self.generate(lambda request: httpx.Response(200, json={'choices': [{'message': {'content': 'Mencionas hojas amarillas y'}, 'finish_reason': 'length'}]}))
        self.assertEqual(caught.exception.status_code, 502)

    def test_rejects_known_unsafe_recommendations(self):
        for text in ('Puedes intentar aplicar un poco de agua y ver si cambia.',
                     'Considera utilizar insecticidas orgánicos.',
                     'Aumenta el riego.', 'No puedo recomendarlo, pero aumenta el riego.', 'Te recomiendo agregar fertilizante.',
                     'Si decides utilizar un pesticida, sigue las instrucciones.'):
            with self.subTest(text=text), self.assertRaises(ValueError):
                llm.validate_answer(text)

    def test_allows_uncertainty_observation_and_limits(self):
        for text in ('No puedo recomendar aplicar agua.',
                     'No recomiendo aumentar el riego ni agregar fertilizante.',
                     'Mencionas manchas. No puedo confirmar una causa. Observa cuántas plantas están afectadas.',
                     'Consulta a un agrónomo antes de aplicar tratamientos.'):
            with self.subTest(text=text):
                self.assertEqual(llm.validate_answer(text), text)

    def test_rejects_excessive_output_instead_of_slicing(self):
        with self.assertRaises(ValueError):
            llm.validate_answer('palabra ' * 121)

    def test_invalid_provider_url_is_configuration_error(self):
        for url in ('ftp://local/v1', 'http://local:invalid/v1', 'http://', 'http://user:secret@local/v1', 'http://local/v1?key=secret'):
            with self.subTest(url=url), patch.dict(os.environ, {'AGROVOZ_LLM_BASE_URL': url}), self.assertRaises(llm.LLMError) as caught:
                llm.LLMConfig.from_env()
            self.assertEqual(caught.exception.status_code, 503)
            self.assertNotIn('secret', str(caught.exception))


if __name__ == '__main__':
    unittest.main(verbosity=2)
