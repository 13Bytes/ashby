from __future__ import annotations

import io
import re
from contextlib import redirect_stdout
from copy import deepcopy
from dataclasses import dataclass
from typing import Any

import matplotlib

matplotlib.use('Agg')

import matplotlib.pyplot as plt

from .import_data import import_data
from .plotting import (
    axe_label,
    data_handling,
    draw_colored_areas,
    draw_guideline,
    legend,
    marker,
    plot_size,
    plotter_graphics,
)


@dataclass
class RenderedPlot:
    content: bytes
    media_type: str
    file_format: str
    messages: list[str]


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
            for token in ('❗', 'ERROR', 'error', 'does not exist in your dataset')
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
    frame['layers'] = _sanitize_layers(frame.get('layers', []))
    return dataframe, frame


def _sanitize_layers(layers: Any) -> list[dict[str, Any]]:
    if not isinstance(layers, list):
        return []

    sanitized_layers: list[dict[str, Any]] = []
    for layer in layers:
        if not isinstance(layer, dict):
            continue

        sanitized_layer = deepcopy(layer)
        layer_name = sanitized_layer.get('name')
        if not isinstance(layer_name, str) or not layer_name.strip():
            sanitized_layer.pop('name', None)
        else:
            sanitized_layer['name'] = layer_name.strip()

        sanitized_layers.append(sanitized_layer)

    return sanitized_layers


def render_plot_image(
    config: dict[str, Any],
    dataframe_index: int = 0,
    frame_index: int = 0,
) -> RenderedPlot:
    dataframe, frame = _select_frame_config(config, dataframe_index, frame_index)

    df_language = dataframe.get('language', 'en')
    df_darkmode = dataframe.get('dark_mode', False)
    df_font = dataframe.get('font', {})
    resolution = dataframe.get('resolution')
    file_format = 'svg' if resolution in (None, 'svg') else 'png'
    image_ratio = frame.get('image_ratio', dataframe.get('image_ratio', 16 / 9))
    language = frame.get('language', df_language)
    font_color = 'white' if frame.get('dark_mode', df_darkmode) else 'black'
    font_style = df_font.get('font_style', 'sans-serif')
    font_family = df_font.get('font', 'Arial')
    font_size = df_font.get('font_size', 22)

    rc_params: dict[str, Any] = {
        'font.family': font_style,
        'font.size': font_size,
        f'font.{font_style}': [font_family],
    }
    if file_format == 'svg':
        rc_params['savefig.format'] = 'svg'

    stdout_buffer = io.StringIO()

    with matplotlib.rc_context(rc=rc_params):
        fig, ax = plt.subplots(1, 1, figsize=(10 * image_ratio, 10))
        try:
            with redirect_stdout(stdout_buffer):
                if frame.get('legend_flag', True):
                    plt.subplots_adjust(left=0.09, right=0.86)

                ax.tick_params(colors=font_color, labelsize=15)
                ax.spines[:].set_color(font_color)

                legend_instance = legend(dataframe.get('legend_title', ''))
                graphics = plotter_graphics(ax, legend_instance, frame.get('algorithm', 'cubic'))
                sorted_data = data_handling(graphics, dataframe, frame, language)
                marker_layer = marker(
                    frame.get('annotations', []),
                    dataframe['material_colors'],
                    sorted_data.absolute.quantities,
                    sorted_data.relative.quantities,
                    ax,
                )

                data = import_data(dataframe, frame, sorted_data)
                if len(data) == 0:
                    raise ValueError('No valid data imported.')

                plotted_data, _ = sorted_data.plot(data)
                if not len(plotted_data):
                    raise ValueError('No data plotted. Please check the config and your data source.')

                plot_bounds = plot_size(frame, plotted_data, marker_layer, image_ratio)

                if frame.get('legend_flag', True):
                    graphics.legend.create_legend(
                        language=language,
                        font_color=font_color,
                        above=frame.get('legend_above', False),
                    )

                if len(frame.get('colored_areas', [])) > 0:
                    draw_colored_areas(
                        frame['colored_areas'],
                        sorted_data,
                        marker_layer,
                        plot_bounds,
                        ax=ax,
                    )

                draw_guideline(
                    frame.get('guidelines', []),
                    x_min=plot_bounds.x.low / 2,
                    x_max=plot_bounds.x.high * 2,
                    y_min=plot_bounds.y.low / 2,
                    y_max=plot_bounds.y.high * 2,
                    font_color=font_color,
                    Marker=marker_layer,
                    ax=ax,
                )

                marker_layer.create_annotations(plot_bounds)

                ax.set(xlim=[plot_bounds.x.low, plot_bounds.x.high], ylim=[plot_bounds.y.low, plot_bounds.y.high])

                if frame.get('log_x_flag', False):
                    ax.set_xscale('log')
                if frame.get('log_y_flag', False):
                    ax.set_yscale('log')

                ax.set_xlabel(axe_label(sorted_data, 0), color=font_color, fontsize=18, labelpad=10)
                ax.set_ylabel(axe_label(sorted_data, 1), color=font_color, fontsize=18, labelpad=5)
                ax.grid(which='major', axis='both', linestyle='-.')

            messages = _extract_plot_messages(stdout_buffer.getvalue())

            if file_format == 'svg':
                buffer = io.StringIO()
                fig.savefig(buffer, format='svg', bbox_inches='tight', transparent=True)
                return RenderedPlot(
                    content=buffer.getvalue().encode('utf-8'),
                    media_type='image/svg+xml',
                    file_format=file_format,
                    messages=messages,
                )

            buffer = io.BytesIO()
            dpi = max(int(resolution / 10), 1) if isinstance(resolution, (int, float)) else 100
            fig.savefig(buffer, format='png', bbox_inches='tight', dpi=dpi, transparent=True)
            return RenderedPlot(
                content=buffer.getvalue(),
                media_type='image/png',
                file_format=file_format,
                messages=messages,
            )
        except Exception as exc:
            messages = _extract_plot_messages(stdout_buffer.getvalue())
            raise PlotRenderError(str(exc), messages) from exc
        finally:
            plt.close(fig)
