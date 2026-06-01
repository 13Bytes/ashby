from __future__ import annotations

import json
import mimetypes
import os
import socket
import subprocess
import sys
import tempfile
import time
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
        cls.server_process: subprocess.Popen[str] | None = None
        configured_base_url = os.environ.get('ASHBY_BACKEND_URL')
        if configured_base_url:
            cls.base_url = configured_base_url.rstrip('/')
        else:
            cls.base_url = cls.start_test_server()
        cls.render_payload = json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))

    @classmethod
    def tearDownClass(cls) -> None:
        if cls.server_process is None:
            return
        cls.server_process.terminate()
        try:
            cls.server_process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            cls.server_process.kill()
            cls.server_process.wait(timeout=10)

    @classmethod
    def start_test_server(cls) -> str:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]

        env = os.environ.copy()
        env['PYTHONPATH'] = str(PROJECT_DIR)
        env.setdefault('MPLCONFIGDIR', tempfile.mkdtemp(prefix='ashby-mpl-'))
        cls.server_process = subprocess.Popen(
            [
                sys.executable,
                '-m',
                'uvicorn',
                'backend.app:app',
                '--host',
                '127.0.0.1',
                '--port',
                str(port),
                '--log-level',
                'warning',
            ],
            cwd=PROJECT_DIR,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )

        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            if cls.server_process.poll() is not None:
                output = cls.server_process.stdout.read() if cls.server_process.stdout else ''
                raise RuntimeError(f'Backend test server exited early:\n{output}')
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(0.2)
                if sock.connect_ex(('127.0.0.1', port)) == 0:
                    return f'http://127.0.0.1:{port}'
            time.sleep(0.1)

        cls.server_process.terminate()
        try:
            output, _ = cls.server_process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            cls.server_process.kill()
            output, _ = cls.server_process.communicate(timeout=5)
        raise RuntimeError(f'Backend test server did not start within 20 seconds:\n{output}')

    def post_json(self, path: str, payload: dict) -> tuple[int, dict[str, str], bytes]:
        request = urllib.request.Request(
            f'{self.base_url}{path}',
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST',
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, dict(response.headers.items()), response.read()

    def get(self, path: str) -> tuple[int, dict[str, str], bytes]:
        with urllib.request.urlopen(f'{self.base_url}{path}', timeout=30) as response:
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

    def test_health_endpoint_reports_backend_availability(self) -> None:
        status, headers, body = self.get('/api/health')
        payload = json.loads(body.decode('utf-8'))

        self.assertEqual(status, 200)
        self.assertIn('application/json', self.header(headers, 'Content-Type'))
        self.assertEqual(payload, {'status': 'ok'})

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
        self.assertIn('keywords_by_column', payload)
        self.assertIsInstance(payload['keywords_by_column'], dict)
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
        self.assertIn('keywords_by_column', payload)
        self.assertIn('Material', payload['keywords_by_column'])
        self.assertGreater(len(payload['keywords_by_column']['Material']), 0)
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
