from __future__ import annotations

import json
import io
import re
import zipfile
from urllib.parse import quote
from pathlib import Path
from typing import Any
from uuid import uuid4

import pandas as pd
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from .plot_renderer import PlotRenderError, render_plot_image

app = FastAPI(title='Ashby Backend API')

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
UPLOADS_DIR = PROJECT_DIR / '.ashby-uploaded-data'


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


def _sanitize_filename(filename: str) -> str:
    source = Path(filename).name
    stem = re.sub(r'[^A-Za-z0-9._-]+', '-', Path(source).stem).strip('._-') or 'upload'
    suffix = Path(source).suffix.lower() or '.xlsx'
    if suffix != '.xlsx':
        suffix = '.xlsx'
    return f'{stem}-{uuid4().hex[:8]}{suffix}'


def _store_uploaded_xlsx(file_bytes: bytes, filename: str) -> str:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    stored_name = _sanitize_filename(filename)
    target_path = UPLOADS_DIR / stored_name
    target_path.write_bytes(file_bytes)
    return stored_name


def _extract_columns_from_xlsx(file_bytes: bytes, sheet_index: int) -> list[str]:
    dataframes = pd.read_excel(io.BytesIO(file_bytes), sheet_name=None)
    sheet_names = list(dataframes.keys())
    if not sheet_names:
        return []
    index = min(max(sheet_index, 0), len(sheet_names) - 1)
    selected = dataframes[sheet_names[index]]
    return [str(column).strip() for column in selected.columns if str(column).strip()]


def _encode_messages_header(messages: list[str]) -> str:
    return quote(json.dumps(messages, ensure_ascii=False), safe='')


@app.post('/api/render-plot')
def render_plot(payload: RenderPlotRequest) -> Response:
    try:
        rendered_plot = render_plot_image(
            payload.config,
            dataframe_index=payload.dataframe_index,
            frame_index=payload.frame_index,
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
def download_plots(payload: DownloadPlotsRequest) -> Response:
    output = io.BytesIO()
    with zipfile.ZipFile(output, mode='w', compression=zipfile.ZIP_DEFLATED) as archive:
        for plot in payload.plots:
            rendered_plot = render_plot_image(
                payload.config,
                dataframe_index=plot.dataframe_index,
                frame_index=plot.frame_index,
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
        if not teable_url_json or not api_key_json:
            return JSONResponse({'success': False, 'message': 'Missing teable_url or API_Key.'}, status_code=400)
        return JSONResponse({'success': True, 'columns': []})

    if file is None:
        if not teable_url or not API_Key:
            return JSONResponse({'success': False, 'message': 'Missing teable_url or API_Key.'}, status_code=400)
        return JSONResponse({'success': True, 'columns': []})

    file_bytes = await file.read()
    columns = _extract_columns_from_xlsx(file_bytes, import_sheet)
    stored_import_file_name = _store_uploaded_xlsx(file_bytes, file.filename or 'uploaded.xlsx')
    return JSONResponse({'success': True, 'columns': columns, 'import_file_name': stored_import_file_name})
