import io
from pathlib import Path

import pandas as pd

from . import teable
from .filter import filter_data


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
        if root in resolved_candidate.parents or resolved_candidate == root:
            if resolved_candidate.exists():
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
    return data

QUANTITY_SUFFIXES = ('low', 'high', 'unit')
MAX_LISTED = 8  # entries listed per warning


def _column_letter(index: int) -> str:
    '''Excel column name of a 0-based column index (0 → A, 26 → AA).'''
    letters = ''
    index += 1
    while index:
        index, remainder = divmod(index - 1, 26)
        letters = chr(65 + remainder) + letters
    return letters


def check_excel_format(data: pd.DataFrame) -> list[dict]:
    '''Problems in a sheet that keep it from plotting as expected. Codes and details for the frontend, which words them.

    Expected layout: the column names in the first row, one row per material, text columns for layers
    and materials, and each quantity as the three columns "<name> low", "<name> high" and "<name> unit".
    '''
    if data.shape[1] == 0 or data.shape[0] == 0:
        return [{'code': 'empty_sheet'}]

    warnings: list[dict] = []
    names = [str(column) for column in data.columns]

    # pandas names columns without a header "Unnamed: n", e.g. when the names are not in the first row.
    # Empty ones (formatted but unused cells) do no harm.
    unnamed = [
        _column_letter(index) for index, (name, column) in enumerate(zip(names, data.columns))
        if name.startswith('Unnamed:') and data[column].notna().any()
    ]
    if unnamed:
        warnings.append({'code': 'unnamed_columns', 'count': len(unnamed), 'columns': unnamed[:MAX_LISTED]})

    # The plot looks columns up by their exact name, spaces included.
    padded = [name for name in names if name != name.strip() and not name.startswith('Unnamed:')]
    if padded:
        warnings.append({'code': 'padded_names', 'count': len(padded), 'columns': padded[:MAX_LISTED]})

    # pandas renames a repeated column name "name.1", "name.2", ...
    name_set = set(names)
    duplicates = sorted({name.rsplit('.', 1)[0] for name in names if '.' in name and name.rsplit('.', 1)[1].isdigit() and name.rsplit('.', 1)[0] in name_set})
    if duplicates:
        warnings.append({'code': 'duplicate_names', 'count': len(duplicates), 'columns': duplicates[:MAX_LISTED]})

    quantities: dict[str, dict[str, str]] = {}
    for name in names:
        stripped = name.strip()
        for suffix in QUANTITY_SUFFIXES:
            if stripped.endswith(f' {suffix}'):
                quantities.setdefault(stripped[:-len(suffix) - 1].strip(), {})[suffix] = name
    complete = sorted(base for base, columns in quantities.items() if len(columns) == len(QUANTITY_SUFFIXES))
    incomplete = [
        {'name': base, 'missing': [suffix for suffix in QUANTITY_SUFFIXES if suffix not in columns]}
        for base, columns in sorted(quantities.items()) if len(columns) < len(QUANTITY_SUFFIXES)
    ]
    if incomplete:
        warnings.append({'code': 'incomplete_quantities', 'count': len(incomplete), 'quantities': incomplete[:MAX_LISTED]})
    if not complete:
        warnings.append({'code': 'no_quantities'})

    # Text in a low/high column (e.g. "1,5" typed as text, "n/a", ">200") is not plotted.
    non_numeric = []
    low_above_high = []
    for base, columns in sorted(quantities.items()):
        numeric = {}
        for suffix in ('low', 'high'):
            if suffix not in columns:
                continue
            values = data[columns[suffix]]
            converted = pd.to_numeric(values, errors='coerce')
            invalid = values[values.notna() & converted.isna()]
            if len(invalid):
                non_numeric.append({'column': columns[suffix].strip(), 'count': int(len(invalid)), 'example': str(invalid.iloc[0])[:40]})
            numeric[suffix] = converted
        if 'low' in numeric and 'high' in numeric:
            swapped = int((numeric['low'] > numeric['high']).sum())
            if swapped:
                low_above_high.append({'name': base, 'count': swapped})
    if non_numeric:
        warnings.append({'code': 'non_numeric_values', 'count': len(non_numeric), 'columns': non_numeric[:MAX_LISTED]})
    if low_above_high:
        warnings.append({'code': 'low_above_high', 'count': len(low_above_high), 'quantities': low_above_high[:MAX_LISTED]})

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
    records = teable.fetch_records(teable_url, api_key, verify_tls=verify_tls, filter_clause=filter or None)
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
    data = pd.read_excel(
        file_path,
        sheet_name = import_sheet,
        engine = EXCEL_ENGINE,
    )

    if filter_clause:
        filtered = filter_data(data.to_dict(orient='records'), filter_clause)
        return pd.DataFrame(filtered, columns=data.columns)

    return data


def import_excel_bytes(file_bytes, import_sheet, filter_clause=None):
    data = pd.read_excel(
        io.BytesIO(file_bytes),
        sheet_name = import_sheet,
        engine = EXCEL_ENGINE,
    )

    if filter_clause:
        filtered = filter_data(data.to_dict(orient='records'), filter_clause)
        return pd.DataFrame(filtered, columns=data.columns)

    return data
