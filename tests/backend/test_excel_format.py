"""Unit tests for the Excel format check and the dark mode background (no server needed)."""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

import pandas as pd

PROJECT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_DIR))

from backend.import_data import check_excel_format  # noqa: E402
from backend.plot_renderer import RequestDataSource, render_plot_image  # noqa: E402

FIXTURE_PATH = PROJECT_DIR / 'tests' / 'fixtures' / 'render-config.json'
DATASET_PATH = PROJECT_DIR / 'tests' / 'dataset_1.xlsx'


def codes(warnings: list[dict]) -> list[str]:
    return [warning['code'] for warning in warnings]


class CheckExcelFormatTest(unittest.TestCase):
    def test_a_well_formed_sheet_has_no_warnings(self) -> None:
        data = pd.DataFrame({
            'Material': ['PA6', 'PEEK'],
            'Density low': [1.1, 1.3],
            'Density high': [1.2, 1.3],
            'Density unit': ['g/cm³', 'g/cm³'],
        })
        self.assertEqual(check_excel_format(data), [])

    def test_empty_sheet(self) -> None:
        self.assertEqual(codes(check_excel_format(pd.DataFrame())), ['empty_sheet'])
        self.assertEqual(codes(check_excel_format(pd.DataFrame(columns=['Material']))), ['empty_sheet'])

    def test_problems_are_reported_with_their_columns(self) -> None:
        data = pd.DataFrame({
            'Material': ['PA6', 'PEEK'],
            'Unnamed: 1': ['note', None],   # values without a column name
            'Unnamed: 2': [None, None],     # empty: ignored
            'Layer ': ['a', 'b'],
            'Density low': ['1,1', 1.3],
            'Density high': [1.0, 1.4],
            'Density unit': ['g/cm³', 'g/cm³'],
            'Strength low': [10, 20],
            'Strength high': [30, 40],
            'Material.1': ['x', 'y'],       # pandas' name for a repeated "Material"
        })
        warnings = {warning['code']: warning for warning in check_excel_format(data)}
        self.assertEqual(warnings['unnamed_columns']['columns'], ['B'])
        self.assertEqual(warnings['padded_names']['columns'], ['Layer '])
        self.assertEqual(warnings['duplicate_names']['columns'], ['Material'])
        self.assertEqual(warnings['incomplete_quantities']['quantities'], [{'name': 'Strength', 'missing': ['unit']}])
        self.assertEqual(warnings['non_numeric_values']['columns'], [{'column': 'Density low', 'count': 1, 'example': '1,1'}])
        self.assertNotIn('no_quantities', warnings)
        self.assertNotIn('low_above_high', warnings)

    def test_low_above_high_and_missing_quantities(self) -> None:
        swapped = pd.DataFrame({'Density low': [2, 1], 'Density high': [1, 2], 'Density unit': ['', '']})
        self.assertEqual(check_excel_format(swapped), [{'code': 'low_above_high', 'count': 1, 'quantities': [{'name': 'Density', 'count': 1}]}])
        self.assertEqual(codes(check_excel_format(pd.DataFrame({'Material': ['PA6']}))), ['no_quantities'])


class DarkModeBackgroundTest(unittest.TestCase):
    def render(self, dark_mode: bool, transparent: bool) -> bytes:
        config = json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))['config']
        dataframe = config['dataframes'][0]
        dataframe.update(dark_mode=dark_mode, transparent=transparent, watermark=False, copyright=False)
        dataframe['frames'][0].pop('dark_mode', None)
        sources = {0: RequestDataSource(kind='xlsx', content=DATASET_PATH.read_bytes(), filename=DATASET_PATH.name)}
        return render_plot_image(config, data_sources=sources).content

    def test_a_dark_plot_that_is_not_transparent_gets_a_dark_background(self) -> None:
        # The figure background is the first path of the SVG.
        self.assertIn(b'fill: #121212', self.render(dark_mode=True, transparent=False)[:4000])
        self.assertNotIn(b'fill: #121212', self.render(dark_mode=False, transparent=False)[:4000])


if __name__ == '__main__':
    unittest.main()
