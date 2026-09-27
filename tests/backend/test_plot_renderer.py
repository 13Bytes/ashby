"""Unit tests for the error details of backend/plot_renderer.py (no server needed)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.import_data import teable  # noqa: E402
from backend.plot_renderer import MAX_LOG_CHARS, clean_log, describe_exception  # noqa: E402


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


if __name__ == '__main__':
    unittest.main()
