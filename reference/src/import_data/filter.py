def filter_data(data, filters):
    data_ = []  # & dict ?
    if filters == None:
        return data
    
    for entry in data:
        result = filter_master(entry, filters)
        if result:
            data_.append(entry)
    return data_

def filter_master(entry, filters):
    conjunction = filters.get('conjunction', None)
    if conjunction != None:
        filterSet   = filters['filterSet'] 
        if conjunction == "and":
            return filter_and(entry, filterSet)
        elif conjunction == "or":
            return filter_or(entry, filterSet)
    else:
        filter_entry(entry, filters)


def filter_and(entry, filterSet):
    for filter in filterSet:
        result = filter_master(entry, filter)
        if not result:
            return False
    return True


def filter_or(entry, filterSet):
    for filter in filterSet:
        result = filter_master(entry, filter)
        if result:
            return True
    return False
    

def filter_entry(entry, filter):
    fieldId  = filter['fieldId' ]
    operator = filter['operator']
    value    = filter['value'   ]
    if operator in ['is', 'isEqual']:
        if entry[filterId] == value:
            return True
    # & do stuff




# plot_datapoint = True
# for filter in filters:
#     entry = data[filter["name"]]
#     state = None
#     for keys in filter_keys:
#         if entry in keys["entries"]:
#             state = keys["state"]

#     if not state in filter["states"]:
#         plot_datapoint = False

# return plot_datapoint 
