from __future__ import annotations

import json
import mimetypes
import os
import uuid
import urllib.error
import urllib.parse
import urllib.request
import unittest
from pathlib import Path

from backend.app import _extract_columns_from_xlsx

PROJECT_DIR = Path(__file__).resolve().parents[2]
FIXTURE_PATH = PROJECT_DIR / 'tests' / 'fixtures' / 'render-config.json'
UPLOAD_FIXTURE_PATH = PROJECT_DIR / 'backend' / 'material_properties' / 'MatWeb_materials_export_TDW25.xlsx'
FILAMENT_UPLOAD_FIXTURE_PATH = PROJECT_DIR / 'backend' / 'material_properties' / 'MatWeb_materials_export_Filament.xlsx'


def build_multipart_body(fields: dict[str, str], files: dict[str, Path]) -> tuple[bytes, str]:
    boundary = f'ashby-{uuid.uuid4().hex}'
    chunks: list[bytes] = []

    for name, value in fields.items():
        chunks.extend(
            [
                f'--{boundary}\r\n'.encode('utf-8'),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode('utf-8'),
                value.encode('utf-8'),
                b'\r\n',
            ]
        )

    for name, path in files.items():
        content_type = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        chunks.extend(
            [
                f'--{boundary}\r\n'.encode('utf-8'),
                f'Content-Disposition: form-data; name="{name}"; filename="{path.name}"\r\n'.encode('utf-8'),
                f'Content-Type: {content_type}\r\n\r\n'.encode('utf-8'),
                path.read_bytes(),
                b'\r\n',
            ]
        )

    chunks.append(f'--{boundary}--\r\n'.encode('utf-8'))
    return b''.join(chunks), boundary


class BackendApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.base_url = os.environ.get('ASHBY_BACKEND_URL', 'http://127.0.0.1:8000').rstrip('/')
        cls.render_payload = json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))

    def post_json(self, path: str, payload: dict) -> tuple[int, dict[str, str], bytes]:
        request = urllib.request.Request(
            f'{self.base_url}{path}',
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST',
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, dict(response.headers.items()), response.read()

    def post_multipart(self, path: str, fields: dict[str, str], files: dict[str, Path]) -> tuple[int, dict[str, str], bytes]:
        body, boundary = build_multipart_body(fields, files)
        request = urllib.request.Request(
            f'{self.base_url}{path}',
            data=body,
            headers={'Content-Type': f'multipart/form-data; boundary={boundary}'},
            method='POST',
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, dict(response.headers.items()), response.read()

    def header(self, headers: dict[str, str], name: str) -> str:
        lowered = {key.lower(): value for key, value in headers.items()}
        return lowered.get(name.lower(), '')

    def test_render_plot_returns_svg_image(self) -> None:
        status, headers, body = self.post_json('/api/render-plot', self.render_payload)

        self.assertEqual(status, 200)
        self.assertIn('image/svg+xml', self.header(headers, 'Content-Type'))
        self.assertTrue(body.startswith(b'<?xml'))
        self.assertIn(b'<svg', body)

    def test_render_plot_returns_warning_messages_header(self) -> None:
        warning_payload = json.loads(json.dumps(self.render_payload))
        warning_payload['config']['dataframes'][0]['axes'][0]['columns'] = [
            'Deflection Temperature at 18 MPa 264 psi',
            'Deflection Temperature at 1.8 MPa 264 psi',
        ]

        status, headers, body = self.post_json('/api/render-plot', warning_payload)
        messages_header = self.header(headers, 'X-Ashby-Messages')
        messages = json.loads(urllib.parse.unquote(messages_header))

        self.assertEqual(status, 200)
        self.assertIn('image/svg+xml', self.header(headers, 'Content-Type'))
        self.assertIn(b'<svg', body)
        self.assertGreater(len(messages), 0)
        self.assertTrue(any('does not exist in your dataset' in message for message in messages))

    def test_render_plot_accepts_frontend_style_empty_trailing_layer_name(self) -> None:
        payload = json.loads(json.dumps(self.render_payload))
        payload['config']['dataframes'][0]['frames'][0]['layers'] = [
            {
                'name': 'Material',
                'whitelist_flag': False,
                'whitelist': [],
                'alpha': 0.4,
                'linewidth': 1.5,
            },
            {
                'name': '',
                'whitelist_flag': False,
                'whitelist': None,
                'alpha': None,
                'linewidth': 1.5,
                'alpha_points': None,
                'alpha_areas': None,
            },
        ]

        status, headers, body = self.post_json('/api/render-plot', payload)

        self.assertEqual(status, 200)
        self.assertIn('image/svg+xml', self.header(headers, 'Content-Type'))
        self.assertIn(b'<svg', body)

    def test_import_database_upload_returns_columns_and_cached_filename(self) -> None:
        status, headers, body = self.post_multipart(
            '/api/import-database',
            fields={'import_sheet': '0'},
            files={'file': UPLOAD_FIXTURE_PATH},
        )
        payload = json.loads(body.decode('utf-8'))

        self.assertEqual(status, 200)
        self.assertIn('application/json', self.header(headers, 'Content-Type'))
        self.assertTrue(payload['success'])
        self.assertGreater(len(payload['columns']), 0)
        self.assertTrue(payload['import_file_name'].endswith('.xlsx'))

    def test_extract_columns_from_filament_xlsx_source(self) -> None:
        columns = _extract_columns_from_xlsx(FILAMENT_UPLOAD_FIXTURE_PATH.read_bytes(), 0)

        self.assertGreater(len(columns), 200)
        self.assertIn('Material', columns)
        self.assertIn('Bed Temp low', columns)
        self.assertIn('Bed Temp high', columns)
        self.assertIn('Bed Temp unit', columns)

    def test_import_database_upload_extracts_expected_columns_from_filament_source(self) -> None:
        status, headers, body = self.post_multipart(
            '/api/import-database',
            fields={'import_sheet': '0'},
            files={'file': FILAMENT_UPLOAD_FIXTURE_PATH},
        )
        payload = json.loads(body.decode('utf-8'))

        self.assertEqual(status, 200)
        self.assertIn('application/json', self.header(headers, 'Content-Type'))
        self.assertTrue(payload['success'])
        self.assertIn('Material', payload['columns'])
        self.assertIn('Bed Temp low', payload['columns'])
        self.assertIn('Bed Temp high', payload['columns'])
        self.assertIn('Bed Temp unit', payload['columns'])
        self.assertTrue(payload['import_file_name'].endswith('.xlsx'))

    def test_uploaded_import_file_name_can_be_rendered(self) -> None:
        _, _, upload_body = self.post_multipart(
            '/api/import-database',
            fields={'import_sheet': '0'},
            files={'file': UPLOAD_FIXTURE_PATH},
        )
        upload_payload = json.loads(upload_body.decode('utf-8'))
        render_payload = json.loads(json.dumps(self.render_payload))
        render_payload['config']['dataframes'][0]['import_file_name'] = upload_payload['import_file_name']

        status, headers, body = self.post_json('/api/render-plot', render_payload)

        self.assertEqual(status, 200)
        self.assertIn('image/svg+xml', self.header(headers, 'Content-Type'))
        self.assertIn(b'<svg', body)


if __name__ == '__main__':
    unittest.main()
