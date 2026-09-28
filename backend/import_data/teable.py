"""Teable API access shared by the column import (app.py) and the plot data import.

Accepts both the record API URL (https://host/api/table/tbl.../record) and the URL from the
browser's address bar (https://host/base/bse.../table/tbl.../viw...), and API keys with or
without the "Bearer " prefix.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

import requests

try:
    from ..security import RemoteRequestError, UnsafeRemoteURL, parse_json, read_capped_body, validate_remote_url
except ImportError:     # plot.py started as a script from backend/
    from security import RemoteRequestError, UnsafeRemoteURL, parse_json, read_capped_body, validate_remote_url

PAGE_SIZE = 1000  # Teable's maximum `take`
TIMEOUT_SECONDS = 30
MAX_PAGES = 200  # safety stop: 200,000 records, far more than a material table holds

_TABLE_ID = re.compile(r'(?<![A-Za-z0-9])(tbl[A-Za-z0-9]+)')
_VIEW_ID = re.compile(r'(?<![A-Za-z0-9])(viw[A-Za-z0-9]+)')


class TeableError(Exception):
    """A Teable request failed; the message is meant for the user."""


@dataclass(frozen=True)
class TeableSource:
    records_url: str
    fields_url: str
    view_id: str | None


def resolve_teable_source(teable_url: str) -> TeableSource:
    url = (teable_url or '').strip()
    parts = urlsplit(url)
    if parts.scheme not in ('http', 'https') or not parts.netloc:
        raise TeableError(f"Invalid Teable URL '{url}'. Expected e.g. https://teable.example.com/api/table/tbl.../record")
    table_match = _TABLE_ID.search(parts.path)
    if not table_match:
        raise TeableError(f"Could not find a table id (tbl...) in the Teable URL '{url}'.")
    view_match = _VIEW_ID.search(parts.path) or _VIEW_ID.search(parts.query)
    api_base = f'{parts.scheme}://{parts.netloc}/api/table/{table_match.group(1)}'
    return TeableSource(
        records_url=f'{api_base}/record',
        fields_url=f'{api_base}/field',
        view_id=view_match.group(1) if view_match else None,
    )


def authorization_header(api_key: str) -> str:
    key = (api_key or '').strip()
    if not key:
        raise TeableError('Missing Teable API key.')
    return key if key.lower().startswith('bearer ') else f'Bearer {key}'


def _get_json(url: str, api_key: str, params: dict[str, Any], verify_tls: bool) -> tuple[Any, bool]:
    """GET a Teable API endpoint. Returns the JSON body and the TLS setting used."""
    headers = {'Authorization': authorization_header(api_key), 'Accept': 'application/json'}
    try:
        url = validate_remote_url(url)      # no requests to internal addresses (SSRF)
    except UnsafeRemoteURL as error:
        raise TeableError(str(error)) from error
    verify_tls = verify_tls is not False    # only an explicit False disables certificate checks; never a silent fallback
    try:
        response = requests.get(url, params=params, headers=headers, timeout=TIMEOUT_SECONDS, verify=verify_tls, allow_redirects=False, stream=True)
    except requests.exceptions.SSLError as error:
        raise TeableError('Teable TLS certificate could not be verified. Please check the URL.') from error

    with response:
        if response.status_code in (401, 403):
            raise TeableError(f'Teable API: access denied ({response.status_code}). Please check the API key and its access to this table.')
        if response.status_code == 404:
            raise TeableError('Teable API: table not found (404). Please check the URL.')
        if not response.ok:
            # the body is not echoed: it may come from a server the user does not control
            raise TeableError(f'Teable API error {response.status_code}. Please check the URL.')
        try:
            return parse_json(read_capped_body(response)), verify_tls
        except RemoteRequestError as error:
            raise TeableError(str(error)) from error
        except ValueError as error:
            raise TeableError('Teable did not return JSON. Please check the URL.') from error


def fetch_field_names(teable_url: str, api_key: str, verify_tls: bool = True) -> list[str]:
    """All field (column) names of the table, in view order when the URL contains a view."""
    source = resolve_teable_source(teable_url)
    params = {'viewId': source.view_id} if source.view_id else {}
    payload, _ = _get_json(source.fields_url, api_key, params, verify_tls)
    if not isinstance(payload, list):
        raise TeableError('Unexpected Teable field list response.')
    return [str(field['name']).strip() for field in payload if isinstance(field, dict) and str(field.get('name', '')).strip()]


def fetch_records(
    teable_url: str,
    api_key: str,
    verify_tls: bool = True,
    filter_clause: dict[str, Any] | None = None,
    max_records: int | None = None,
) -> list[dict[str, Any]]:
    """The `fields` of all records (paginated). Teable omits empty cells from `fields`."""
    source = resolve_teable_source(teable_url)
    params: dict[str, Any] = {'take': PAGE_SIZE, 'skip': 0, 'fieldKeyType': 'name'}
    if source.view_id:
        params['viewId'] = source.view_id
    if filter_clause:
        params['filter'] = json.dumps(filter_clause)

    records: list[dict[str, Any]] = []
    while True:
        payload, verify_tls = _get_json(source.records_url, api_key, params, verify_tls)
        page = payload.get('records') if isinstance(payload, dict) else None
        if not isinstance(page, list):
            raise TeableError('Unexpected Teable record response.')
        records.extend(record.get('fields', {}) for record in page if isinstance(record, dict))
        if len(page) < params['take'] or (max_records is not None and len(records) >= max_records):
            break
        if params['skip'] // PAGE_SIZE + 1 >= MAX_PAGES:
            raise TeableError(f'Teable returned more than {MAX_PAGES * PAGE_SIZE} records; stopped to avoid an endless import. Please check the URL/view.')
        params['skip'] += params['take']
    return records[:max_records] if max_records is not None else records
