# Ashby Plot Tool Capabilities


## 1. Configuration and run model

- Supports config version check (expects version 3).
- Supports multiple dataframes in one config file.
- Can run all dataframes, or only selected dataframe indices.
- Each dataframe can contain multiple frames (plots).
- Can run all frames, or only selected frame indices.
- Per-frame naming for console output and exported file naming.

## 2. Data source capabilities

- Teable API import is supported:
  - Uses API key and URL.
  - Requests only required fields (layer names + axis columns).
  - Supports paged loading (take/skip loop).
- Excel import is supported:
  - Read files
  - Selects sheet by index.
  - Select columns and map them onto known keys
- Basic filtering structure exists:
  - Filter tree with conjunctions (and/or) is present.
  - Commented/TODO state indicates this is not fully complete.
  - Config note also states filter is not fully functional with Excel import.

## 3. Plot composition model

- Hierarchical layer model is supported.
- Layer controls include:
  - layer name (grouping field)
  - per-layer opacity
  - per-layer hull outline width
- Per-material color mapping is supported through material_colors.
- default color fallback is supported.
- Setting a material color to null can hide corresponding visuals.

## 4. Axis and quantity system

- x and y can be mapped to named quantities defined in axes list.
- Quantities are mapped to one or more source columns.
- Each axis quantity supports modes:
  - default: first available column
  - max: largest available value
  - min: smallest available value
  - span: low from minimum and high from maximum
- Relative quantities are supported (divide x/y by another quantity).
- Axis labels are language-aware through labels dictionaries.
- Plot labels can show absolute or absolute/relative formatting.

## 5. Point and range handling

- Single-value points are plotted.
- Value ranges are supported via low/high columns.
- Missing data is skipped with plotted/skipped counters in output.
- If ranges exist, range envelopes can be visualized as area-like ellipses/lines.

## 6. Hull and area generation

- Group hull generation is supported for grouped data.
- Supports two hull shape algorithms:
  - cubic (default)
  - alpha (alphashape-based)
- For near-collinear groups, fallback ellipse representation is used.
- Hull visuals include filled area plus outline.

## 7. Styling, layout, and theming

- Language setting at dataframe and frame level.
- Dark mode switches text/spine colors to white/black.
- Font customization:
  - family class (font_style)
  - font face
  - base font size
- Configurable image ratio (figure aspect behavior).
- Automatic display-area padding based on data spread.
- Optional explicit x_lim and y_lim overrides.
- Optional log scaling on x and/or y axes.
- Grid line rendering is enabled.

## 8. Legend system

- Legend can be enabled/disabled per frame.
- Legend title supports language dictionary.
- Legend placement options:
  - right side
  - above plot
- Legend entries are tied to plotted categories.

## 9. Guidelines and overlays

- Guidelines are supported with:
  - anchor by x/y (supports vertical/horizontal/slope line)
  - line style/color/linewidth via line_props
  - label text, font size/color, side placement, and padding
- Colored background areas are supported:
  - polygon via x/y points
  - axis-bounded area via named axes ranges
  - color and alpha control

## 10. Annotation system

- Annotation defaults supported:
  - marker_size
  - font_size
- Per-annotation controls supported:
  - text label
  - axis-based anchor position
  - relative text offset
  - text color and optional font size override
  - marker symbol/color/size factor/edge styling
  - optional arrows with matplotlib arrow properties

## 11. Interactivity

- Interactive mode (popup display) is supported.
- Non-interactive mode can return figure object for external use.
- Click interactions are supported in popup mode:
  - click legend entries to toggle group visibility
  - click points/range markers to show point label
- Visibility toggle updates legend alpha to indicate hidden groups.

## 12. Output and export

- If export_file_name is null:
  - plot opens in interactive window.
- If export_file_name is set:
  - directories are created automatically under export
  - figure is saved with transparent background
- Resolution handling:
  - resolution as number exports PNG
  - resolution as svg (or missing) exports SVG behavior
- Watermark image overlay is supported in popup title mode.

## 13. Validation and error behavior

- Raises error when data source is missing.
- Raises error when imported dataset is empty.
- Raises error when nothing could be plotted.
- Emits warnings for missing configured columns.
- Colored-area and guideline rendering are guarded with try/except, allowing continuation.
