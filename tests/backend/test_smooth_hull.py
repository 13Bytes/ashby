"""Tests for the smooth hulls: every point inside with a margin, a simple outline, and no corners
(the smallest radius of curvature stays at least about the smallest margin). No server needed."""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest import mock

PROJECT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_DIR))

import numpy as np  # noqa: E402
import shapely  # noqa: E402

from backend.plotting import plot_hull  # noqa: E402
from backend.plotting.smooth_hull import BASE_MARGIN, min_radius_of_curvature, smooth_hull  # noqa: E402
from backend.plot_renderer import RequestDataSource, render_plot_image  # noqa: E402

FIXTURE_PATH = PROJECT_DIR / 'tests' / 'fixtures' / 'render-config.json'
# Smallest radius of curvature allowed, in axes heights. The check samples the outline every 0.002, so a
# corner shows as at most 0.002 / its turning angle: a 90° corner 0.0013, a 15° kink 0.0076.
NO_CORNER_RADIUS = 0.01
TINY_RADIUS = 0.9 * BASE_MARGIN     # a tiny group is a bubble about its margin wide
DATASET_PATH = PROJECT_DIR / 'tests' / 'dataset_1.xlsx'

rng = np.random.default_rng(3)
CENTER = np.array([0.8, 0.5])
CASES = {
    'triangle': CENTER + [[0, 0], [0.12, 0.02], [0.03, 0.1]],
    'two points': CENTER + [[0, 0], [0.2, 0.1]],
    'points on a line': CENTER + np.column_stack([np.linspace(0, 0.3, 5), np.linspace(0, 0.15, 5)]),
    'L shape': CENTER + np.vstack([np.column_stack([np.linspace(0, 0.3, 8), np.zeros(8)]), np.column_stack([np.zeros(6), np.linspace(0.05, 0.3, 6)])]),
    'outlier': CENTER + np.vstack([rng.normal(0, 0.02, (10, 2)), [[0.25, 0.15]]]),
    'two clusters': CENTER + np.vstack([rng.normal(0, 0.015, (6, 2)), rng.normal(0, 0.015, (6, 2)) + [0.35, 0.05]]),
    'many points': CENTER + rng.normal(0, 0.06, (300, 2)),
    'value ranges (a box)': CENTER + [[0, 0], [0.2, 0], [0, 0.08], [0.2, 0.08]],
    'tiny group': CENTER + rng.normal(0, 0.002, (5, 2)),
    'duplicates': CENTER + [[0, 0], [0, 0], [0.1, 0.05], [0.1, 0.05], [0.02, 0.08]],
}


def assert_good_hull(test: unittest.TestCase, ring: np.ndarray, points: np.ndarray, min_gap: float, min_radius: float) -> None:
    outline = shapely.Polygon(ring)
    test.assertTrue(outline.is_valid and outline.exterior.is_simple, 'the outline crosses itself')
    test.assertTrue(shapely.contains_xy(outline, points[:, 0], points[:, 1]).all(), 'a point lies outside')
    test.assertGreaterEqual(float(shapely.distance(outline.exterior, shapely.points(points)).min()), min_gap, 'a point is too close to the edge')
    test.assertGreaterEqual(min_radius_of_curvature(ring), min_radius, 'the outline has a corner')


class SmoothHullTest(unittest.TestCase):
    def test_every_case_has_a_margin_and_no_corners(self) -> None:
        for name, points in CASES.items():
            with self.subTest(name):
                points = np.asarray(points, dtype=float)
                min_radius = TINY_RADIUS if name == 'tiny group' else NO_CORNER_RADIUS
                assert_good_hull(self, smooth_hull(points), points, min_gap=0.99 * BASE_MARGIN, min_radius=min_radius)

    def test_the_corner_check_finds_corners(self) -> None:
        square = np.array([[0, 0], [0.2, 0], [0.2, 0.2], [0, 0.2]], dtype=float)
        self.assertLess(min_radius_of_curvature(square), TINY_RADIUS)
        kinked = np.array([[0, 0], [0.1, 0], [0.2, 0.0268], [0.2, 0.2], [0, 0.2]], dtype=float)     # 15° bend at (0.1, 0)
        self.assertLess(min_radius_of_curvature(kinked), NO_CORNER_RADIUS)


class SmoothHullRenderTest(unittest.TestCase):
    """The hulls of a real plot, measured on screen (in axes heights) after rendering."""

    def render(self, log_axes: bool) -> list[tuple[np.ndarray, np.ndarray]]:
        measured: list[tuple[np.ndarray, np.ndarray]] = []
        finish = plot_hull.plotter_graphics.finish_hulls

        def measure(graphics) -> None:
            pending = [(points, fill) for points, fill, _ in graphics.pending_hulls]
            finish(graphics)
            height = graphics.ax.bbox.height
            for points, fill in pending:
                ring = graphics.ax.transData.transform(fill[0].get_xy())[:-1] / height
                measured.append((ring, graphics.ax.transData.transform(points) / height))

        config = json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))['config']
        frame = config['dataframes'][0]['frames'][0]
        frame.update(algorithm='smooth', log_x_flag=log_axes, log_y_flag=log_axes)
        sources = {0: RequestDataSource(kind='xlsx', content=DATASET_PATH.read_bytes(), filename=DATASET_PATH.name)}
        with mock.patch.object(plot_hull.plotter_graphics, 'finish_hulls', measure):
            render_plot_image(config, data_sources=sources)
        return measured

    def test_hulls_on_linear_and_log_axes(self) -> None:
        for log_axes in (False, True):
            with self.subTest(log_axes=log_axes):
                hulls = self.render(log_axes)
                self.assertGreater(len(hulls), 5)
                for ring, points in hulls:
                    assert_good_hull(self, ring, points, min_gap=0.99 * BASE_MARGIN, min_radius=NO_CORNER_RADIUS)


if __name__ == '__main__':
    unittest.main()
