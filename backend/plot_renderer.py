from __future__ import annotations

import os
import re
import tempfile
from copy import deepcopy
from contextlib import redirect_stdout
from dataclasses import dataclass
from io import StringIO
from typing import Any

import matplotlib

matplotlib.use('Agg')

from . import plot


@dataclass
class RenderedPlot:
    content: bytes
    media_type: str
    file_format: str
    messages: list[str]


@dataclass
class RequestDataSource:
    kind: str
    content: bytes
    filename: str | None = None


class PlotRenderError(Exception):
    def __init__(self, message: str, messages: list[str] | None = None):
        super().__init__(message)
        self.messages = messages or []


ANSI_ESCAPE_PATTERN = re.compile(r'\x1b\[[0-9;]*m')


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

        plot_output = StringIO()
        try:
            with redirect_stdout(plot_output):
                source = (data_sources or {}).get(dataframe_index)
                plot.main(
                    dataframe,
                    interactive=False,
                    xlsx_file_bytes=source.content if source and source.kind == 'xlsx' else None,
                )
        except Exception as exc:
            raise PlotRenderError(str(exc), _extract_plot_messages(plot_output.getvalue())) from exc

        if not os.path.exists(output_path):
            raise PlotRenderError('Plot output was not generated.', [])

        with open(output_path, 'rb') as f:
            content = f.read()

        return RenderedPlot(
            content=content,
            media_type=media_type,
            file_format=file_format,
            messages=_extract_plot_messages(plot_output.getvalue()),
        )
