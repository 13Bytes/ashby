"""Unit tests for the error details of backend/plot_renderer.py (no server needed)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import threading  # noqa: E402
import time  # noqa: E402
from unittest import mock  # noqa: E402

from backend import plot_renderer  # noqa: E402
from backend.import_data import teable  # noqa: E402
from backend.plot_renderer import MAX_LOG_CHARS, clean_log, describe_exception, get_render_status, render_plot_image  # noqa: E402


class DescribeExceptionTest(unittest.TestCase):
    def test_location_points_at_the_backend_code(self) -> None:
        try:
            teable.resolve_teable_source('')
        except teable.TeableError as error:
            details = describe_exception(error)
        self.assertEqual(details['error_type'], 'TeableError')
        self.assertTrue(details['message'].startswith('TeableError: Invalid Teable URL'))
        self.assertRegex(details['location'], r'^import_data/teable\.py:\d+ in resolve_teable_source: raise TeableError')
        self.assertIn('Traceback (most recent call last)', details['traceback'])

    def test_key_errors_show_their_type(self) -> None:
        try:
            {}['Material']
        except KeyError as error:
            self.assertEqual(describe_exception(error)['message'], "KeyError: 'Material'")


class CleanLogTest(unittest.TestCase):
    def test_color_codes_are_removed_and_long_logs_keep_their_end(self) -> None:
        self.assertEqual(clean_log('\x1b[31mERROR\x1b[0m done'), 'ERROR done')
        long_log = 'a' * MAX_LOG_CHARS + 'END'
        cleaned = clean_log(long_log)
        self.assertTrue(cleaned.endswith('END'))
        self.assertIn('log truncated', cleaned)


class RenderStatusTest(unittest.TestCase):
    def test_running_and_queued_renders_report_their_state(self) -> None:
        release = threading.Event()

        def slow_main(dataframe, **_kwargs):
            print('creating frame 1 of 1')
            release.wait(5)
            raise RuntimeError('stop after the status check')

        config = {'dataframes': [{'frames': [{}]}]}
        with mock.patch.object(plot_renderer.plot, 'main', slow_main):
            workers = [
                threading.Thread(target=self._render_ignoring_errors, args=(config, request_id))
                for request_id in ('first', 'second')
            ]
            workers[0].start()
            self._wait_until(lambda: (get_render_status('first') or {}).get('state') == 'running')
            workers[1].start()
            self._wait_until(lambda: get_render_status('second') is not None)

            first, second = get_render_status('first'), get_render_status('second')
            self.assertEqual(first['state'], 'running')
            self.assertEqual(first['output_tail'], ['creating frame 1 of 1'])
            self.assertEqual(second['state'], 'queued')
            self.assertEqual(second['queued_renders'], 0)

            release.set()
            for worker in workers:
                worker.join(5)
        self.assertIsNone(get_render_status('first'))
        self.assertIsNone(get_render_status('unknown-id'))

    @staticmethod
    def _render_ignoring_errors(config, request_id) -> None:
        try:
            render_plot_image(config, request_id=request_id)
        except plot_renderer.PlotRenderError:
            pass

    @staticmethod
    def _wait_until(condition, timeout: float = 5) -> None:
        deadline = time.monotonic() + timeout
        while not condition():
            if time.monotonic() > deadline:
                raise AssertionError('condition not reached')
            time.sleep(0.01)


if __name__ == '__main__':
    unittest.main()
