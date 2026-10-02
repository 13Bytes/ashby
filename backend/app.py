from __future__ import annotations

import asyncio
import json
import os
import base64
import hashlib
import io
import re
import sys
import zipfile
from urllib.parse import quote
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse, Response, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile as StarletteUploadFile
import uvicorn

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
FRONTEND_DIR = Path(THIS_DIR) / 'production-frontend'
FRONTEND_ASSETS_DIR = FRONTEND_DIR / 'assets'
FRONTEND_INDEX_PATH = FRONTEND_DIR / 'index.html'

if __package__ in (None, ''):
    sys.path.insert(0, str(PROJECT_DIR))
    from backend import import_data as import_data_module
    from backend.import_data import teable as teable_api
    from backend.plot_renderer import PlotRenderError, RenderQueueFull, RequestDataSource, describe_exception, get_render_status, render_plot_image
    from backend.security import ATTRIBUTION_KEY_HEADER, MAX_JSON_BYTES, MAX_PLOTS_PER_DOWNLOAD, MAX_REQUEST_BYTES, MAX_UPLOAD_FILES, attribution_key_valid, check_row_count, check_xlsx_bytes, redact_paths
else:
    from . import import_data as import_data_module
    from .import_data import teable as teable_api
    from .plot_renderer import PlotRenderError, RenderQueueFull, RequestDataSource, describe_exception, get_render_status, render_plot_image
    from .security import ATTRIBUTION_KEY_HEADER, MAX_JSON_BYTES, MAX_PLOTS_PER_DOWNLOAD, MAX_REQUEST_BYTES, MAX_UPLOAD_FILES, attribution_key_valid, check_row_count, check_xlsx_bytes, redact_paths

ENABLE_API_DOCS = os.environ.get('ASHBY_ENABLE_API_DOCS', '').lower() in ('1', 'true', 'yes')

app = FastAPI(
    title='PolyPlot API',
    docs_url='/docs' if ENABLE_API_DOCS else None,
    redoc_url='/redoc' if ENABLE_API_DOCS else None,
    openapi_url='/openapi.json' if ENABLE_API_DOCS else None,
)


# : security middleware :
SAFE_METHODS = {'GET', 'HEAD', 'OPTIONS'}
COMMON_SECURITY_HEADERS = [
    (b'x-content-type-options', b'nosniff'),
    (b'x-frame-options', b'DENY'),
    (b'referrer-policy', b'no-referrer'),
    (b'cross-origin-opener-policy', b'same-origin'),
    (b'cross-origin-resource-policy', b'same-origin'),
    (b'permissions-policy', b'camera=(), microphone=(), geolocation=(), payment=(), usb=()'),
    (b'strict-transport-security', b'max-age=31536000'),
]
# API responses (JSON, SVG, ZIP) are never meant to be rendered as a document on this origin
API_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'none'; sandbox"


def _page_csp() -> str:
    '''CSP for the single page app; inline scripts of the built index.html are allowed by hash'''
    script_hashes: list[str] = []
    if FRONTEND_INDEX_PATH.is_file():
        html = FRONTEND_INDEX_PATH.read_text(encoding='utf-8')
        for match in re.finditer(r'<script\b(?![^>]*\bsrc=)[^>]*>(.*?)</script>', html, re.S | re.I):
            digest = hashlib.sha256(match.group(1).encode('utf-8')).digest()
            script_hashes.append(f"'sha256-{base64.b64encode(digest).decode('ascii')}'")
    return '; '.join([
        "default-src 'self'",
        ' '.join(["script-src 'self'", *script_hashes]),
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' blob: data:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ])


class RequestTooLarge(Exception):
    def __init__(self) -> None:
        super().__init__('Request body is larger than this server allows.')


async def _send_json_error(send, status: int, message: str) -> None:
    body = json.dumps({'success': False, 'message': message, 'messages': []}).encode('utf-8')
    await send({
        'type': 'http.response.start',
        'status': status,
        'headers': [(b'content-type', b'application/json'), (b'content-length', str(len(body)).encode('ascii'))],
    })
    await send({'type': 'http.response.body', 'body': body})


class SecurityMiddleware:
    '''adds security headers, blocks cross-site writes and caps the request body size'''

    def __init__(self, app, max_upload_bytes: int, max_json_bytes: int, page_csp: str) -> None:
        self.app = app
        self.max_upload_bytes = max_upload_bytes
        self.max_json_bytes = max_json_bytes
        self.page_csp = page_csp.encode('ascii')

    async def __call__(self, scope, receive, send) -> None:
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return

        request_headers = {key.lower(): value for key, value in scope['headers']}
        is_upload = request_headers.get(b'content-type', b'').startswith(b'multipart/form-data')
        max_body_bytes = self.max_upload_bytes if is_upload else self.max_json_bytes
        path = scope.get('path', '')
        csp = API_CSP.encode('ascii') if path == '/api' or path.startswith('/api/') else self.page_csp
        extra_headers = [*COMMON_SECURITY_HEADERS, (b'content-security-policy', csp)]
        response_started = False

        async def send_with_headers(message) -> None:
            nonlocal response_started
            if message['type'] == 'http.response.start':
                response_started = True
                existing = {key.lower() for key, _ in message.get('headers', [])}
                message = {**message, 'headers': [*message.get('headers', []), *[header for header in extra_headers if header[0] not in existing]]}
            await send(message)

        # forms / fetches from other websites must not be able to use this API (CSRF, SVG opened as a document)
        if scope['method'] not in SAFE_METHODS and request_headers.get(b'sec-fetch-site') in (b'cross-site', b'same-site'):
            await _send_json_error(send_with_headers, 403, 'Cross-site requests are not allowed.')
            return

        content_length = request_headers.get(b'content-length')
        if content_length is not None:
            try:
                declared_length = int(content_length)
            except ValueError:
                await _send_json_error(send_with_headers, 400, 'Invalid Content-Length header.')
                return
            if declared_length > max_body_bytes:
                await _send_json_error(send_with_headers, 413, str(RequestTooLarge()))
                return

        received = 0

        async def limited_receive():
            nonlocal received
            message = await receive()
            if message['type'] == 'http.request':
                received += len(message.get('body', b''))
                if received > max_body_bytes:
                    raise RequestTooLarge()
            return message

        try:
            await self.app(scope, limited_receive, send_with_headers)
        except RequestTooLarge:
            if not response_started:
                await _send_json_error(send_with_headers, 413, str(RequestTooLarge()))


app.add_middleware(SecurityMiddleware, max_upload_bytes=MAX_REQUEST_BYTES, max_json_bytes=MAX_JSON_BYTES, page_csp=_page_csp())


REQUEST_ID_PATTERN = r'^[A-Za-z0-9-]{8,64}$'


class RenderPlotRequest(BaseModel):
    config: dict[str, Any]
    dataframe_index: int = 0
    frame_index: int = 0
    # When true, a successful render is returned as JSON with the base64 image and the plot log.
    include_log: bool = False
    # Optional id chosen by the client to poll /api/render-status/{request_id} while it renders.
    request_id: str | None = Field(default=None, pattern=REQUEST_ID_PATTERN)


class DownloadPlotItem(BaseModel):
    dataframe_index: int
    frame_index: int


class DownloadPlotsRequest(BaseModel):
    config: dict[str, Any]
    plots: list[DownloadPlotItem]


ExcelMetadata = tuple[list[str], dict[str, list[str]], list[str], list[dict], dict[str, int], dict]


def _extract_metadata_from_xlsx(file_bytes: bytes, sheet_index: int) -> ExcelMetadata:
    '''Columns, text values per column, sheet names, format warnings (see check_excel_format), rows
    with a value per quantity (count_quantity_values) and the preview table (preview_table) of an uploaded workbook.'''
    # Only the selected sheet is parsed; the other sheets are just listed by name.
    check_xlsx_bytes(file_bytes)
    workbook = pd.ExcelFile(io.BytesIO(file_bytes), engine=import_data_module.EXCEL_ENGINE)
    sheet_names = [str(name) for name in workbook.sheet_names]
    if not sheet_names:
        return [], {}, [], [{'code': 'empty_sheet'}], {}, import_data_module.preview_table(pd.DataFrame())

    index = min(max(sheet_index, 0), len(sheet_names) - 1)
    selected = workbook.parse(workbook.sheet_names[index])
    check_row_count(len(selected))

    columns = [str(column).strip() for column in selected.columns if str(column).strip()]

    keywords_by_column: dict[str, list[str]] = {}
    for raw_column in selected.columns:
        column = str(raw_column).strip()
        if not column:
            continue
        series = selected[raw_column].dropna()
        keywords = sorted({
            str(entry).strip()
            for entry in series
            if isinstance(entry, str) and str(entry).strip()
        }, key=lambda entry: entry.lower())
        keywords_by_column[column] = keywords

    return columns, keywords_by_column, sheet_names, import_data_module.check_excel_format(selected), import_data_module.count_quantity_values(selected), import_data_module.preview_table(selected)


def _excel_import_response(metadata: ExcelMetadata, import_file_name: str, unlocked: bool) -> JSONResponse:
    '''`unlocked` (a valid attribution key): with the data preview.'''
    columns, keywords_by_column, sheet_names, format_warnings, value_counts, preview = metadata
    return JSONResponse({
        'success': True,
        'columns': columns,
        'keywords_by_column': keywords_by_column,
        'import_file_name': import_file_name,
        'sheet_names': sheet_names,
        'format_warnings': format_warnings,
        'value_counts': value_counts,
        **({'preview': preview} if unlocked else {}),
    })


TEABLE_KEYWORD_RECORD_LIMIT = 5000


def _extract_columns_and_keywords_from_teable(
    teable_url: str,
    api_key: str,
    verify_tls: bool = True,
) -> tuple[list[str], dict[str, list[str]], dict[str, int], dict]:
    # Columns come from the table's field list: records omit empty cells, so reading them from
    # records would miss columns that happen to be empty in the fetched rows.
    columns = teable_api.fetch_field_names(teable_url, api_key, verify_tls=verify_tls)
    records = teable_api.fetch_records(teable_url, api_key, verify_tls=verify_tls, max_records=TEABLE_KEYWORD_RECORD_LIMIT)

    # Keywords like in the Excel import: the distinct text values of each column.
    keywords_by_column: dict[str, set[str]] = {column: set() for column in columns}
    for fields in records:
        if not isinstance(fields, dict):
            continue
        for key, value in fields.items():
            column = str(key).strip()
            if column in keywords_by_column and isinstance(value, str) and value.strip():
                keywords_by_column[column].add(value.strip())

    normalized_keywords = {
        column: sorted(values, key=lambda entry: entry.lower())
        for column, values in keywords_by_column.items()
    }
    # of the fetched records (at most TEABLE_KEYWORD_RECORD_LIMIT)
    fetched = pd.DataFrame([fields for fields in records if isinstance(fields, dict)])
    value_counts = import_data_module.count_quantity_values(fetched)
    # the table's field order; fields the field list lacks come last
    preview = import_data_module.preview_table(fetched.reindex(columns=[*columns, *(column for column in fetched.columns if column not in columns)]))
    return columns, normalized_keywords, value_counts, preview


def _teable_import_response(teable_url: str, api_key: str, unlocked: bool, verify_tls: bool = True) -> JSONResponse:
    '''`unlocked` (a valid attribution key): with the data preview of the fetched records.'''
    try:
        columns, keywords_by_column, value_counts, preview = _extract_columns_and_keywords_from_teable(teable_url, api_key, verify_tls=verify_tls)
    except teable_api.TeableError as error:
        return JSONResponse({'success': False, 'message': str(error)}, status_code=400)
    except requests.RequestException as error:
        return JSONResponse({'success': False, 'message': f'Teable request failed: {redact_paths(str(error))[:300]}'}, status_code=502)
    return JSONResponse({
        'success': True,
        'columns': columns,
        'keywords_by_column': keywords_by_column,
        'value_counts': value_counts,
        **({'preview': preview} if unlocked else {}),
    })


def _encode_messages_header(messages: list[str]) -> str:
    return quote(json.dumps([redact_paths(message)[:300] for message in messages[:20]], ensure_ascii=False), safe='')


def _busy_response(exc: Exception) -> JSONResponse:
    return JSONResponse({'message': str(exc), 'messages': []}, status_code=503, headers={'Retry-After': '5'})


def _safe_archive_name(name: Any) -> str:
    '''reduces a client supplied name to a plain file name part (no directories, no "..")'''
    if not isinstance(name, str):
        return ''
    name = name.replace('\\', '/').split('/')[-1]
    name = re.sub(r'[^\w.\- ()]+', '_', name).strip(' .')
    return name[:80]


def _config_entry(entries: Any, index: int) -> dict[str, Any]:
    '''entries[index] if it is a dict, else {} (no IndexError / negative indexing from client input)'''
    if isinstance(entries, list) and 0 <= index < len(entries) and isinstance(entries[index], dict):
        return entries[index]
    return {}


async def _parse_plot_request(request: Request) -> tuple[dict[str, Any], dict[int, RequestDataSource]]:
    content_type = request.headers.get('content-type', '')
    if content_type.startswith('multipart/form-data'):
        form = await request.form(max_files=MAX_UPLOAD_FILES, max_fields=MAX_UPLOAD_FILES + 10)
        raw_payload = form.get('payload')
        if not isinstance(raw_payload, str):
            raise ValueError('Missing multipart payload.')

        payload = json.loads(raw_payload)
        raw_sources = form.get('data_sources')
        source_descriptors = json.loads(raw_sources) if isinstance(raw_sources, str) and raw_sources.strip() else []
        if not isinstance(source_descriptors, list):
            raise ValueError('data_sources must be a JSON array.')
        if len(source_descriptors) > MAX_UPLOAD_FILES:
            raise ValueError('Too many datasource files.')

        data_sources: dict[int, RequestDataSource] = {}
        for descriptor in source_descriptors:
            if not isinstance(descriptor, dict) or descriptor.get('kind') != 'xlsx':
                continue
            dataframe_index = descriptor.get('dataframe_index')
            file_field = descriptor.get('file_field')
            if not isinstance(dataframe_index, int) or not isinstance(file_field, str):
                raise ValueError('Invalid xlsx datasource descriptor.')

            upload = form.get(file_field)
            if not isinstance(upload, StarletteUploadFile):
                raise ValueError(f"Missing datasource file field '{file_field[:100]}'.")

            content = await upload.read()
            check_xlsx_bytes(content)
            descriptor_filename = descriptor.get('filename')
            data_sources[dataframe_index] = RequestDataSource(
                kind='xlsx',
                content=content,
                filename=upload.filename or (descriptor_filename if isinstance(descriptor_filename, str) else None),
            )

        return payload, data_sources

    # text/plain etc. would let a plain HTML form on another site post a JSON body
    if content_type.startswith('application/json'):
        return await request.json(), {}
    raise ValueError('Content-Type must be application/json or multipart/form-data.')


def _attribution_unlocked(request: Request) -> bool:
    return attribution_key_valid(request.headers.get(ATTRIBUTION_KEY_HEADER))


@app.get('/api/import-database/datasets')
def import_database_datasets(request: Request) -> JSONResponse:
    '''provided datasets; the key-only ones (import_data.KEY_ONLY_PREFIX) only with the attribution key'''
    return JSONResponse({'success': True, 'datasets': import_data_module.list_available_import_files(_attribution_unlocked(request))})


@app.get('/api/health')
def health() -> JSONResponse:
    return JSONResponse({'status': 'ok'})


@app.post('/api/attribution-key')
async def check_attribution_key(request: Request) -> JSONResponse:
    '''tells the editor whether the key in the header unlocks the copyright and watermark switches'''
    valid = _attribution_unlocked(request)
    if not valid:
        await asyncio.sleep(1)      # slows down guessing
    return JSONResponse({'valid': valid})


@app.get('/api/render-status/{request_id}')
def render_status(request_id: str) -> JSONResponse:
    status = get_render_status(request_id) if re.fullmatch(REQUEST_ID_PATTERN, request_id) else None
    if status is None:
        return JSONResponse({'state': 'unknown'}, status_code=404)
    return JSONResponse(status)


@app.post('/api/render-plot')
async def render_plot(request: Request) -> Response:
    try:
        payload_data, data_sources = await _parse_plot_request(request)
        payload = RenderPlotRequest(**payload_data)
        # In a worker thread, so the server keeps answering (status, health) while a plot renders.
        rendered_plot = await run_in_threadpool(
            render_plot_image,
            payload.config,
            dataframe_index=payload.dataframe_index,
            frame_index=payload.frame_index,
            data_sources=data_sources,
            request_id=payload.request_id,
            attribution_unlocked=_attribution_unlocked(request),
        )
    except RenderQueueFull as exc:
        return _busy_response(exc)
    except PlotRenderError as exc:
        return JSONResponse({**exc.details, 'message': str(exc), 'messages': exc.messages}, status_code=400)
    except Exception as exc:
        return JSONResponse({**describe_exception(exc), 'messages': []}, status_code=400)

    if payload.include_log:
        return JSONResponse({
            'image': base64.b64encode(rendered_plot.content).decode('ascii'),
            'media_type': rendered_plot.media_type,
            'messages': rendered_plot.messages,
            'log': rendered_plot.log,
            'points': rendered_plot.points,
        })

    response = Response(content=rendered_plot.content, media_type=rendered_plot.media_type)
    if rendered_plot.messages:
        response.headers['X-Ashby-Messages'] = _encode_messages_header(rendered_plot.messages)
    return response


@app.post('/api/download-plots')
async def download_plots(request: Request) -> Response:
    try:
        payload_data, data_sources = await _parse_plot_request(request)
        payload = DownloadPlotsRequest(**payload_data)
        if len(payload.plots) > MAX_PLOTS_PER_DOWNLOAD:
            raise ValueError(f'At most {MAX_PLOTS_PER_DOWNLOAD} plots can be downloaded at once.')
    except Exception as exc:
        return JSONResponse({**describe_exception(exc), 'messages': []}, status_code=400)

    output = io.BytesIO()
    used_names: set[str] = set()
    with zipfile.ZipFile(output, mode='w', compression=zipfile.ZIP_DEFLATED) as archive:
        for plot in payload.plots:
            try:
                rendered_plot = await run_in_threadpool(
                    render_plot_image,
                    payload.config,
                    dataframe_index=plot.dataframe_index,
                    frame_index=plot.frame_index,
                    data_sources=data_sources,
                    attribution_unlocked=_attribution_unlocked(request),
                )
            except RenderQueueFull as exc:
                return _busy_response(exc)
            except PlotRenderError as exc:
                label = f'dataframe {plot.dataframe_index + 1}, frame {plot.frame_index + 1}'
                return JSONResponse({**exc.details, 'message': f'{label}: {exc}', 'messages': exc.messages}, status_code=400)
            except Exception as exc:
                return JSONResponse({**describe_exception(exc), 'messages': []}, status_code=400)
            dataframe = _config_entry(payload.config.get('dataframes'), plot.dataframe_index)
            frame = _config_entry(dataframe.get('frames'), plot.frame_index)
            # names come from the client: no directories or ".." inside the zip (zip slip)
            dataframe_name = _safe_archive_name(dataframe.get('name')) or f'Dataframe{plot.dataframe_index + 1}'
            frame_name = _safe_archive_name(frame.get('name')) or f'Frame{plot.frame_index + 1}'
            extension = '.png' if rendered_plot.media_type == 'image/png' else '.svg'
            filename_root = f'{dataframe_name}_{frame_name}'
            filename, counter = f'{filename_root}{extension}', 2
            while filename in used_names:
                filename, counter = f'{filename_root}-{counter}{extension}', counter + 1
            used_names.add(filename)
            archive.writestr(filename, rendered_plot.content)

    return Response(content=output.getvalue(), media_type='application/zip')


@app.post('/api/import-database')
async def import_database(
    request: Request,
    import_sheet: int = Form(0),
    file: UploadFile | None = File(None),
    import_file_name: str | None = Form(None),
    teable_url: str | None = Form(None),
    API_Key: str | None = Form(None),
) -> JSONResponse:
    if request.headers.get('content-type', '').startswith('application/json'):
        payload = await request.json()
        if not isinstance(payload, dict):
            return JSONResponse({'success': False, 'message': 'Request body must be a JSON object.'}, status_code=400)
        teable_url_json = payload.get('teable_url')
        api_key_json = payload.get('API_Key')
        import_file_name_json = payload.get('import_file_name')
        import_sheet_json = payload.get('import_sheet', import_sheet)
        verify_tls_json = payload.get('verify_tls', True)
        if not teable_url_json or not api_key_json:
            if not isinstance(import_file_name_json, str) or not import_file_name_json.strip():
                return JSONResponse({'success': False, 'message': 'Missing teable_url, API_Key, or import_file_name.'}, status_code=400)
            try:
                metadata = await run_in_threadpool(import_data_module.import_excel_metadata, import_file_name_json, int(import_sheet_json), _attribution_unlocked(request))
            except Exception as error:
                return JSONResponse({'success': False, 'message': redact_paths(f'Excel import failed: {type(error).__name__}: {error}')}, status_code=400)
            return _excel_import_response(metadata, import_file_name_json, _attribution_unlocked(request))
        return await run_in_threadpool(_teable_import_response, teable_url_json, api_key_json, _attribution_unlocked(request), verify_tls=verify_tls_json is not False)

    if file is None:
        if import_file_name:
            try:
                metadata = await run_in_threadpool(import_data_module.import_excel_metadata, import_file_name, import_sheet, _attribution_unlocked(request))
            except Exception as error:
                return JSONResponse({'success': False, 'message': redact_paths(f'Excel import failed: {type(error).__name__}: {error}')}, status_code=400)
            return _excel_import_response(metadata, import_file_name, _attribution_unlocked(request))
        if not teable_url or not API_Key:
            return JSONResponse({'success': False, 'message': 'Missing teable_url or API_Key.'}, status_code=400)
        return await run_in_threadpool(_teable_import_response, teable_url, API_Key, _attribution_unlocked(request))

    file_bytes = await file.read()
    try:
        metadata = await run_in_threadpool(_extract_metadata_from_xlsx, file_bytes, import_sheet)
    except Exception as error:
        return JSONResponse({'success': False, 'message': redact_paths(f'Excel import failed: {type(error).__name__}: {error}')}, status_code=400)

    return _excel_import_response(metadata, file.filename or 'uploaded.xlsx', _attribution_unlocked(request))


if FRONTEND_ASSETS_DIR.is_dir() and FRONTEND_INDEX_PATH.is_file():
    app.mount('/assets', StaticFiles(directory=FRONTEND_ASSETS_DIR), name='assets')

    @app.get('/{full_path:path}')
    async def frontend_fallback(full_path: str, request: Request):
        if full_path == 'api' or full_path.startswith('api/'):
            return JSONResponse({'message': 'Not found.'}, status_code=404)
        return FileResponse(FRONTEND_INDEX_PATH, headers={'Cache-Control': 'no-cache'})

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, server_header=False)
