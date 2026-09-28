from __future__ import annotations

import json
import os
import base64
import io
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
from pydantic import BaseModel
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
    from backend.plot_renderer import PlotRenderError, RequestDataSource, describe_exception, get_render_status, render_plot_image
else:
    from . import import_data as import_data_module
    from .import_data import teable as teable_api
    from .plot_renderer import PlotRenderError, RequestDataSource, describe_exception, get_render_status, render_plot_image

app = FastAPI(title='Ashby Backend API')


class RenderPlotRequest(BaseModel):
    config: dict[str, Any]
    dataframe_index: int = 0
    frame_index: int = 0
    # When true, a successful render is returned as JSON with the base64 image and the plot log.
    include_log: bool = False
    # Optional id chosen by the client to poll /api/render-status/{request_id} while it renders.
    request_id: str | None = None


class DownloadPlotItem(BaseModel):
    dataframe_index: int
    frame_index: int


class DownloadPlotsRequest(BaseModel):
    config: dict[str, Any]
    plots: list[DownloadPlotItem]


def _extract_metadata_from_xlsx(file_bytes: bytes, sheet_index: int) -> tuple[list[str], dict[str, list[str]], list[str], list[dict]]:
    '''Columns, text values per column, sheet names and format warnings (see check_excel_format) of an uploaded workbook.'''
    # Only the selected sheet is parsed; the other sheets are just listed by name.
    workbook = pd.ExcelFile(io.BytesIO(file_bytes), engine=import_data_module.EXCEL_ENGINE)
    sheet_names = [str(name) for name in workbook.sheet_names]
    if not sheet_names:
        return [], {}, [], [{'code': 'empty_sheet'}]

    index = min(max(sheet_index, 0), len(sheet_names) - 1)
    selected = workbook.parse(workbook.sheet_names[index])

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

    return columns, keywords_by_column, sheet_names, import_data_module.check_excel_format(selected)


def _excel_import_response(metadata: tuple[list[str], dict[str, list[str]], list[str], list[dict]], import_file_name: str) -> JSONResponse:
    columns, keywords_by_column, sheet_names, format_warnings = metadata
    return JSONResponse({
        'success': True,
        'columns': columns,
        'keywords_by_column': keywords_by_column,
        'import_file_name': import_file_name,
        'sheet_names': sheet_names,
        'format_warnings': format_warnings,
    })


TEABLE_KEYWORD_RECORD_LIMIT = 5000


def _extract_columns_and_keywords_from_teable(
    teable_url: str,
    api_key: str,
    verify_tls: bool = True,
) -> tuple[list[str], dict[str, list[str]]]:
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
    return columns, normalized_keywords


def _teable_import_response(teable_url: str, api_key: str, verify_tls: bool = True) -> JSONResponse:
    try:
        columns, keywords_by_column = _extract_columns_and_keywords_from_teable(teable_url, api_key, verify_tls=verify_tls)
    except teable_api.TeableError as error:
        return JSONResponse({'success': False, 'message': str(error)}, status_code=400)
    except requests.RequestException as error:
        return JSONResponse({'success': False, 'message': f'Teable request failed: {error}'}, status_code=502)
    return JSONResponse({'success': True, 'columns': columns, 'keywords_by_column': keywords_by_column})


def _encode_messages_header(messages: list[str]) -> str:
    return quote(json.dumps(messages, ensure_ascii=False), safe='')


async def _parse_plot_request(request: Request) -> tuple[dict[str, Any], dict[int, RequestDataSource]]:
    if request.headers.get('content-type', '').startswith('multipart/form-data'):
        form = await request.form()
        raw_payload = form.get('payload')
        if not isinstance(raw_payload, str):
            raise ValueError('Missing multipart payload.')

        payload = json.loads(raw_payload)
        raw_sources = form.get('data_sources')
        source_descriptors = json.loads(raw_sources) if isinstance(raw_sources, str) and raw_sources.strip() else []
        if not isinstance(source_descriptors, list):
            raise ValueError('data_sources must be a JSON array.')

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
                raise ValueError(f"Missing datasource file field '{file_field}'.")

            descriptor_filename = descriptor.get('filename')
            data_sources[dataframe_index] = RequestDataSource(
                kind='xlsx',
                content=await upload.read(),
                filename=upload.filename or (descriptor_filename if isinstance(descriptor_filename, str) else None),
            )

        return payload, data_sources

    return await request.json(), {}


@app.get('/api/import-database/datasets')
def import_database_datasets() -> JSONResponse:
    return JSONResponse({'success': True, 'datasets': import_data_module.list_available_import_files()})


@app.get('/api/health')
def health() -> JSONResponse:
    return JSONResponse({'status': 'ok'})


@app.get('/api/render-status/{request_id}')
def render_status(request_id: str) -> JSONResponse:
    status = get_render_status(request_id)
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
        )
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
    except Exception as exc:
        return JSONResponse({**describe_exception(exc), 'messages': []}, status_code=400)

    output = io.BytesIO()
    with zipfile.ZipFile(output, mode='w', compression=zipfile.ZIP_DEFLATED) as archive:
        for plot in payload.plots:
            try:
                rendered_plot = await run_in_threadpool(
                    render_plot_image,
                    payload.config,
                    dataframe_index=plot.dataframe_index,
                    frame_index=plot.frame_index,
                    data_sources=data_sources,
                )
            except PlotRenderError as exc:
                label = f'dataframe {plot.dataframe_index + 1}, frame {plot.frame_index + 1}'
                return JSONResponse({**exc.details, 'message': f'{label}: {exc}', 'messages': exc.messages}, status_code=400)
            dataframe = payload.config.get('dataframes', [])[plot.dataframe_index]
            frame = dataframe.get('frames', [])[plot.frame_index] if isinstance(dataframe, dict) else {}
            dataframe_name = (dataframe.get('name') if isinstance(dataframe, dict) else None) or f'Dataframe{plot.dataframe_index + 1}'
            frame_name = (frame.get('name') if isinstance(frame, dict) else None) or f'Frame{plot.frame_index + 1}'
            extension = '.png' if rendered_plot.media_type == 'image/png' else '.svg'
            filename_root = f'{dataframe_name}_{frame_name}'
            archive.writestr(f'{filename_root}{extension}', rendered_plot.content)

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
        teable_url_json = payload.get('teable_url')
        api_key_json = payload.get('API_Key')
        import_file_name_json = payload.get('import_file_name')
        import_sheet_json = payload.get('import_sheet', import_sheet)
        verify_tls_json = payload.get('verify_tls', True)
        if not teable_url_json or not api_key_json:
            if not isinstance(import_file_name_json, str) or not import_file_name_json.strip():
                return JSONResponse({'success': False, 'message': 'Missing teable_url, API_Key, or import_file_name.'}, status_code=400)
            try:
                metadata = import_data_module.import_excel_metadata(import_file_name_json, int(import_sheet_json))
            except Exception as error:
                return JSONResponse({'success': False, 'message': f'Excel import failed: {type(error).__name__}: {error}'}, status_code=400)
            return _excel_import_response(metadata, import_file_name_json)
        return await run_in_threadpool(_teable_import_response, teable_url_json, api_key_json, verify_tls=verify_tls_json is not False)

    if file is None:
        if import_file_name:
            try:
                metadata = import_data_module.import_excel_metadata(import_file_name, import_sheet)
            except Exception as error:
                return JSONResponse({'success': False, 'message': f'Excel import failed: {type(error).__name__}: {error}'}, status_code=400)
            return _excel_import_response(metadata, import_file_name)
        if not teable_url or not API_Key:
            return JSONResponse({'success': False, 'message': 'Missing teable_url or API_Key.'}, status_code=400)
        return await run_in_threadpool(_teable_import_response, teable_url, API_Key)

    file_bytes = await file.read()
    try:
        metadata = _extract_metadata_from_xlsx(file_bytes, import_sheet)
    except Exception as error:
        return JSONResponse({'success': False, 'message': f'Excel import failed: {type(error).__name__}: {error}'}, status_code=400)

    return _excel_import_response(metadata, file.filename or 'uploaded.xlsx')


if FRONTEND_ASSETS_DIR.is_dir() and FRONTEND_INDEX_PATH.is_file():
    app.mount('/assets', StaticFiles(directory=FRONTEND_ASSETS_DIR), name='assets')

    @app.get('/{full_path:path}')
    async def frontend_fallback(full_path: str, request: Request):
        return FileResponse(FRONTEND_INDEX_PATH)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
