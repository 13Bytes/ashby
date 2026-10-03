"""Unit tests for the dataframe's font settings reaching matplotlib (no server needed)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import matplotlib  # noqa: E402

matplotlib.use('Agg')

import matplotlib.pyplot as plt  # noqa: E402

from backend import plot  # noqa: E402


class FontRcParamsTest(unittest.TestCase):
    def test_the_chosen_font_comes_first_in_its_family(self) -> None:
        params = plot._font_rc_params({'font_style': 'serif', 'font': 'Times New Roman', 'font_size': 18})
        self.assertEqual(params['font.family'], 'serif')
        self.assertEqual(params['font.size'], 18)
        self.assertEqual(params['font.serif'][0], 'Times New Roman')
        self.assertIn('DejaVu Serif', params['font.serif'])     # fallback where the font is not installed
        self.assertEqual(params['font.serif'].count('Times New Roman'), 1)

    def test_unknown_family_empty_font_and_bad_size_fall_back(self) -> None:
        params = plot._font_rc_params({'font_style': 'gothic', 'font': '  ', 'font_size': 'big'})
        self.assertEqual(params, {'font.family': 'sans-serif'})

    def test_defaults_without_font_settings(self) -> None:
        params = plot._font_rc_params({})
        self.assertEqual((params['font.family'], params['font.size'], params['font.sans-serif'][0]), ('sans-serif', 22, 'Arial'))


class MainFontTest(unittest.TestCase):
    def test_fonts_apply_while_drawing_and_are_restored_after(self) -> None:
        seen = {}

        def draw(*_args):
            seen['family'] = list(plt.rcParams['font.family'])
            seen['size'] = plt.rcParams['font.size']
            seen['first'] = plt.rcParams['font.monospace'][0]
            return []

        before = (list(plt.rcParams['font.family']), plt.rcParams['font.size'])
        with mock.patch.object(plot, '_plot_frames', side_effect=draw):
            plot.main({'font': {'font_style': 'monospace', 'font': 'Courier New', 'font_size': 12}}, interactive=False, frontend=True)
        self.assertEqual(seen, {'family': ['monospace'], 'size': 12, 'first': 'Courier New'})
        self.assertEqual((list(plt.rcParams['font.family']), plt.rcParams['font.size']), before)


if __name__ == '__main__':
    unittest.main()
