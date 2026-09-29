"""The row filter (Teable's format) applied to rows of every source (no server needed)."""
from __future__ import annotations

import importlib
import sys
import unittest
from pathlib import Path
from unittest import mock

PROJECT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_DIR))

import_module = importlib.import_module('backend.import_data.import_data')     # the package exports a function of the same name
from backend.import_data.filter import filter_data  # noqa: E402

NAN = float('nan')      # empty Excel cell
ROWS = [
    {'Gruppe': 'PC', 'Hersteller': 'Covestro', 'Density low': 1.2},
    {'Gruppe': 'PPSU', 'Hersteller': 'BASF', 'Density low': 1.29},
    {'Gruppe': 'PET', 'Hersteller': NAN, 'Density low': NAN},
]


def where(*conditions, conjunction='and'):
    return {'conjunction': conjunction, 'filterSet': list(conditions)}


def groups(filters) -> list[str]:
    return [row['Gruppe'] for row in filter_data(ROWS, filters)]


class FilterTest(unittest.TestCase):
    def test_text_ignores_case_and_numbers_compare_as_numbers(self):
        self.assertEqual(groups(where({'fieldId': 'Gruppe', 'operator': 'is', 'value': 'pc'})), ['PC'])
        self.assertEqual(groups(where({'fieldId': 'Density low', 'operator': 'is', 'value': '1.29'})), ['PPSU'])
        self.assertEqual(groups(where({'fieldId': 'Hersteller', 'operator': 'contains', 'value': 'estr'})), ['PC'])
        self.assertEqual(groups(where({'fieldId': 'Gruppe', 'operator': 'isAnyOf', 'value': ['pc', 'PET']})), ['PC', 'PET'])

    def test_empty_cells(self):
        self.assertEqual(groups(where({'fieldId': 'Hersteller', 'operator': 'isEmpty', 'value': None})), ['PET'])
        self.assertEqual(groups(where({'fieldId': 'Hersteller', 'operator': 'isNotEmpty', 'value': None})), ['PC', 'PPSU'])
        # an empty cell is no number, so it does not match a comparison (and "nan" does not contain "n")
        self.assertEqual(groups(where({'fieldId': 'Density low', 'operator': 'isLess', 'value': '1.25'})), ['PC'])
        self.assertEqual(groups(where({'fieldId': 'Hersteller', 'operator': 'contains', 'value': 'n'})), [])

    def test_and_or_and_nested_groups(self):
        pc = {'fieldId': 'Gruppe', 'operator': 'is', 'value': 'PC'}
        light = {'fieldId': 'Density low', 'operator': 'isLess', 'value': 1.25}
        basf = {'fieldId': 'Hersteller', 'operator': 'is', 'value': 'BASF'}
        self.assertEqual(groups(where(pc, basf, conjunction='or')), ['PC', 'PPSU'])
        self.assertEqual(groups(where(basf, where(pc, light), conjunction='or')), ['PC', 'PPSU'])
        self.assertEqual(groups(where(pc, basf)), [])

    def test_incomplete_conditions_and_empty_groups_keep_all_rows(self):
        everything = ['PC', 'PPSU', 'PET']
        self.assertEqual(groups({}), everything)
        self.assertEqual(groups(where(conjunction='or')), everything)
        self.assertEqual(groups(where({'fieldId': 'Gruppe', 'operator': 'is', 'value': ''})), everything)
        self.assertEqual(groups(where({'fieldId': '', 'operator': 'is', 'value': 'PC'})), everything)
        self.assertEqual(groups(where({'fieldId': 'Gruppe', 'operator': 'isAnyOf', 'value': []})), everything)

    def test_teable_rows_are_filtered_by_column_name_like_excel_rows(self):
        records = [{'Gruppe': 'PC', 'Density low': 1.2, 'Density high': 1.3}, {'Gruppe': 'PET', 'Density low': 1.4, 'Density high': 1.5}]
        with mock.patch.object(import_module.teable, 'fetch_records', return_value=records) as fetch:
            data = import_module.import_teable('https://teable.example/x', 'key', [{'name': 'Gruppe'}, {}],
                                               where({'fieldId': 'Gruppe', 'operator': 'is', 'value': 'PET'}), [['Density']])
        self.assertNotIn('filter_clause', fetch.call_args.kwargs)
        self.assertEqual(data['Gruppe'].tolist(), ['PET'])


if __name__ == '__main__':
    unittest.main()
