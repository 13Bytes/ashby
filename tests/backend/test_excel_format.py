"""Unit tests for the Excel format check and the dark mode background (no server needed)."""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

import pandas as pd

PROJECT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_DIR))

from backend.import_data import check_excel_format, prepare_sheet  # noqa: E402
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

    def test_harmless_quirks_are_not_reported(self) -> None:
        # Spreadsheet habits the plot copes with: no unit column, low above high, spaces around
        # names, a decimal comma typed as text, unnamed or repeated columns, an unnamed " low" column.
        data = pd.DataFrame({
            'Material ': ['PA6', 'PEEK'],
            'Density low ': ['1,1', 2.0],
            'Density high': [1.0, 1.4],
            'Unnamed: 3': ['note', None],
            ' low': [1, 2],
            'Material.1': ['x', 'y'],
        })
        self.assertEqual(check_excel_format(data), [])

    def test_empty_sheet_and_missing_quantities(self) -> None:
        self.assertEqual(codes(check_excel_format(pd.DataFrame())), ['empty_sheet'])
        self.assertEqual(codes(check_excel_format(pd.DataFrame(columns=['Material']))), ['empty_sheet'])
        # e.g. the column names are not in the first row
        self.assertEqual(codes(check_excel_format(pd.DataFrame({'Unnamed: 0': ['Material'], 'Unnamed: 1': ['Density low']}))), ['no_quantities'])

    def test_problems_that_keep_data_out_of_the_plot(self) -> None:
        data = pd.DataFrame({
            'Density low': ['n/a', 1.3],
            'Density high': [1.0, '>2'],
            'Strength low': [10, 20],
        })
        warnings = {warning['code']: warning for warning in check_excel_format(data)}
        self.assertEqual(warnings['incomplete_quantities']['quantities'], [{'name': 'Strength', 'missing': ['high']}])
        self.assertEqual(warnings['non_numeric_values']['columns'], [
            {'column': 'Density low', 'count': 1, 'example': 'n/a'},
            {'column': 'Density high', 'count': 1, 'example': '>2'},
        ])

    def test_prepare_sheet_strips_names_and_reads_numbers(self) -> None:
        data = prepare_sheet(pd.DataFrame({'Material ': ['PA6', 'PEEK'], 'Density low ': ['1,5', 'n/a'], 'Density high': [2, 3]}))
        self.assertEqual(list(data.columns), ['Material', 'Density low', 'Density high'])
        self.assertEqual(data['Density low'].iloc[0], 1.5)
        self.assertTrue(pd.isna(data['Density low'].iloc[1]))


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
