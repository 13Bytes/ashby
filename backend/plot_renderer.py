from __future__ import annotations

import os
import re
import sys
import tempfile
import threading
import time
import logging
import traceback
from copy import deepcopy
from contextlib import redirect_stderr, redirect_stdout
from dataclasses import dataclass
from io import StringIO
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use('Agg')
logging.getLogger('matplotlib.font_manager').setLevel(logging.ERROR)

from . import plot


@dataclass
class RenderedPlot:
    content: bytes
    media_type: str
    file_format: str
    messages: list[str]
    log: str = ''


@dataclass
class RequestDataSource:
    kind: str
    content: bytes
    filename: str | None = None


class PlotRenderError(Exception):
    def __init__(self, message: str, messages: list[str] | None = None, details: dict[str, str] | None = None):
        super().__init__(message)
        self.messages = messages or []
        # error_type, location, traceback and log, for the frontend's error details and log view
        self.details = details or {}


ANSI_ESCAPE_PATTERN = re.compile(r'\x1b\[[0-9;]*m')
BACKEND_DIR = Path(__file__).resolve().parent
MAX_LOG_CHARS = 100_000


def clean_log(raw_output: str) -> str:
    """Captured plot output without color codes; very long logs keep their end."""
    text = ANSI_ESCAPE_PATTERN.sub('', raw_output)
    if len(text) > MAX_LOG_CHARS:
        text = f'… (log truncated, showing the last {MAX_LOG_CHARS} characters)\n' + text[-MAX_LOG_CHARS:]
    return text


def _is_backend_frame(frame: traceback.FrameSummary) -> bool:
    return Path(frame.filename).resolve().is_relative_to(BACKEND_DIR)


def _format_frame(frame: traceback.FrameSummary | None) -> str:
    """'file:line in function: source line', with paths relative to the backend."""
    if frame is None:
        return ''
    try:
        path = Path(frame.filename).resolve().relative_to(BACKEND_DIR).as_posix()
    except ValueError:
        path = Path(frame.filename).name
    location = f'{path}:{frame.lineno} in {frame.name}'
    if frame.line:
        location += f': {frame.line.strip()}'
    return location


def describe_exception(exc: BaseException) -> dict[str, str]:
    """Type, message, location in the backend code and traceback of an exception.

    The location is the innermost frame in the backend's own files, so an error raised inside a
    library (e.g. a pandas KeyError) points at the line of our code that triggered it.
    """
    frames = traceback.extract_tb(exc.__traceback__)
    own_frames = [frame for frame in frames if _is_backend_frame(frame)]
    return {
        'error_type': type(exc).__name__,
        'message': f'{type(exc).__name__}: {exc}',
        'location': _format_frame((own_frames or frames or [None])[-1]),
        'traceback': ''.join(traceback.format_exception(exc)),
    }


# --- live status of running renders -------------------------------------------------------------
# matplotlib's pyplot state is global, so renders run one at a time. While a render runs, the
# status endpoint reports what it is doing: the line of backend code it is executing right now
# (read from the render thread's stack) and its latest output.

_RENDER_LOCK = threading.Lock()
THIS_FILE = Path(__file__).resolve()


@dataclass
class _RenderProgress:
    started: float
    output: StringIO
    thread_id: int | None = None  # set once the render holds the lock


_active_renders: dict[str, _RenderProgress] = {}


def get_render_status(request_id: str) -> dict[str, Any] | None:
    """What a render started with `request_id` is doing right now, or None if it is not running."""
    progress = _active_renders.get(request_id)
    if progress is None:
        return None

    location = waiting_in = ''
    if progress.thread_id is not None:
        thread_frame = sys._current_frames().get(progress.thread_id)
        if thread_frame is not None:
            stack = traceback.extract_stack(thread_frame)
            own = [frame for frame in stack if _is_backend_frame(frame) and Path(frame.filename).resolve() != THIS_FILE]
            location = _format_frame(own[-1] if own else None)
            # The innermost frame shows e.g. a network read or a numpy routine the code waits on.
            if stack and not _is_backend_frame(stack[-1]):
                waiting_in = _format_frame(stack[-1])

    output_lines = [line for line in clean_log(progress.output.getvalue()).splitlines() if line.strip()]
    return {
        'state': 'running' if progress.thread_id is not None else 'queued',
        'elapsed_seconds': round(time.monotonic() - progress.started, 1),
        'location': location,
        'waiting_in': waiting_in,
        'queued_renders': sum(1 for other in _active_renders.values() if other.thread_id is None and other is not progress),
        'output_tail': output_lines[-8:],
    }


def _extract_plot_messages(raw_output: str) -> list[str]:
    messages: list[str] = []
    seen: set[str] = set()

    for line in raw_output.splitlines():
        normalized = ANSI_ESCAPE_PATTERN.sub('', line).strip()
        if not normalized:
            continue

        if not any(
            token in normalized
            for token in ('❗', 'WARNING', 'ERROR', 'error', 'does not exist in your dataset')
        ):
            continue

        if normalized not in seen:
            seen.add(normalized)
            messages.append(normalized)

    return messages


def _select_frame_config(
    config: dict[str, Any],
    dataframe_index: int,
    frame_index: int,
) -> tuple[dict[str, Any], dict[str, Any]]:
    if isinstance(config.get('dataframes'), list):
        dataframes = config['dataframes']
        if not dataframes:
            raise ValueError('Config does not contain any dataframes.')
        dataframe = deepcopy(dataframes[min(max(dataframe_index, 0), len(dataframes) - 1)])
    else:
        dataframe = deepcopy(config)

    frames = dataframe.get('frames', [])
    if not isinstance(frames, list) or not frames:
        raise ValueError('Selected dataframe does not contain any frames.')

    frame = deepcopy(frames[min(max(frame_index, 0), len(frames) - 1)])
    return dataframe, frame


def render_plot_image(
    config: dict[str, Any],
    dataframe_index: int = 0,
    frame_index: int = 0,
    data_sources: dict[int, RequestDataSource] | None = None,
    request_id: str | None = None,
) -> RenderedPlot:
    """Renders one frame. With a `request_id`, get_render_status() reports its progress."""
    progress = _RenderProgress(started=time.monotonic(), output=StringIO())
    if request_id:
        _active_renders[request_id] = progress
    try:
        with _RENDER_LOCK:
            progress.thread_id = threading.get_ident()
            return _render_plot_image(config, dataframe_index, frame_index, data_sources, progress.output)
    finally:
        if request_id:
            _active_renders.pop(request_id, None)


def _render_plot_image(
    config: dict[str, Any],
    dataframe_index: int,
    frame_index: int,
    data_sources: dict[int, RequestDataSource] | None,
    plot_output: StringIO,
) -> RenderedPlot:
    dataframe, frame = _select_frame_config(config, dataframe_index, frame_index)

    resolution = dataframe.get('resolution', None)
    file_format = 'svg' if resolution in (None, 'svg') else 'png'
    media_type = 'image/svg+xml' if file_format == 'svg' else 'image/png'

    with tempfile.TemporaryDirectory() as tmpdir:
        output_path = tempfile.NamedTemporaryFile(
            prefix='ashby-render-',
            suffix=f'.{file_format}',
            dir=tmpdir,
            delete=False,
        ).name
        frame['export_file_name'] = output_path
        dataframe['frames'] = [frame]

        try:
            with redirect_stdout(plot_output), redirect_stderr(plot_output):
                source = (data_sources or {}).get(dataframe_index)
                plot.main(
                    dataframe,
                    interactive=False,
                    frontend=True,
                    xlsx_file_bytes=source.content if source and source.kind == 'xlsx' else None,
                )
        except Exception as exc:
            details = describe_exception(exc)
            details['log'] = clean_log(plot_output.getvalue())
            raise PlotRenderError(details['message'], _extract_plot_messages(plot_output.getvalue()), details) from exc

        if not os.path.exists(output_path):
            raise PlotRenderError('Plot output was not generated.', _extract_plot_messages(plot_output.getvalue()), {'log': clean_log(plot_output.getvalue())})

        with open(output_path, 'rb') as f:
            content = f.read()

        return RenderedPlot(
            content=content,
            media_type=media_type,
            file_format=file_format,
            messages=_extract_plot_messages(plot_output.getvalue()),
            log=clean_log(plot_output.getvalue()),
        )
