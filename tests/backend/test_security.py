"""Regression tests for the public-server hardening (backend/security.py and its call sites)."""
from __future__ import annotations

import io
import json
import os
import socket
import tempfile
import unittest
import urllib.error
import urllib.request
import zipfile
from unittest import mock

import requests

import test_api
from backend import security
from backend.app import _safe_archive_name
from backend.import_data import teable

PUBLIC_DNS = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('93.184.216.34', 443))]


def _post(base_url: str, path: str, body: bytes, headers: dict[str, str]) -> tuple[int, dict[str, str], bytes]:
    request = urllib.request.Request(f'{base_url}{path}', data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status, {k.lower(): v for k, v in response.headers.items()}, response.read()
    except urllib.error.HTTPError as error:
        try:
            error_body = error.read()
        except ConnectionError:     # server rejected before reading the upload and closed the socket
            error_body = b''
        return error.code, {k.lower(): v for k, v in error.headers.items()}, error_body


class RemoteUrlValidationTests(unittest.TestCase):
    def test_rejects_internal_and_unsafe_urls(self) -> None:
        for url in (
            'https://127.0.0.1/api',
            'https://localhost/api',
            'https://169.254.169.254/latest/meta-data/',
            'https://10.0.0.5/api',
            'https://[::1]/api',
            'https://[::ffff:127.0.0.1]/api',
            'http://example.com/api',              # api key must not travel in clear text
            'https://user:pass@example.com/api',
            'file:///etc/passwd',
            'gopher://example.com/',
            '',
            None,
        ):
            with self.subTest(url=url), self.assertRaises(security.UnsafeRemoteURL):
                security.validate_remote_url(url)

    def test_rejects_public_name_resolving_to_private_address(self) -> None:
        private = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('192.168.1.10', 443))]
        with mock.patch.object(security.socket, 'getaddrinfo', return_value=private):
            with self.assertRaises(security.UnsafeRemoteURL):
                security.validate_remote_url('https://teable.example.com/api/table/tblX/record')

    def test_accepts_public_https_url(self) -> None:
        with mock.patch.object(security.socket, 'getaddrinfo', return_value=PUBLIC_DNS):
            url = 'https://teable.example.com/api/table/tblX/record'
            self.assertEqual(security.validate_remote_url(url), url)

    def test_allowlist_restricts_hosts(self) -> None:
        with mock.patch.object(security, 'ALLOWED_REMOTE_HOSTS', {'teable.internal'}):
            self.assertEqual(security.validate_remote_url('http://teable.internal/api'), 'http://teable.internal/api')
            with self.assertRaises(security.UnsafeRemoteURL):
                security.validate_remote_url('https://example.com/api')


class TeableHardeningTests(unittest.TestCase):
    URL = 'https://teable.example.com/api/table/tblXYZ/record'

    def setUp(self) -> None:
        patcher = mock.patch.object(security.socket, 'getaddrinfo', return_value=PUBLIC_DNS)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_internal_teable_url_is_refused_before_any_request(self) -> None:
        with mock.patch.object(security.socket, 'getaddrinfo', return_value=[(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('127.0.0.1', 443))]), \
             mock.patch('backend.import_data.teable.requests.get') as get:
            with self.assertRaises(teable.TeableError) as context:
                teable.fetch_records(self.URL, 'teable_abc')
        self.assertIn('non-public address', str(context.exception))
        get.assert_not_called()

    def test_tls_failure_does_not_retry_without_verification(self) -> None:
        with mock.patch('backend.import_data.teable.requests.get', side_effect=requests.exceptions.SSLError('bad cert')) as get:
            with self.assertRaises(teable.TeableError):
                teable.fetch_records(self.URL, 'teable_abc')
        self.assertEqual(get.call_count, 1)
        self.assertIs(get.call_args.kwargs['verify'], True)
        self.assertIs(get.call_args.kwargs['allow_redirects'], False)

    def test_error_body_of_remote_server_is_not_echoed(self) -> None:
        response = mock.MagicMock(status_code=500, ok=False, text='internal secret page')
        response.__enter__.return_value = response
        with mock.patch('backend.import_data.teable.requests.get', return_value=response):
            with self.assertRaises(teable.TeableError) as context:
                teable.fetch_records(self.URL, 'teable_abc')
        self.assertNotIn('secret', str(context.exception))

    def test_oversized_response_is_refused(self) -> None:
        response = mock.MagicMock(status_code=200, ok=True)
        response.__enter__.return_value = response
        response.iter_content.return_value = iter([b'x' * 1024] * 10)
        with mock.patch.object(security, 'MAX_REMOTE_RESPONSE_BYTES', 4096), \
             mock.patch('backend.import_data.teable.requests.get', return_value=response):
            with self.assertRaises(teable.TeableError) as context:
                teable.fetch_records(self.URL, 'teable_abc')
        self.assertIn('larger than this server allows', str(context.exception))


class UploadAndFileTests(unittest.TestCase):
    def test_zip_bomb_is_rejected(self) -> None:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('xl/worksheets/sheet1.xml', b'0' * (security.MAX_XLSX_UNCOMPRESSED_BYTES + 1))
        with self.assertRaises(ValueError):
            security.check_xlsx_bytes(buffer.getvalue())

    def test_non_workbook_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            security.check_xlsx_bytes(b'not a zip file')

    def test_real_workbook_is_accepted(self) -> None:
        security.check_xlsx_bytes(test_api.UPLOAD_FIXTURE_PATH.read_bytes())

    def test_watermarks_are_confined_to_the_watermark_directory(self) -> None:
        self.assertTrue(security.resolve_watermark_file('RPS_lightmode.png').is_file())
        for name in ('../../app.py', '../../../README.md', os.path.abspath(__file__), '../watermarks/../../security.py'):
            with self.subTest(name=name), self.assertRaises(FileNotFoundError):
                security.resolve_watermark_file(name)

    def test_archive_names_cannot_escape_the_zip_root(self) -> None:
        self.assertEqual(_safe_archive_name('../../etc/evil'), 'evil')
        self.assertEqual(_safe_archive_name('..\\..\\evil'), 'evil')
        self.assertEqual(_safe_archive_name('..'), '')
        self.assertEqual(_safe_archive_name('C:/Windows/x'), 'x')
        self.assertEqual(_safe_archive_name('Plot 1 (Dichte).v2'), 'Plot 1 (Dichte).v2')

    def test_server_paths_are_redacted(self) -> None:
        text = security.redact_paths(f'File "{security.BACKEND_DIR / "app.py"}", line 1')
        self.assertNotIn(str(security.BACKEND_DIR.parent), text)


class BodyLimitMiddlewareTests(unittest.TestCase):
    def test_chunked_body_without_content_length_is_cut_off(self) -> None:
        import asyncio
        from backend.app import SecurityMiddleware

        async def reads_whole_body(scope, receive, send):
            while (await receive()).get('more_body'):
                pass
            await send({'type': 'http.response.start', 'status': 200, 'headers': []})
            await send({'type': 'http.response.body', 'body': b'ok'})

        chunks = iter([{'type': 'http.request', 'body': b'x' * 600, 'more_body': True}] * 10)
        sent: list[dict] = []

        async def receive():
            return next(chunks)

        async def send(message):
            sent.append(message)

        middleware = SecurityMiddleware(reads_whole_body, max_upload_bytes=10_000, max_json_bytes=1000, page_csp="default-src 'self'")
        scope = {'type': 'http', 'method': 'POST', 'path': '/api/render-plot', 'headers': [(b'content-type', b'application/json')]}
        asyncio.run(middleware(scope, receive, send))
        self.assertEqual(sent[0]['status'], 413)


class RenderQueueTests(unittest.TestCase):
    def test_render_is_refused_when_the_queue_is_full(self) -> None:
        from backend import plot_renderer
        with mock.patch.object(plot_renderer, '_pending_renders', plot_renderer.MAX_QUEUED_RENDERS), \
             mock.patch.object(plot_renderer, '_render_plot_image') as render:
            with self.assertRaises(plot_renderer.RenderQueueFull):
                plot_renderer.render_plot_image({'dataframes': []})
        render.assert_not_called()


class ConfigSanitizingTests(unittest.TestCase):
    def test_dangerous_matplotlib_kwargs_are_dropped(self) -> None:
        frame = {
            'guidelines': [{'line_props': {'color': 'red', 'linewidth': 2, 'url': 'javascript:alert(1)', 'gid': 'x'}}],
            'annotations': [{}, {'arrow': {'facecolor': 'blue', 'url': 'javascript:alert(1)'}}],
        }
        _, frame = security.sanitize_render_config({}, frame)
        self.assertEqual(frame['guidelines'][0]['line_props'], {'color': 'red', 'linewidth': 2})
        self.assertEqual(frame['annotations'][1]['arrow'], {'facecolor': 'blue'})

    def test_image_size_is_bounded(self) -> None:
        dataframe, _ = security.sanitize_render_config({'resolution': 1e9, 'image_ratio': [1e6, 1]}, {})
        self.assertLessEqual(dataframe['image_ratio'], security.MAX_RATIO)
        pixels = (10 * dataframe['image_ratio'] * dataframe['resolution']) * (10 * dataframe['resolution'])
        self.assertLessEqual(pixels, security.MAX_PIXELS * 1.001)

    def test_sizes_and_non_finite_numbers_are_clamped(self) -> None:
        dataframe, _ = security.sanitize_render_config({'font': {'font_size': 1e9, 'tick_size': float('inf')}}, {})
        self.assertEqual(dataframe['font']['font_size'], security.SIZE_LIMITS['font_size'])
        self.assertIsNone(dataframe['font']['tick_size'])


class SecurityApiTests(unittest.TestCase):
    start_test_server = classmethod(test_api.BackendApiTests.__dict__['start_test_server'].__func__)
    read_server_output = classmethod(test_api.BackendApiTests.__dict__['read_server_output'].__func__)
    tearDownClass = classmethod(test_api.BackendApiTests.__dict__['tearDownClass'].__func__)

    @classmethod
    def setUpClass(cls) -> None:
        cls.server_process = None
        cls.server_output = None
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.base_url = cls.start_test_server(cls.temp_dir.name)
        cls.render_payload = json.loads(test_api.FIXTURE_PATH.read_text(encoding='utf-8'))
        cls.render_payload['config']['dataframes'][0]['import_file_name'] = 'client-only.xlsx'

    def _multipart(self, payload: dict) -> tuple[bytes, str]:
        return test_api.build_multipart_body(
            {
                'payload': json.dumps(payload),
                'data_sources': json.dumps([{'dataframe_index': 0, 'kind': 'xlsx', 'file_field': 'datasource_0', 'filename': 'client-only.xlsx'}]),
            },
            {'datasource_0': test_api.UPLOAD_FIXTURE_PATH},
        )

    def render_multipart(self, payload: dict, headers: dict[str, str] | None = None) -> tuple[int, dict[str, str], bytes]:
        body, boundary = self._multipart(payload)
        return _post(self.base_url, '/api/render-plot', body, {'Content-Type': f'multipart/form-data; boundary={boundary}', **(headers or {})})

    def test_svg_cannot_carry_javascript_links(self) -> None:
        payload = json.loads(json.dumps(self.render_payload))
        payload['config']['dataframes'][0]['frames'][0]['guidelines'] = [
            {'x': 100, 'y': 100, 'm': 1, 'line_props': {'color': 'red', 'url': 'javascript:alert(document.domain)'}},
        ]
        status, headers, body = self.render_multipart(payload)
        self.assertEqual(status, 200, body[:500])
        self.assertIn(b'<svg', body)
        self.assertNotIn(b'javascript:', body)
        self.assertIn('sandbox', headers.get('content-security-policy', ''))
        self.assertEqual(headers.get('x-content-type-options'), 'nosniff')

    def test_watermark_file_names_from_the_config_are_never_opened(self) -> None:
        # The server only draws its own logo (with the attribution key) or none: a path in the config is ignored.
        payload = json.loads(json.dumps(self.render_payload))
        payload['config']['dataframes'][0]['watermark'] = '../../app.py'
        status, _, body = self.render_multipart(payload)
        self.assertEqual(status, 200, body[:500])

    def test_watermark_from_watermark_directory_still_works(self) -> None:
        payload = json.loads(json.dumps(self.render_payload))
        payload['config']['dataframes'][0]['watermark'] = 'RPS_lightmode.png'
        status, _, body = self.render_multipart(payload)
        self.assertEqual(status, 200, body[:500])

    def test_error_details_do_not_reveal_server_paths(self) -> None:
        payload = json.loads(json.dumps(self.render_payload))
        del payload['config']['dataframes'][0]['frames'][0]['x_quantity']
        status, _, body = self.render_multipart(payload)
        self.assertEqual(status, 400)
        self.assertNotIn(str(test_api.PROJECT_DIR).replace('\\', '\\\\'), body.decode('utf-8'))

    def test_cross_site_post_is_blocked(self) -> None:
        status, _, _ = self.render_multipart(self.render_payload, {'Sec-Fetch-Site': 'cross-site'})
        self.assertEqual(status, 403)

    def test_text_plain_body_is_rejected(self) -> None:
        status, _, _ = _post(self.base_url, '/api/render-plot', json.dumps(self.render_payload).encode(), {'Content-Type': 'text/plain'})
        self.assertEqual(status, 400)

    def test_oversized_body_is_rejected(self) -> None:
        headers = {'Content-Type': 'multipart/form-data; boundary=x', 'Content-Length': str(security.MAX_REQUEST_BYTES + 1)}
        status, _, _ = _post(self.base_url, '/api/render-plot', b'{}', headers)
        self.assertEqual(status, 413)

    def test_json_bodies_have_a_smaller_limit(self) -> None:
        headers = {'Content-Type': 'application/json', 'Content-Length': str(security.MAX_JSON_BYTES + 1)}
        status, _, _ = _post(self.base_url, '/api/render-plot', b'{}', headers)
        self.assertEqual(status, 413)

    def test_data_derived_legend_entries_are_not_parsed_as_math(self) -> None:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        from backend.plotting.formatting import format_storage, legend
        entries = legend('Family')
        entries.append_category(r'$\sqrt{x}$', '#ff0000')
        try:
            entries.create_legend(format_storage(None), 'black', 10, 12)
            self.assertFalse(entries.legend.get_texts()[0].get_parse_math())
        finally:
            plt.close('all')

    def test_teable_ssrf_is_rejected(self) -> None:
        for url in ('https://127.0.0.1:8000/api/table/tblX/record', 'https://169.254.169.254/api/table/tblX/record'):
            with self.subTest(url=url):
                status, _, body = _post(
                    self.base_url,
                    '/api/import-database',
                    json.dumps({'teable_url': url, 'API_Key': 'Bearer x'}).encode(),
                    {'Content-Type': 'application/json'},
                )
                self.assertEqual(status, 400)
                self.assertIn('non-public address', json.loads(body)['message'])

    def test_download_zip_entries_stay_inside_archive(self) -> None:
        payload = json.loads(json.dumps(self.render_payload))
        payload['config']['dataframes'][0]['name'] = '../../evil'
        payload['config']['dataframes'][0]['frames'][0]['name'] = '..\\x'
        body, boundary = self._multipart({'config': payload['config'], 'plots': [{'dataframe_index': 0, 'frame_index': 0}] * 2})
        status, _, content = _post(self.base_url, '/api/download-plots', body, {'Content-Type': f'multipart/form-data; boundary={boundary}'})
        self.assertEqual(status, 200, content[:500])
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            self.assertEqual(archive.namelist(), ['evil_x.svg', 'evil_x-2.svg'])

    def test_download_with_invalid_index_is_a_client_error(self) -> None:
        body, boundary = self._multipart({'config': self.render_payload['config'], 'plots': [{'dataframe_index': 5, 'frame_index': -3}]})
        status, _, content = _post(self.base_url, '/api/download-plots', body, {'Content-Type': f'multipart/form-data; boundary={boundary}'})
        self.assertIn(status, (200, 400), content[:300])

    def test_api_docs_are_disabled(self) -> None:
        for path in ('/docs', '/openapi.json'):
            with self.subTest(path=path):
                try:
                    with urllib.request.urlopen(f'{self.base_url}{path}', timeout=30) as response:
                        status = response.status
                except urllib.error.HTTPError as error:
                    status = error.code
                self.assertEqual(status, 404)

    def test_render_status_rejects_malformed_ids(self) -> None:
        with self.assertRaises(urllib.error.HTTPError) as context:
            urllib.request.urlopen(f'{self.base_url}/api/render-status/{"x" * 500}', timeout=30)
        self.assertEqual(context.exception.code, 404)


if __name__ == '__main__':
    unittest.main()
