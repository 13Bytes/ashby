"""Hardening helpers for running the Ashby backend on a public server.

All limits can be tuned through environment variables so a deployment can
loosen or tighten them without code changes.
"""
from __future__ import annotations

import io
import ipaddress
import json
import math
import os
import socket
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import requests


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def _env_list(name: str) -> set[str]:
    return {entry.strip().lower() for entry in os.environ.get(name, '').split(',') if entry.strip()}


BACKEND_DIR   = Path(__file__).resolve().parent
WATERMARK_DIR = BACKEND_DIR / 'media' / 'watermarks'

# : request / upload limits :
MAX_REQUEST_BYTES            = _env_int('ASHBY_MAX_REQUEST_BYTES', 50 * 1024 * 1024)     # uploads (multipart)
MAX_JSON_BYTES               = _env_int('ASHBY_MAX_JSON_BYTES', 5 * 1024 * 1024)          # every other body (configs are a few kB)
MAX_QUEUED_RENDERS           = _env_int('ASHBY_MAX_QUEUED_RENDERS', 16)                   # renders waiting for the (single) renderer
MAX_XLSX_UNCOMPRESSED_BYTES  = _env_int('ASHBY_MAX_XLSX_UNCOMPRESSED_BYTES', 300 * 1024 * 1024)
MAX_XLSX_ENTRIES             = _env_int('ASHBY_MAX_XLSX_ENTRIES', 5000)
MAX_DATA_ROWS                = _env_int('ASHBY_MAX_DATA_ROWS', 100_000)
MAX_UPLOAD_FILES             = _env_int('ASHBY_MAX_UPLOAD_FILES', 20)
MAX_PLOTS_PER_DOWNLOAD       = _env_int('ASHBY_MAX_PLOTS_PER_DOWNLOAD', 100)

# : outbound (Teable) requests :
MAX_REMOTE_RESPONSE_BYTES    = _env_int('ASHBY_MAX_REMOTE_RESPONSE_BYTES', 50 * 1024 * 1024)
# Comma separated host names. When set, only these hosts may be contacted (and they may be private / plain http).
ALLOWED_REMOTE_HOSTS         = _env_list('ASHBY_TEABLE_ALLOWED_HOSTS')


class UnsafeRemoteURL(ValueError):
    """The user supplied URL must not be requested by the server (SSRF protection)."""


class RemoteRequestError(ValueError):
    """The remote server answered with something the backend refuses to process."""


# : SSRF protection :
def _is_public_address(address: str) -> bool:
    ip = ipaddress.ip_address(address.split('%', 1)[0])
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


def validate_remote_url(url: Any) -> str:
    '''rejects URLs that would let a client use the server to reach internal services'''
    if not isinstance(url, str) or not url.strip():
        raise UnsafeRemoteURL('Teable URL is missing.')
    url = url.strip()
    parts = urlsplit(url)
    host = (parts.hostname or '').lower()

    if parts.scheme not in ('https', 'http') or not host:
        raise UnsafeRemoteURL('Teable URL must be an absolute https:// URL.')
    if parts.username or parts.password:
        raise UnsafeRemoteURL('Teable URL must not contain credentials.')
    try:
        port = parts.port
    except ValueError as error:
        raise UnsafeRemoteURL('Teable URL has an invalid port.') from error

    if ALLOWED_REMOTE_HOSTS:
        if host not in ALLOWED_REMOTE_HOSTS:
            raise UnsafeRemoteURL(f"Teable host '{host}' is not allowed on this server.")
        return url

    if parts.scheme != 'https':
        raise UnsafeRemoteURL('Teable URL must use https:// so the API key is not sent in clear text.')

    try:
        addresses = {info[4][0] for info in socket.getaddrinfo(host, port or 443, proto=socket.IPPROTO_TCP)}
    except (socket.gaierror, UnicodeError) as error:
        raise UnsafeRemoteURL(f"Teable host '{host}' could not be resolved.") from error
    if not addresses or not all(_is_public_address(address) for address in addresses):
        raise UnsafeRemoteURL(f"Teable host '{host}' resolves to a non-public address.")
    return url


def read_capped_body(response: requests.Response) -> bytes:
    '''body of a response requested with stream=True, refusing more than MAX_REMOTE_RESPONSE_BYTES'''
    chunks: list[bytes] = []
    received = 0
    for chunk in response.iter_content(chunk_size=64 * 1024):
        received += len(chunk)
        if received > MAX_REMOTE_RESPONSE_BYTES:
            response.close()
            raise RemoteRequestError('Teable response is larger than this server allows.')
        chunks.append(chunk)
    return b''.join(chunks)


def parse_json(body: bytes) -> Any:
    return json.loads(body) if body else {}


# : uploaded workbooks :
def check_xlsx_bytes(content: bytes) -> None:
    '''rejects oversized uploads and zip bombs before pandas/openpyxl expand them'''
    if len(content) > MAX_REQUEST_BYTES:
        raise ValueError('Excel file is larger than this server allows.')
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            entries = archive.infolist()
    except zipfile.BadZipFile as error:
        raise ValueError('Uploaded file is not a valid .xlsx workbook.') from error
    if len(entries) > MAX_XLSX_ENTRIES:
        raise ValueError('Excel file contains too many internal parts.')
    if sum(entry.file_size for entry in entries) > MAX_XLSX_UNCOMPRESSED_BYTES:
        raise ValueError('Excel file expands to more data than this server allows.')


def check_row_count(row_count: int) -> None:
    if row_count > MAX_DATA_ROWS:
        raise ValueError(f'Datasource has {row_count} rows; this server allows at most {MAX_DATA_ROWS}.')


# : server side media (watermarks) :
MEDIA_SUFFIXES = {'.png', '.jpg', '.jpeg'}


def resolve_watermark_file(name: str) -> Path:
    '''maps a config value like "logo.png" to a file inside backend/media/watermarks, never outside'''
    root = WATERMARK_DIR.resolve()
    candidate = (root / name).resolve()
    if root not in candidate.parents or candidate.suffix.lower() not in MEDIA_SUFFIXES or not candidate.is_file():
        raise FileNotFoundError(f"Watermark '{name}' not found in backend/media/watermarks.")
    return candidate


# : error output :
_REDACTED_PATHS = sorted(
    {
        variant
        for path in (str(BACKEND_DIR.parent), tempfile.gettempdir(), sys.prefix, sys.base_prefix, os.path.expanduser('~'))
        if len(path) > 3
        for variant in (path, path.replace('\\', '/'))
    },
    key=len,
    reverse=True,
)


def redact_paths(text: str) -> str:
    '''error text / tracebacks for clients without the server's directory layout'''
    for path in _REDACTED_PATHS:
        text = text.replace(path, '…')
    return text


# : plot config sanitising :
MIN_DPI, MAX_DPI       = 10, 600
MIN_RATIO, MAX_RATIO   = 0.1, 10.0
MAX_PIXELS             = _env_int('ASHBY_MAX_PIXELS', 40_000_000)
MAX_STRING_LENGTH      = 1000
MAX_LIST_ITEMS         = 200

SIZE_LIMITS = {        # key → upper bound for numeric values anywhere in the config
    'font_size': 200, 'title_size': 200, 'legend_title_size': 200, 'legend_label_size': 200,
    'axis_label_size': 200, 'tick_size': 200, 'fontsize': 200,
    'linewidth': 100, 'linewidths': 100, 'lw': 100, 'width': 100, 'headwidth': 200, 'headlength': 200,
    'markersize': 200, 'ms': 200, 'markeredgewidth': 100, 'mew': 100,
    'marker_size': 20_000, 'size_factor': 50, 'label_padding': 1000,
}

# matplotlib keyword arguments that may be forwarded from the config. Everything else
# (e.g. `url`, which becomes a clickable link inside exported SVGs) is dropped.
LINE_PROP_KEYS = {
    'color', 'linestyle', 'ls', 'linewidth', 'lw', 'alpha', 'marker', 'markersize', 'ms',
    'markerfacecolor', 'markeredgecolor', 'markeredgewidth', 'mew', 'zorder', 'dashes',
    'solid_capstyle', 'dash_capstyle', 'drawstyle',
}
ARROW_PROP_KEYS = {
    'width', 'headwidth', 'headlength', 'shrink', 'facecolor', 'edgecolor', 'color', 'linewidth', 'lw',
    'linestyle', 'ls', 'alpha', 'arrowstyle', 'connectionstyle', 'shrinkA', 'shrinkB', 'mutation_scale', 'zorder',
}


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _safe_kwarg_value(value: Any) -> bool:
    if isinstance(value, bool) or value is None:
        return True
    if _is_number(value):
        return math.isfinite(value)
    if isinstance(value, str):
        return len(value) <= 200
    if isinstance(value, list):
        return len(value) <= 20 and all(_is_number(entry) and math.isfinite(entry) for entry in value)
    return False


def _filter_kwargs(props: Any, allowed: set[str]) -> dict[str, Any] | None:
    if not isinstance(props, dict):
        return None
    return {key: value for key, value in props.items() if key in allowed and _safe_kwarg_value(value)}


def _clamp_tree(node: Any, key: str | None = None) -> Any:
    '''recursively bounds strings, list lengths, non-finite numbers and size-like values'''
    if isinstance(node, dict):
        return {k: _clamp_tree(v, k) for k, v in node.items()}
    if isinstance(node, list):
        return [_clamp_tree(entry, key) for entry in node[:MAX_LIST_ITEMS]]
    if isinstance(node, str):
        return node[:MAX_STRING_LENGTH]
    if _is_number(node):
        if not math.isfinite(node):
            return None
        if key in SIZE_LIMITS:
            return min(max(node, 0), SIZE_LIMITS[key])
    return node


def _ratio(value: Any) -> float | None:
    if isinstance(value, (list, tuple)) and len(value) == 2 and all(_is_number(entry) for entry in value) and value[1]:
        return value[0] / value[1]
    if _is_number(value) and value > 0:
        return float(value)
    return None


def sanitize_render_config(dataframe: dict[str, Any], frame: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    '''bounds everything in a client supplied dataframe/frame that drives CPU, memory or file access'''
    dataframe = _clamp_tree(dataframe)
    frame = _clamp_tree(frame)

    # image size: aspect ratio × dpi must stay below MAX_PIXELS
    ratio = _ratio(frame.get('image_ratio')) or _ratio(dataframe.get('image_ratio')) or 16 / 9
    ratio = min(max(ratio, MIN_RATIO), MAX_RATIO)
    dataframe['image_ratio'] = ratio
    frame.pop('image_ratio', None)

    resolution = dataframe.get('resolution')
    if resolution not in (None, 'svg'):
        try:
            dpi = float(resolution)
        except (TypeError, ValueError) as error:
            raise ValueError("resolution must be 'svg' or a number (dpi).") from error
        if not math.isfinite(dpi):
            raise ValueError("resolution must be 'svg' or a number (dpi).")
        max_dpi_for_size = math.sqrt(MAX_PIXELS / (100 * ratio))     # figure is (10·ratio × 10) inch
        dataframe['resolution'] = min(max(dpi, MIN_DPI), MAX_DPI, max_dpi_for_size)

    for guideline in frame.get('guidelines') or []:
        if isinstance(guideline, dict) and 'line_props' in guideline:
            guideline['line_props'] = _filter_kwargs(guideline['line_props'], LINE_PROP_KEYS) or {}
    for annotation in frame.get('annotations') or []:
        if isinstance(annotation, dict) and annotation.get('arrow') is not None:
            annotation['arrow'] = _filter_kwargs(annotation['arrow'], ARROW_PROP_KEYS)

    return dataframe, frame
