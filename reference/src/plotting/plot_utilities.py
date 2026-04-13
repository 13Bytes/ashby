import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib import colors
from types import SimpleNamespace
from termcolor import (colored, cprint)


from .plot_hull  import plotter_graphics
from .formatting import title

class data_handling(): 
    def __init__(self, graphics:type, dataframe:pd.DataFrame, frame:dict, language):
        self.graphics        = graphics
        self.absolute        = parse_data(dataframe['axes'], language, frame["x_quantity"], frame["y_quantity"])
        self.relative        = parse_data(dataframe['axes'], language, frame.get("x_rel_quantity",None), frame.get("y_rel_quantity",None))
        self.frame           = frame
        self.material_colors = dataframe['material_colors']
        self.layers          = frame['layers']
        self.layer_names     = []
        self.len_layers      = len(self.layers) 
        self.point_count     = {'skipped':0, 'plotted':0}     # [skipped, plotted]
        self.alpha_points    = self.layers[-1].get('alpha_points', None)
        self.alpha_areas     = self.layers[-1].get('alpha_areas',  None)

    def plot(self, data:pd.DataFrame) -> np.ndarray:
        self.absolute.clear_unused_columns(data)
        self.relative.clear_unused_columns(data)

        return self.recursive_preparation(
                            data,
                            current_layer_number = 0,
                            hirachie             = [],
                            legend_item          = "default",
                            current_color        = self.material_colors['default'],
                        )

    def recursive_preparation(self, data:pd.DataFrame, current_layer_number:int, hirachie:list, legend_item:str, current_color:str) -> np.ndarray:
        # +       recursive repetition       +
        if len(self.layers) > current_layer_number  and  'name' in self.layers[current_layer_number].keys():
            layer_name           = self.layers[current_layer_number]['name']
            self.layer_names.append(layer_name)
            layer_whitelist_flag = self.layers[current_layer_number].get('whitelist_flag',False)
            layer_whitelist      = self.layers[current_layer_number].get('whitelist',[])
            layer_alpha          = self.layers[current_layer_number].get('alpha',None)
            layer_linewidth      = self.layers[current_layer_number].get('linewidth',1.5)
            combined_DATA        = np.full((1, 2), np.nan)      # & leer erstelen?
            plotted = False            
           
            for category, material_data in data.groupby(layer_name, dropna=False):
                if pd.isna(category): category == None
                # print("====== Layer ", current_layer_number, ": ", category, "  (", layer_name, ") ======") 

                if  (category in layer_whitelist and layer_whitelist_flag == True) or \
                (category not in layer_whitelist and layer_whitelist_flag == False):
                    if category in self.material_colors and category != legend_item and layer_alpha:
                        current_color_instance = self.material_colors [category]
                        legend_item = category
                        if current_color_instance != None: 
                            self.graphics.legend.append_category(category, current_color_instance)
                    else:
                        current_color_instance = current_color

                    DATA, plotted = self.recursive_preparation(
                            material_data,
                            current_layer_number + 1,
                            hirachie + [category],
                            legend_item,
                            current_color_instance,
                        )

                    # print(DATA)
                    # print("plotted: ", plotted, "  -  keys: ", data.groupby(layer_name).groups.keys())
                    if DATA.shape[0] > 1 and layer_alpha != None and 0 < layer_alpha <= 1          \
                    and current_color != None and plotted == False: # hull not empty  &  visible  &  not identical to layer below if layer below is plotted
                        self.graphics.draw_hull(
                                DATA,
                                hirachie,
                                legend_item,
                                scale = 1.05,
                                plot_kwargs = {
                                    'color': current_color_instance,
                                    'alpha': layer_alpha,
                                    'label': category,
                                    'linewidth':layer_linewidth,
                                    },
                            )
                        plotted = True

                    combined_DATA = np.vstack((combined_DATA, DATA))

                    # print("-- Layer ", current_layer_number, " DATA: ", DATA, " combined_DATA: ", combined_DATA) # . combined_DATA[~np.isnan(combined_DATA)]


            if len(data.groupby(layer_name).groups.keys()) > 1:
                plotted = False
                    
            return combined_DATA[1:,:], plotted
                
        # +       recursive exit       +
        else:
            DATA = self.single_values(   # plot individual points
                    data,
                    hirachie,
                    legend_item,
                    current_color,
                )
            return DATA, False



    def single_values(self, data:pd.DataFrame, hirachie:list, legend_item:str, current_color:str) -> pd.DataFrame:
        point_list = np.full((1, 2), np.nan)     # [x, y][low, high][datapoints]

        for data_point in range(len(data)):
            coords = np.full((2, 2), np.nan)
            for dim, dimension in enumerate(['x','y']):
                coords[dim, :] = self.point_per_axis(data, data_point, dim)

            if np.any(np.isnan(coords[:,0])): 
                self.point_count['skipped'] += 1
                # print("⚠ skipped Point")
            else:
                self.point_count['plotted'] += 1
                self.plot_point(coords, point_list, hirachie, legend_item, current_color)
                point_list = np.vstack((point_list, coords[:,0]))  # add low
                if not np.all(pd.isna(coords[:, 1])):
                    point_list = np.vstack((point_list, coords[:,1]))   # add high if not empty in both dimensions

        point_list = point_list[1: ,:] # remove placeholder on beginning
        # print("x: ", np.transpose(point_list[:, 0]))
        # print("y: ", np.transpose(point_list[:, 1]))
        return point_list


    def point_per_axis(self, data:pd.DataFrame, data_point:pd.DataFrame, dim:int) -> pd.DataFrame:
        point = self.absolute.property_availability(data, data_point, dim)
        if np.all(point == None): return None

        if self.relative.columns[dim] != [None]:               # specific data  (/density)
            point_rel = self.relative.property_availability(data, data_point, dim)
            if np.all(point_rel == None): return None
            point /= point_rel

        return point



    def plot_point(self, coords:list, point_list:list, hirachie:list, legend_item:str, current_color:str) -> None:
        point_list = np.vstack((point_list, coords[:,0]))  # add low
        if not np.all(pd.isna(coords[:, 1])):
            point_list = np.vstack((point_list, coords[:,1]))   # add high if not empty in both dimensions

        # +  plot  + 
            if self.alpha_areas != None and 0 < self.alpha_areas <= 1 and current_color != None:
                if np.isnan(coords[0,1]): coords[0,1] = coords[0,0]
                if np.isnan(coords[1,1]): coords[1,1] = coords[1,0]

                self.graphics.draw_ellipses(
                        np.transpose(coords),
                        hirachie    = hirachie,
                        legend_item = legend_item,
                        scale       = 1.02,
                        plot_kwargs = {
                            'color':current_color,
                            'alpha':self.alpha_areas,
                            'picker':6,
                            },
                        value_ranges = True
                    )
        elif self.alpha_points != None and 0 < self.alpha_points <= 1 and current_color != None:
            self.graphics.plot(
                    coords[0, :],
                    coords[1, :],
                    color       = current_color,
                    alpha       = self.alpha_points,
                    hirachie    = hirachie,
                    legend_item = legend_item,
                )




class parse_data():   # relative & absolute separate
    def __init__(self, axes:dict, language:str, x_quantity:str, y_quantity:str) -> None:
        import_quantities = [x_quantity, y_quantity]
        self.quantities = [ None ,  None ]
        self.labels     = [ None ,  None ]
        self.columns    = [[None], [None]]
        self.modes      = [ None ,  None ]

        for dim, quantity in enumerate(import_quantities):
            for axe in axes:
                if axe['name'] == quantity:
                    self.quantities[dim]  = axe['name']
                    self.labels[dim]      = title(axe.get('labels',""), language)
                    self.columns[dim]     = axe['columns']
                    self.modes[dim]       = axe.get('mode',"default")
                    break
            
            if self.quantities[dim] != import_quantities[dim]:
                raise KeyError(f"{["x","y"][dim]}-quantity '{import_quantities[dim]}' not found. please check the config.json and datasource")

    def clear_unused_columns(self, data:pd.DataFrame) -> None:
        for dim in [0,1]:
            for column in self.columns[dim][:]:
                if column != None and f"{column} low" not in data.columns:
                    self.columns[dim].remove(column)
                    cprint(f"❗'{column}' does not exist in your dataset but is set in '{self.quantities[dim]}'","yellow")
        self.len_col = [len(self.columns[:][0]), len(self.columns[:][1])]


    def property_availability(self, data:dict, data_point:pd.DataFrame, dim:int) -> pd.DataFrame | None:
        point  = np.full((2, self.len_col[dim]), np.nan)   #[low,high][column entries]
        index  = None
        coordinate = np.empty([2])
        column = self.columns[dim]
        for property, property_data in enumerate(column):
            if not pd.isna(data[property_data + ' low'].iloc[data_point]):
                point[0, property] = data[    property_data + ' low'      ].iloc[data_point].copy()  # low

                if not pd.isna(data[property_data + ' high'].iloc[data_point]):
                    point[0, property] = data[    property_data + ' high' ].iloc[data_point].copy()  # high

                # point[1, property] = data.get(property_data + ' high', np.nan).iloc[data_point].copy()  # high  (optional)

                # if data.get(property_data + ' high', np.nan) != np.nan:                             # high
                #     point[1, property] = data[    property_data + ' high'].iloc[data_point].copy()
                # else:
                #     point[1,property] = np.nan
        
        if not np.all(np.isnan(point[0, :])):
            if   self.modes[dim] == "max":
                index = np.nanargmax(np.hstack([point[0,:],point[1,:]]))
                coordinate = point[:, index-np.size(point, axis=1) if index >= np.size(point, axis=1) else index ]
            elif self.modes[dim] == "min":
                coordinate = point[:, np.nanargmin(point[0, :])]
            elif self.modes[dim] == "span":
                coordinate[0] = point[0, np.nanargmin(point[0, :])]
                index = np.nanargmax(np.hstack([point[0,:],point[1,:]]))
                coordinate[1] = point[1, index-np.size(point, axis=1) if index >= np.size(point, axis=1) else index ]
            else: # dafult order
                coordinate = point[:, np.argmax(~np.isnan(point[0, :]))]

            return coordinate

        else:
            return None