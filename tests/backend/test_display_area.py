"""Unit tests for the axis margin: relative margins and fixed values on the axis (no server needed)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

import numpy as np

PROJECT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_DIR))

from backend.plotting.formatting import dimension, plot_size  # noqa: E402


class NoMarker:
    """Stands in for the annotation markers: none that widen the display area."""
    def limits(self, dim):
        return [np.nan, np.nan]


DATA = np.array([[10.0, 1.0], [20.0, 100.0]])
SIDES = ['left', 'right', 'top', 'bottom']


class MarginTest(unittest.TestCase):
    def test_a_number_sets_all_sides_relative(self):
        self.assertEqual(plot_size.margin({'axis_margin': 0.1}), {side: (0.1, False) for side in SIDES})

    def test_sides_can_be_fixed_and_missing_sides_use_the_default(self):
        margin = plot_size.margin({'axis_margin': {'left': {'absolute': 5}, 'right': 0.2}})
        self.assertEqual(margin['left'], (5, True))
        self.assertEqual(margin['right'], (0.2, False))
        self.assertEqual(margin['top'], (0.12, False))

    def test_configs_before_version_6(self):
        # automatic_Display_Area_margin is read, set bounds of x_lim/y_lim become fixed values.
        margin = plot_size.margin({'automatic_Display_Area_margin': 0.05, 'x_lim': [0, None], 'y_lim': None})
        self.assertEqual(margin['left'], (0, True))
        self.assertEqual(margin['right'], (0.05, False))
        self.assertEqual(margin['bottom'], (0.05, False))
        # Automatic area switched off (null) without limits: the default margin.
        self.assertEqual(plot_size.margin({'automatic_Display_Area_margin': None})['top'], (0.12, False))

    def test_linear_axis(self):
        axis = dimension(DATA, 0, NoMarker(), False, (0, True), (0.1, False), 1)
        self.assertEqual(axis.low, 0)            # fixed value on the axis
        self.assertAlmostEqual(axis.high, 21)    # 20 + 0.1 * data range 10

    def test_fixed_value_on_a_log_axis_must_be_above_zero(self):
        axis = dimension(DATA, 1, NoMarker(), True, (0, True), (1000, True), 1)
        self.assertAlmostEqual(axis.low, 10 ** (0 - 0.12 * 2))    # 0 cannot be shown: default margin instead
        self.assertEqual(axis.high, 1000)


if __name__ == '__main__':
    unittest.main()
