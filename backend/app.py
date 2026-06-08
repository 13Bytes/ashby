from __future__ import annotations

import json
import os
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
    from backend.plot_renderer import PlotRenderError, RequestDataSource, render_plot_image
else:
    from .plot_renderer import PlotRenderError, RequestDataSource, render_plot_image

app = FastAPI(title='Ashby Backend API')


class RenderPlotRequest(BaseModel):
    config: dict[str, Any]
    dataframe_index: int = 0
    frame_index: int = 0


class DownloadPlotItem(BaseModel):
    dataframe_index: int
    frame_index: int


class DownloadPlotsRequest(BaseModel):
    config: dict[str, Any]
    plots: list[DownloadPlotItem]


def _extract_columns_from_xlsx(file_bytes: bytes, sheet_index: int) -> list[str]:
    dataframes = pd.read_excel(io.BytesIO(file_bytes), sheet_name=None)
    sheet_names = list(dataframes.keys())
    if not sheet_names:
        return []
    index = min(max(sheet_index, 0), len(sheet_names) - 1)
    selected = dataframes[sheet_names[index]]
    return [str(column).strip() for column in selected.columns if str(column).strip()]


def _extract_keywords_by_column_from_xlsx(file_bytes: bytes, sheet_index: int) -> dict[str, list[str]]:
    dataframes = pd.read_excel(io.BytesIO(file_bytes), sheet_name=None)
    sheet_names = list(dataframes.keys())
    if not sheet_names:
        return {}
    index = min(max(sheet_index, 0), len(sheet_names) - 1)
    selected = dataframes[sheet_names[index]]

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

    return keywords_by_column


def _extract_columns_and_keywords_from_teable(
    teable_url: str,
    api_key: str,
    verify_tls: bool = True,
) -> tuple[list[str], dict[str, list[str]]]:
    headers = {
        'Authorization': api_key,
        'Accept': 'application/json',
    }
    try:
        response = requests.get(teable_url, params={'take': 200, 'skip': 0}, headers=headers, timeout=30, verify=verify_tls)
    except requests.exceptions.SSLError:
        if verify_tls is False:
            raise
        response = requests.get(teable_url, params={'take': 200, 'skip': 0}, headers=headers, timeout=30, verify=False)
    response.raise_for_status()
    payload = response.json() if response.content else {}
    records = payload.get('records', []) if isinstance(payload, dict) else []

    columns: list[str] = []
    keywords_by_column: dict[str, list[str]] = {}
    for record in records:
        fields = record.get('fields', {}) if isinstance(record, dict) else {}
        if not isinstance(fields, dict):
            continue
        for key, value in fields.items():
            column = str(key).strip()
            if not column:
                continue
            if column not in columns:
                columns.append(column)
            if isinstance(value, (str, int, float, bool)):
                keywords_by_column.setdefault(column, set()).add(str(value))

    normalized_keywords = {
        column: sorted(list(values))[:200]
        for column, values in keywords_by_column.items()
    }
    return sorted(columns), normalized_keywords


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


@app.get('/api/health')
def health() -> JSONResponse:
    return JSONResponse({'status': 'ok'})


@app.post('/api/render-plot')
async def render_plot(request: Request) -> Response:
    try:
        payload_data, data_sources = await _parse_plot_request(request)
        payload = RenderPlotRequest(**payload_data)
        rendered_plot = render_plot_image(
            payload.config,
            dataframe_index=payload.dataframe_index,
            frame_index=payload.frame_index,
            data_sources=data_sources,
        )
    except PlotRenderError as exc:
        return JSONResponse({'message': str(exc), 'messages': exc.messages}, status_code=400)
    except Exception as exc:
        return JSONResponse({'message': str(exc), 'messages': []}, status_code=400)

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
        return JSONResponse({'message': str(exc), 'messages': []}, status_code=400)

    output = io.BytesIO()
    with zipfile.ZipFile(output, mode='w', compression=zipfile.ZIP_DEFLATED) as archive:
        for plot in payload.plots:
            rendered_plot = render_plot_image(
                payload.config,
                dataframe_index=plot.dataframe_index,
                frame_index=plot.frame_index,
                data_sources=data_sources,
            )
            dataframe = payload.config.get('dataframes', [])[plot.dataframe_index]
            frame = dataframe.get('frames', [])[plot.frame_index] if isinstance(dataframe, dict) else {}
            export_name = frame.get('export_file_name') if isinstance(frame, dict) else None
            extension = '.png' if rendered_plot.media_type == 'image/png' else '.svg'
            filename_root = export_name or f'ashby-df{plot.dataframe_index + 1}-frame{plot.frame_index + 1}'
            archive.writestr(f'{filename_root}{extension}', rendered_plot.content)

    return Response(content=output.getvalue(), media_type='application/zip')


@app.post('/api/import-database')
async def import_database(
    request: Request,
    import_sheet: int = Form(0),
    file: UploadFile | None = File(None),
    teable_url: str | None = Form(None),
    API_Key: str | None = Form(None),
) -> JSONResponse:
    if request.headers.get('content-type', '').startswith('application/json'):
        payload = await request.json()
        teable_url_json = payload.get('teable_url')
        api_key_json = payload.get('API_Key')
        verify_tls_json = payload.get('verify_tls', True)
        if not teable_url_json or not api_key_json:
            return JSONResponse({'success': False, 'message': 'Missing teable_url or API_Key.'}, status_code=400)
        try:
            columns, keywords_by_column = _extract_columns_and_keywords_from_teable(teable_url_json, api_key_json, verify_tls=verify_tls_json)
        except requests.RequestException as error:
            return JSONResponse({'success': False, 'message': f'Teable request failed: {error}'}, status_code=502)
        return JSONResponse({'success': True, 'columns': columns, 'keywords_by_column': keywords_by_column})

    if file is None:
        if not teable_url or not API_Key:
            return JSONResponse({'success': False, 'message': 'Missing teable_url or API_Key.'}, status_code=400)
        try:
            columns, keywords_by_column = _extract_columns_and_keywords_from_teable(teable_url, API_Key, verify_tls=True)
        except requests.RequestException as error:
            return JSONResponse({'success': False, 'message': f'Teable request failed: {error}'}, status_code=502)
        return JSONResponse({'success': True, 'columns': columns, 'keywords_by_column': keywords_by_column})

    file_bytes = await file.read()
    try:
        columns = _extract_columns_from_xlsx(file_bytes, import_sheet)
        keywords_by_column = _extract_keywords_by_column_from_xlsx(file_bytes, import_sheet)
    except Exception as error:
        return JSONResponse({'success': False, 'message': f'Excel import failed: {error}'}, status_code=400)

    return JSONResponse({
        'success': True,
        'columns': columns,
        'keywords_by_column': keywords_by_column,
        'import_file_name': file.filename or 'uploaded.xlsx',
    })


if FRONTEND_ASSETS_DIR.is_dir() and FRONTEND_INDEX_PATH.is_file():
    app.mount('/assets', StaticFiles(directory=FRONTEND_ASSETS_DIR), name='assets')

    @app.get('/{full_path:path}')
    async def frontend_fallback(full_path: str, request: Request):
        return FileResponse(FRONTEND_INDEX_PATH)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
