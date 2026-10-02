"""The attribution on plots rendered by this server, and the key that unlocks the copyright and watermark switches."""
from __future__ import annotations

import asyncio
import importlib
import json
import sys
import unittest
from pathlib import Path
from unittest import mock

PROJECT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_DIR))

from backend import app as app_module, plot_renderer, security  # noqa: E402
import_data = importlib.import_module('backend.import_data.import_data')

FIXTURE_PATH = PROJECT_DIR / 'tests' / 'fixtures' / 'render-config.json'
DATASET_PATH = PROJECT_DIR / 'tests' / 'dataset_1.xlsx'
KEY = 'correct-horse-battery-staple-42'


def post(path: str, body: dict | None = None, headers: dict[str, str] | None = None) -> tuple[int, bytes]:
    """POST through the ASGI app in this process, so the mocks apply. fastapi's TestClient would need httpx, which the backend does not install."""
    content = json.dumps(body).encode('utf-8') if body is not None else b''
    raw_headers = [(b'host', b'testserver'), (b'content-type', b'application/json'), (b'content-length', str(len(content)).encode())]
    raw_headers += [(name.lower().encode(), value.encode()) for name, value in (headers or {}).items()]
    scope = {
        'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1', 'method': 'POST', 'scheme': 'http',
        'path': path, 'raw_path': path.encode(), 'query_string': b'', 'root_path': '', 'headers': raw_headers,
        'client': ('127.0.0.1', 50000), 'server': ('testserver', 80),
    }
    request_messages = [{'type': 'http.request', 'body': content, 'more_body': False}]
    status: list[int] = []
    chunks: list[bytes] = []

    async def receive():
        if request_messages:
            return request_messages.pop(0)
        await asyncio.Event().wait()        # the client stays connected

    async def send(message):
        if message['type'] == 'http.response.start':
            status.append(message['status'])
        elif message['type'] == 'http.response.body':
            chunks.append(message.get('body', b''))

    asyncio.run(app_module.app(scope, receive, send))
    return status[0], b''.join(chunks)


class AttributionRuleTest(unittest.TestCase):
    def test_without_the_key_the_attribution_replaces_copyright_and_watermark(self):
        for copyright_value, watermark_value in [(False, True), (True, 'logo.png'), ('my own notice', False)]:
            dataframe = security.apply_attribution({'copyright': copyright_value, 'watermark': watermark_value}, unlocked=False)
            self.assertEqual(dataframe['copyright'], security.ATTRIBUTION_TEXT)
            self.assertIs(dataframe['watermark'], True)     # the standard logo, not the config's file

    def test_with_the_key_both_are_switches_with_the_standard_text_and_logo(self):
        self.assertEqual(security.apply_attribution({'copyright': 'my own notice', 'watermark': 'logo.png'}, unlocked=True), {'copyright': True, 'watermark': True})
        self.assertEqual(security.apply_attribution({'copyright': False, 'watermark': None}, unlocked=True), {'copyright': False, 'watermark': False})
        self.assertEqual(security.apply_attribution({}, unlocked=True), {'copyright': False, 'watermark': False})

    def test_key_check(self):
        with mock.patch.object(security, 'ATTRIBUTION_KEY', KEY):
            self.assertTrue(security.attribution_key_valid(KEY))
            self.assertFalse(security.attribution_key_valid(KEY + 'x'))
            self.assertFalse(security.attribution_key_valid(''))
            self.assertFalse(security.attribution_key_valid(None))
        # No key configured on the server: nothing unlocks, not even an empty key.
        with mock.patch.object(security, 'ATTRIBUTION_KEY', ''):
            self.assertFalse(security.attribution_key_valid(''))
            self.assertFalse(security.attribution_key_valid(KEY))


class AttributionApiTest(unittest.TestCase):
    def setUp(self) -> None:
        patcher = mock.patch.object(security, 'ATTRIBUTION_KEY', KEY)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_key_endpoint(self):
        header = security.ATTRIBUTION_KEY_HEADER
        valid = lambda headers=None: json.loads(post('/api/attribution-key', headers=headers)[1])
        self.assertEqual(valid({header: KEY}), {'valid': True})
        with mock.patch.object(app_module.asyncio, 'sleep', mock.AsyncMock()) as sleep:
            self.assertEqual(valid({header: 'guess'}), {'valid': False})
            self.assertEqual(valid(), {'valid': False})
        self.assertEqual(sleep.await_count, 2)      # wrong keys are answered slowly

    def test_render_endpoints_apply_the_attribution_unless_the_key_is_sent(self):
        payload = json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))
        payload['config']['dataframes'][0].update({'copyright': 'my own notice', 'watermark': False})
        rendered: list[dict] = []

        def fake_main(dataframe, **_kwargs):
            rendered.append({'copyright': dataframe['copyright'], 'watermark': dataframe['watermark']})
            raise RuntimeError('stop after the config check')

        requests = [
            ('/api/render-plot', payload, {}),
            ('/api/render-plot', payload, {security.ATTRIBUTION_KEY_HEADER: KEY}),
            ('/api/render-plot', payload, {security.ATTRIBUTION_KEY_HEADER: 'wrong'}),
            ('/api/download-plots', {'config': payload['config'], 'plots': [{'dataframe_index': 0, 'frame_index': 0}]}, {}),
            ('/api/download-plots', {'config': payload['config'], 'plots': [{'dataframe_index': 0, 'frame_index': 0}]}, {security.ATTRIBUTION_KEY_HEADER: KEY}),
        ]
        with mock.patch.object(plot_renderer.plot, 'main', side_effect=fake_main):
            for path, body, headers in requests:
                post(path, body, headers)

        attribution = {'copyright': security.ATTRIBUTION_TEXT, 'watermark': True}
        unlocked = {'copyright': True, 'watermark': False}
        self.assertEqual(rendered, [attribution, unlocked, attribution, attribution, unlocked])

    def test_only_the_key_gets_the_data_preview(self):
        with mock.patch.object(import_data, 'MATERIAL_PROPERTIES_DIR', DATASET_PATH.parent):
            responses = [
                json.loads(post('/api/import-database', {'import_file_name': DATASET_PATH.name}, headers)[1])
                for headers in ({}, {security.ATTRIBUTION_KEY_HEADER: 'wrong'}, {security.ATTRIBUTION_KEY_HEADER: KEY})
            ]
        self.assertTrue(all(response['success'] for response in responses))
        self.assertNotIn('preview', responses[0])
        self.assertNotIn('preview', responses[1])
        preview = responses[2]['preview']
        self.assertEqual(preview['columns'][:len(responses[2]['columns'])], responses[2]['columns'])
        self.assertEqual(len(preview['rows']), min(preview['total_rows'], import_data.PREVIEW_ROW_LIMIT))
        self.assertTrue(all(len(row) == len(preview['columns']) for row in preview['rows']))


if __name__ == '__main__':
    unittest.main()
