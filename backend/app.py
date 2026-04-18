from __future__ import annotations

import io
from typing import Any

from flask import Flask, jsonify, request
from openpyxl import load_workbook

app = Flask(__name__)


def _extract_columns_from_xlsx(file_bytes: bytes, sheet_index: int) -> list[str]:
    workbook = load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    sheets = workbook.worksheets
    if not sheets:
        return []
    index = min(max(sheet_index, 0), len(sheets) - 1)
    first_row = next(sheets[index].iter_rows(min_row=1, max_row=1, values_only=True), ())
    return [str(cell).strip() for cell in first_row if isinstance(cell, str) and cell.strip()]


@app.post('/api/render-plot')
def render_plot() -> Any:
    payload = request.get_json(silent=True) or {}
    config = payload.get('config')
    if not isinstance(config, dict):
        return jsonify({'message': 'Missing config payload.'}), 400

    svg = """<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'>
  <rect x='0' y='0' width='1200' height='675' fill='#f8fafc' />
  <text x='40' y='64' font-size='32' font-family='Arial, sans-serif' fill='#111827'>Backend SVG placeholder</text>
  <text x='40' y='104' font-size='18' font-family='Arial, sans-serif' fill='#334155'>Implement plotting logic inside backend/app.py render_plot().</text>
  <text x='40' y='138' font-size='15' font-family='monospace' fill='#475569'>Received config keys: %s</text>
</svg>""" % ', '.join(sorted(config.keys()))

    return jsonify({'svg': svg})


@app.post('/api/import-database')
def import_database() -> Any:
    if request.is_json:
        payload = request.get_json(silent=True) or {}
        teable_url = payload.get('teable_url')
        api_key = payload.get('API_Key')
        if not teable_url or not api_key:
            return jsonify({'success': False, 'message': 'Missing teable_url or API_Key.'}), 400
        return jsonify({'success': True, 'columns': []})

    upload = request.files.get('file')
    if upload is None:
        return jsonify({'success': False, 'message': 'Missing uploaded file.'}), 400

    try:
        sheet_index = int(request.form.get('import_sheet', '0'))
    except ValueError:
        sheet_index = 0

    columns = _extract_columns_from_xlsx(upload.read(), sheet_index)
    return jsonify({'success': True, 'columns': columns})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
