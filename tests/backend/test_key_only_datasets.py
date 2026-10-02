"""Provided datasets whose file or folder name starts with "#" are only for holders of the attribution key."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

PROJECT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_DIR))

import importlib  # noqa: E402

from backend import plot_renderer  # noqa: E402

import_data = importlib.import_module('backend.import_data.import_data')
FIXTURE_PATH = PROJECT_DIR / 'tests' / 'fixtures' / 'render-config.json'


class KeyOnlyDatasetsTest(unittest.TestCase):
    def setUp(self) -> None:
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        for name in ('Public.xlsx', '#Partners.xlsx', '#internal/Prices.xlsx', 'shared/Plastics.xlsx', '~$Public.xlsx'):
            (self.root / name).parent.mkdir(parents=True, exist_ok=True)
            (self.root / name).write_bytes(b'')
        patcher = mock.patch.object(import_data, 'MATERIAL_PROPERTIES_DIR', self.root)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_the_list_shows_key_only_datasets_with_the_key_only(self):
        self.assertEqual(import_data.list_available_import_files(), ['Public.xlsx', 'shared/Plastics.xlsx'])
        self.assertEqual(import_data.list_available_import_files(unlocked=True), ['#Partners.xlsx', '#internal/Prices.xlsx', 'Public.xlsx', 'shared/Plastics.xlsx'])

    def test_without_the_key_a_key_only_dataset_is_missing(self):
        import_data.check_dataset_access('Public.xlsx', unlocked=False)
        import_data.check_dataset_access('Missing.xlsx', unlocked=False)     # reported by import_data() itself
        import_data.check_dataset_access('#Partners.xlsx', unlocked=True)
        for name in ('#Partners.xlsx', '#internal/Prices.xlsx', 'shared/../#Partners.xlsx'):
            with self.assertRaisesRegex(FileNotFoundError, 'Unable to locate'):
                import_data.check_dataset_access(name, unlocked=False)

    def test_rendering_a_key_only_dataset_needs_the_key(self):
        payload = json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))
        payload['config']['dataframes'][0]['import_file_name'] = '#Partners.xlsx'
        rendered: list[bool] = []

        def fake_main(*_args, **_kwargs):
            rendered.append(True)
            raise RuntimeError('stop after the access check')

        with mock.patch.object(plot_renderer.plot, 'main', side_effect=fake_main):
            for unlocked in (False, True):
                with self.assertRaises(plot_renderer.PlotRenderError) as error:
                    plot_renderer.render_plot_image(payload['config'], attribution_unlocked=unlocked)
                self.assertIn('Unable to locate' if not unlocked else 'stop after', str(error.exception))
        self.assertEqual(rendered, [True])     # only the render with the key reached the plot


if __name__ == '__main__':
    unittest.main()
