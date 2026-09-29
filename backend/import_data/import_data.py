import io
from pathlib import Path

import pandas as pd

from . import teable
from .filter import filter_data

try:
    from ..security import check_row_count, check_xlsx_bytes
except ImportError:     # plot.py started as a script from backend/
    from security import check_row_count, check_xlsx_bytes


import os

BACKEND_DIR = Path(__file__).resolve().parent.parent
MATERIAL_PROPERTIES_DIR = Path(os.environ.get('ASHBY_MATERIAL_PROPERTIES_DIR', BACKEND_DIR / 'material_properties'))

# python-calamine (Rust) reads .xlsx about 6–13x faster than openpyxl and returns the same data.
# This matters for workbooks whose sheet dimension claims far more rows than they contain.
# openpyxl stays the fallback when python-calamine is not installed.
try:
    import python_calamine  # noqa: F401
    EXCEL_ENGINE = 'calamine'
except ImportError:
    EXCEL_ENGINE = 'openpyxl'


def _resolve_import_file_path(import_file_name: str) -> Path:
    candidate = Path(import_file_name)

    search_roots = [MATERIAL_PROPERTIES_DIR.resolve()]
    for root in search_roots:
        resolved_candidate = (root / candidate).resolve()
        if root in resolved_candidate.parents and resolved_candidate.suffix.lower() == '.xlsx':
            if resolved_candidate.is_file():
                return resolved_candidate

    raise FileNotFoundError(f"Unable to locate import file '{import_file_name}'.")


def list_available_import_files() -> list[str]:
    if not MATERIAL_PROPERTIES_DIR.is_dir():
        return []

    return sorted(
        path.relative_to(MATERIAL_PROPERTIES_DIR).as_posix()
        for path in MATERIAL_PROPERTIES_DIR.rglob('*.xlsx')
        if path.is_file()
    )


def import_data(dataframe, frame, Sorted_data, xlsx_file_bytes=None):
    if dataframe.get('teable_url',None) != None:
        data = import_teable(
            dataframe['teable_url'],
            dataframe['API_Key'],
            frame['layers'],
            frame.get('filter', None),
            [
                Sorted_data.absolute.columns[0],
                Sorted_data.absolute.columns[1],
                Sorted_data.relative.columns[0],
                Sorted_data.relative.columns[1],
            ],
            verify_tls=dataframe.get('verify_tls', True),
        )
    elif dataframe.get('import_file_name',None) != None:
        if xlsx_file_bytes is not None:
            data = import_excel_bytes(xlsx_file_bytes, dataframe.get('import_sheet',0), frame.get('filter', None))
        else:
            data = import_excel(dataframe['import_file_name'], dataframe.get('import_sheet',0), frame.get('filter', None))
    else:
        raise FileNotFoundError("no datasource selected. set teable_url or import_file_name in config")
    check_row_count(len(data))
    return data

RANGE_SUFFIXES = ('low', 'high')   # the plot reads "<name> low" and "<name> high"; a "<name> unit" column is not used
MAX_LISTED = 8  # entries listed per warning


def _to_number(values: pd.Series) -> pd.Series:
    '''Numbers of a low/high column. Text with a decimal comma ("1,5") counts as a number; other text becomes NaN.'''
    if not pd.api.types.is_numeric_dtype(values):
        values = values.map(lambda value: value.strip().replace(',', '.') if isinstance(value, str) else value)
    return pd.to_numeric(values, errors='coerce')


def _range_columns(names) -> dict[str, dict[str, str]]:
    '''Quantity name → {"low": column, "high": column} for the columns found.'''
    quantities: dict[str, dict[str, str]] = {}
    for name in names:
        stripped = str(name).strip()
        for suffix in RANGE_SUFFIXES:
            base = stripped[:-len(suffix) - 1].strip()
            if stripped.endswith(f' {suffix}') and base:
                quantities.setdefault(base, {})[suffix] = name
    return quantities


def prepare_sheet(data: pd.DataFrame) -> pd.DataFrame:
    '''Makes a sheet plottable despite common spreadsheet habits: column names lose surrounding
    spaces (plots look them up by their exact name), and low/high values typed as text become numbers
    ("1,5" → 1.5) or, if they are no numbers, empty cells that are skipped instead of stopping the plot.'''
    data = data.rename(columns=lambda name: name.strip() if isinstance(name, str) else name)
    for columns in _range_columns(data.columns).values():
        for column in columns.values():
            data[column] = _to_number(data[column])
    return data


def check_excel_format(data: pd.DataFrame) -> list[dict]:
    '''Problems of a sheet (as read, before prepare_sheet) that keep data from being plotted. Codes and
    details for the frontend, which words them.

    Needed: the column names in the first row and each quantity as the columns "<name> low" and
    "<name> high" with numbers. Everything else (text columns for layers and materials, unit columns,
    further columns) is optional.
    '''
    if data.shape[1] == 0 or data.shape[0] == 0:
        return [{'code': 'empty_sheet'}]

    warnings: list[dict] = []
    quantities = _range_columns(data.columns)
    complete = [base for base, columns in quantities.items() if len(columns) == len(RANGE_SUFFIXES)]
    if not complete:
        # Typically the column names are not in the first row.
        return [{'code': 'no_quantities'}]

    # Without its partner column a quantity cannot be selected as an axis.
    incomplete = [
        {'name': base, 'missing': [suffix for suffix in RANGE_SUFFIXES if suffix not in columns]}
        for base, columns in sorted(quantities.items()) if len(columns) < len(RANGE_SUFFIXES)
    ]
    if incomplete:
        warnings.append({'code': 'incomplete_quantities', 'count': len(incomplete), 'quantities': incomplete[:MAX_LISTED]})

    # Text that is no number (e.g. "n/a", ">200") is left out of the plot.
    non_numeric = []
    for base, columns in sorted(quantities.items()):
        for suffix in RANGE_SUFFIXES:
            if suffix not in columns:
                continue
            values = data[columns[suffix]]
            invalid = values[values.notna() & _to_number(values).isna()]
            if len(invalid):
                non_numeric.append({'column': str(columns[suffix]).strip(), 'count': int(len(invalid)), 'example': str(invalid.iloc[0])[:40]})
    if non_numeric:
        warnings.append({'code': 'non_numeric_values', 'count': len(non_numeric), 'columns': non_numeric[:MAX_LISTED]})

    return warnings


def import_excel_metadata(import_file_name: str, import_sheet: int):
    '''Columns, text values per column, sheet names and format warnings of a provided dataset.'''
    file_path = _resolve_import_file_path(import_file_name)
    xls = pd.ExcelFile(file_path, engine=EXCEL_ENGINE)
    sheet_names = xls.sheet_names

    index = min(max(import_sheet, 0), len(sheet_names) - 1)
    data = pd.read_excel(xls, sheet_name=sheet_names[index])

    columns = [str(column).strip() for column in data.columns if str(column).strip()]

    keywords_by_column: dict[str, list[str]] = {}
    for column in data.columns:
        normalized_column = str(column).strip()
        if not normalized_column:
            continue
        series = data[column].dropna()
        keywords = sorted(
            {
                str(entry).strip()
                for entry in series
                if isinstance(entry, str) and str(entry).strip()
            },
            key=lambda entry: entry.lower(),
        )
        keywords_by_column[normalized_column] = keywords

    return columns, keywords_by_column, sheet_names, check_excel_format(data)

def import_teable(teable_url, api_key, layers, filter, axes, verify_tls=True):
    wanted_fields = columns_list(axes, layers)
    # filtered here like Excel rows (by column name), not by Teable, whose filter needs field IDs
    records = filter_data(teable.fetch_records(teable_url, api_key, verify_tls=verify_tls), filter or None)
    dataframe = pd.DataFrame(records, columns=wanted_fields)        # & raise error if _low or layer column not found
    print(f"data received successfully  (Total of {len(records)} points)")
    return dataframe

def columns_list(axes, layers):  # returns a list of all columns that should be requested via API
    wanted_fields = []

    for layer in range(len(layers) -1):
        wanted_fields.append(layers[layer]["name"])
    for columns in axes:
        for column in columns:
            if column == None: continue
            wanted_fields.append(column + " low" )
            wanted_fields.append(column + " high")

    return wanted_fields



def import_excel(import_file_name, import_sheet, filter_clause=None):
    file_path = _resolve_import_file_path(import_file_name)
    data = prepare_sheet(pd.read_excel(
        file_path,
        sheet_name = import_sheet,
        engine = EXCEL_ENGINE,
    ))

    if filter_clause:
        filtered = filter_data(data.to_dict(orient='records'), filter_clause)
        return pd.DataFrame(filtered, columns=data.columns)

    return data


def import_excel_bytes(file_bytes, import_sheet, filter_clause=None):
    check_xlsx_bytes(file_bytes)
    data = prepare_sheet(pd.read_excel(
        io.BytesIO(file_bytes),
        sheet_name = import_sheet,
        engine = EXCEL_ENGINE,
    ))

    if filter_clause:
        filtered = filter_data(data.to_dict(orient='records'), filter_clause)
        return pd.DataFrame(filtered, columns=data.columns)

    return data
