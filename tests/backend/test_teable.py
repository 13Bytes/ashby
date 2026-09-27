"""Unit tests for backend/import_data/teable.py with mocked HTTP responses (no server needed)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.import_data import teable  # noqa: E402

BROWSER_URL = 'https://teable.example.com/base/bseABC/table/tblXYZ123/viwVIEW456'
API_URL = 'https://teable.example.com/api/table/tblXYZ123/record'


def _response(status: int = 200, payload=None, text: str = ''):
    response = mock.Mock()
    response.status_code = status
    response.ok = 200 <= status < 300
    response.text = text
    if isinstance(payload, Exception):
        response.json.side_effect = payload
    else:
        response.json.return_value = payload
    return response


class ResolveTeableSourceTest(unittest.TestCase):
    def test_browser_url_is_mapped_to_the_record_api_with_view(self) -> None:
        source = teable.resolve_teable_source(BROWSER_URL)
        self.assertEqual(source.records_url, API_URL)
        self.assertEqual(source.fields_url, 'https://teable.example.com/api/table/tblXYZ123/field')
        self.assertEqual(source.view_id, 'viwVIEW456')

    def test_api_url_is_kept(self) -> None:
        source = teable.resolve_teable_source(f'  {API_URL}  ')
        self.assertEqual(source.records_url, API_URL)
        self.assertIsNone(source.view_id)

    def test_view_id_from_query_string(self) -> None:
        self.assertEqual(teable.resolve_teable_source(f'{API_URL}?viewId=viwQ1').view_id, 'viwQ1')

    def test_invalid_urls_raise_a_readable_error(self) -> None:
        for url in ('', 'teable.example.com/api/table/tblX/record', 'https://teable.example.com/base/bseABC'):
            with self.assertRaises(teable.TeableError):
                teable.resolve_teable_source(url)


class AuthorizationHeaderTest(unittest.TestCase):
    def test_bearer_prefix_is_added_once(self) -> None:
        self.assertEqual(teable.authorization_header('teable_abc'), 'Bearer teable_abc')
        self.assertEqual(teable.authorization_header(' Bearer teable_abc '), 'Bearer teable_abc')
        self.assertEqual(teable.authorization_header('bearer teable_abc'), 'bearer teable_abc')

    def test_missing_key_raises(self) -> None:
        with self.assertRaises(teable.TeableError):
            teable.authorization_header('  ')


class FetchTest(unittest.TestCase):
    @mock.patch('backend.import_data.teable.requests.get')
    def test_records_are_paginated_and_use_the_view(self, get) -> None:
        full_page = {'records': [{'fields': {'n': index}} for index in range(teable.PAGE_SIZE)]}
        get.side_effect = [_response(payload=full_page), _response(payload={'records': [{'fields': {'n': 'last'}}]})]

        records = teable.fetch_records(BROWSER_URL, 'teable_abc', filter_clause={'conjunction': 'and', 'filterSet': []})

        self.assertEqual(len(records), teable.PAGE_SIZE + 1)
        first_call, second_call = get.call_args_list
        self.assertEqual(first_call.args[0], API_URL)
        self.assertEqual(first_call.kwargs['headers']['Authorization'], 'Bearer teable_abc')
        self.assertEqual(first_call.kwargs['params']['viewId'], 'viwVIEW456')
        self.assertIn('filter', first_call.kwargs['params'])
        self.assertEqual(second_call.kwargs['params']['skip'], teable.PAGE_SIZE)

    @mock.patch('backend.import_data.teable.requests.get')
    def test_empty_filter_is_not_sent(self, get) -> None:
        get.return_value = _response(payload={'records': []})
        teable.fetch_records(API_URL, 'teable_abc', filter_clause={})
        self.assertNotIn('filter', get.call_args.kwargs['params'])

    @mock.patch('backend.import_data.teable.requests.get')
    def test_field_names_come_from_the_field_list(self, get) -> None:
        get.return_value = _response(payload=[{'name': 'Density low'}, {'name': ' Material '}, {'name': ''}])
        self.assertEqual(teable.fetch_field_names(BROWSER_URL, 'teable_abc'), ['Density low', 'Material'])
        self.assertEqual(get.call_args.kwargs['params'], {'viewId': 'viwVIEW456'})

    @mock.patch('backend.import_data.teable.requests.get')
    def test_errors_are_reported_readably(self, get) -> None:
        cases = [
            (_response(status=401), 'access denied'),
            (_response(status=404), 'not found'),
            (_response(status=500, text='boom'), '500'),
            (_response(payload=ValueError('not json')), 'did not return JSON'),
        ]
        for response, expected in cases:
            get.return_value = response
            with self.assertRaises(teable.TeableError) as context:
                teable.fetch_records(API_URL, 'teable_abc')
            self.assertIn(expected, str(context.exception))


if __name__ == '__main__':
    unittest.main()
