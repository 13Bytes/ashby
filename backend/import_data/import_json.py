import json

def import_json(filename):
    try:
        with open('./configs/' + filename, 'r', encoding="utf-8") as file:
            config = json.load(file)

        if config.get('version',None) == 5:
            return config
        else:            
            raise ValueError("wrong .json format")   # & use correct error
    except FileNotFoundError:
        print(f"{filename} does not exist in './configs/'. please verify the name and position of your config")
        raise