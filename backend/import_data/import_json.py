import json
from termcolor import (colored, cprint)


CURRENT_VERSION = 5

def import_json(filename):
    try:
        with open('./configs/' + filename, 'r', encoding="utf-8") as file:
            config = json.load(file)

        load_json(config)

    except FileNotFoundError:
        print(f"{filename} does not exist in './configs/'. please verify the name and position of your config")
        raise



def load_json(config:dict) -> dict:
    if config.get('version',None) != CURRENT_VERSION:
        cprint("WARNING: wrong .json format. Your config might not fully work as some compents might be outdated. Expect Errors", 'yellow')

    return set_default(clear_empty_strings(config))



def clear_empty_strings(config:dict|list|tuple|set,) -> dict:
    '''removes keys that only have an empty string as value from a dict and its sub-dicts'''
    try:
        if isinstance(config, (list, tuple, set)):
            config_ = []
            for entry in config:
                if isinstance(entry, (dict, list, tuple, set)):
                    entry = clear_empty_strings(entry)
                if entry not in ["", {}, []]:
                    config_.append(entry) # remove empty entries

        elif isinstance(config, dict):
            config_ = {}
            for key, value in config.items():
                if isinstance(value, (dict, list, tuple, set)):
                    value = clear_empty_strings(value)
                if value not in ["", {}, []]:
                    config_[key] = value

        return config_
    except Exception as e:
        print(f"ERROR: could not parse config for {config}\n{e}")
        return(config)



def set_default(config:dict) -> dict:
    # config.setdefault('','')
    return config