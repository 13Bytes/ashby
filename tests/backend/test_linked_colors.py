"""Unit tests for the colors taken from another setting: a guideline's label in its line color, an
annotation's marker and arrow in its text color (no server needed)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock

PROJECT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_DIR))

from backend.plotting.plot_acessories import draw_guideline, marker  # noqa: E402


class Storage:
    """Stands in for format_storage: material colors and plain labels."""
    material_colors = {'default': '#000000', 'steel': '#123456'}

    def get_color(self, color):
        return self.material_colors.get(color, color)

    def language_text(self, label):
        return label


class Axis:
    def offset(self, value, relative):
        return value + relative


class PlotSize:
    x = Axis()
    y = Axis()


def draw_annotation(annotation: dict) -> mock.MagicMock:
    ax = mock.MagicMock()
    markers = marker([{}, {'axes': {'a': 1, 'b': 2}, **annotation}], ['a', 'b'], [None, None], ax)
    markers.create_annotations(Storage(), PlotSize())
    return ax


class GuidelineLabelColorTest(unittest.TestCase):
    def draw(self, guideline: dict) -> str:
        ax = mock.MagicMock()
        draw_guideline(Storage(), [{'y': 1, 'label': 'g', **guideline}], 0, 10, 0, 10, 'black', ax)
        return ax.text.call_args.kwargs['color']

    def test_without_font_color_the_label_has_the_line_color(self) -> None:
        self.assertEqual(self.draw({'line_props': {'color': 'steel'}}), '#123456')

    def test_an_own_font_color_stays(self) -> None:
        self.assertEqual(self.draw({'line_props': {'color': 'steel'}, 'font_color': 'red'}), 'red')


class AnnotationColorTest(unittest.TestCase):
    def test_without_their_own_color_marker_and_arrow_have_the_text_color(self) -> None:
        ax = draw_annotation({'text': {'name': 'n', 'color': 'steel'}, 'marker': {'marker_symbol': 'o'}, 'arrow': {'width': 1}})
        self.assertEqual(ax.scatter.call_args.kwargs['c'], '#123456')
        arrow = ax.annotate.call_args.kwargs['arrowprops']
        self.assertEqual((arrow['facecolor'], arrow['edgecolor'], arrow['width']), ('#123456', '#123456', 1))

    def test_own_colors_stay(self) -> None:
        ax = draw_annotation({'text': {'name': 'n', 'color': 'steel'}, 'marker': {'color': 'red'}, 'arrow': {'facecolor': 'blue'}})
        self.assertEqual(ax.scatter.call_args.kwargs['c'], 'red')
        self.assertEqual(ax.annotate.call_args.kwargs['arrowprops'], {'facecolor': 'blue'})


if __name__ == '__main__':
    unittest.main()
