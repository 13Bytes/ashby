import json
from pathlib import Path

import pandas as pd
import requests

from .filter import *


BACKEND_DIR = Path(__file__).resolve().parent.parent
MATERIAL_PROPERTIES_DIR = BACKEND_DIR / 'material_properties'
PROJECT_DIR = BACKEND_DIR.parent
UPLOADED_DATA_DIR = PROJECT_DIR / '.ashby-uploaded-data'


def _resolve_import_file_path(import_file_name: str) -> Path:
    candidate = Path(import_file_name)

    search_roots = [MATERIAL_PROPERTIES_DIR.resolve(), UPLOADED_DATA_DIR.resolve()]
    for root in search_roots:
        resolved_candidate = (root / candidate).resolve()
        if root in resolved_candidate.parents or resolved_candidate == root:
            if resolved_candidate.exists():
                return resolved_candidate

    raise FileNotFoundError(f"Unable to locate import file '{import_file_name}'.")


def import_data(dataframe, frame, Sorted_data):
    if dataframe.get('teable_url',None) != None:
        data = import_teable(dataframe['teable_url'], dataframe['API_Key'], frame['layers'], frame.get('filter', None), [Sorted_data.absolute.columns[0], Sorted_data.absolute.columns[1], Sorted_data.relative.columns[0], Sorted_data.relative.columns[1]])
    elif dataframe.get('import_file_name',None) != None:
        data = import_excel(dataframe['import_file_name'], dataframe.get('import_sheet',0))
    else:
        raise FileNotFoundError("no datasource selected. set teable_url or import_file_name in config")
    return data

def import_teable(teable_url, api_key, layers, filter, axes):
    wanted_fields = collums_list(axes, layers)

    params = {
        "take": 1000,
        "skip": 0,
        "filter": json.dumps(filter),
        "fields": wanted_fields
    }
    url = teable_url

    headers = {
        "Authorization": api_key,
        "Accept": "application/json"
    }


    status = requests.head(url, headers=headers)

    if status.status_code == 200:
        data = []
        print("importing...")
        while True:            
            response = requests.get(url, params=params, headers=headers).json()
            records = [rec["fields"] for rec in response["records"]]

            if not records:
                break

            params["skip"] += params["take"] 

            data.extend(records)
        dataframe = pd.DataFrame(data, columns=wanted_fields)        # & raise error if _low or layer column not found

        # print(dataframe)
        print(f"data received successfully  (Total of {len(data)} points)")  
  
        return dataframe
    elif status == 403:
        raise PermissionError("ERROR 403 - Teable API: kein Zugriffsrecht. Bitte API Key & URL prüfen")
    else:
        raise Exception(f"unknown Teable error {status.status_code}: {status.text}")

def collums_list(axes, layers):  # returns a list of all columns that should be requested via API
    wanted_fields = []

    for layer in range(len(layers) -1):
        wanted_fields.append(layers[layer]["name"])
    for columns in axes:
        for column in columns:
            if column == None: continue
            wanted_fields.append(column + " low" )
            wanted_fields.append(column + " high")

    return wanted_fields



def import_excel(import_file_name, import_sheet):
    file_path = _resolve_import_file_path(import_file_name)
    data = pd.read_excel(
        file_path,
        sheet_name = import_sheet
    )

    # & filter
    return data
