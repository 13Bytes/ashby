"""The attribution on plots rendered by this server, and the key that unlocks the copyright and watermark switches."""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest import mock

PROJECT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_DIR))

from fastapi.testclient import TestClient  # noqa: E402

from backend import app as app_module, plot_renderer, security  # noqa: E402

FIXTURE_PATH = PROJECT_DIR / 'tests' / 'fixtures' / 'render-config.json'
KEY = 'correct-horse-battery-staple-42'


class AttributionRuleTest(unittest.TestCase):
    def test_without_the_key_the_attribution_replaces_copyright_and_watermark(self):
        for copyright_value, watermark_value in [(False, True), (True, 'logo.png'), ('my own notice', False)]:
            dataframe = security.apply_attribution({'copyright': copyright_value, 'watermark': watermark_value}, unlocked=False)
            self.assertEqual(dataframe['copyright'], security.ATTRIBUTION_TEXT)
            self.assertIs(dataframe['watermark'], False)

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
        self.client = TestClient(app_module.app)
        patcher = mock.patch.object(security, 'ATTRIBUTION_KEY', KEY)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_key_endpoint(self):
        header = security.ATTRIBUTION_KEY_HEADER
        self.assertEqual(self.client.post('/api/attribution-key', headers={header: KEY}).json(), {'valid': True})
        with mock.patch.object(app_module.asyncio, 'sleep', mock.AsyncMock()) as sleep:
            self.assertEqual(self.client.post('/api/attribution-key', headers={header: 'guess'}).json(), {'valid': False})
            self.assertEqual(self.client.post('/api/attribution-key').json(), {'valid': False})
        self.assertEqual(sleep.await_count, 2)      # wrong keys are answered slowly

    def test_render_endpoints_apply_the_attribution_unless_the_key_is_sent(self):
        payload = json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))
        payload['config']['dataframes'][0].update({'copyright': 'my own notice', 'watermark': True})
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
                self.client.post(path, json=body, headers=headers)

        attribution = {'copyright': security.ATTRIBUTION_TEXT, 'watermark': False}
        unlocked = {'copyright': True, 'watermark': True}
        self.assertEqual(rendered, [attribution, unlocked, attribution, attribution, unlocked])


if __name__ == '__main__':
    unittest.main()
