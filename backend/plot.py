import os
import pandas as pd
import matplotlib.pyplot as plt, mpld3
import matplotlib
import numpy as np
import json
from termcolor import (colored, cprint)

# from nicegui import ui

from import_data   import *
from plotting      import *
from eventhandling import *


CONFIG_NAME = "Zwischenbericht.json"


def main(dataframe:dict, interactive:bool) -> None:
    handler = []

    df_language = dataframe.get('language', "en")
    df_darkmode = dataframe.get('dark_mode', False)
    df_font     = dataframe.get('font', {})

    resolution = dataframe.get('resolution', None)
    if resolution in [None,"svg"]:
        fileformat = "svg"
        resolution = 100
    else:
        fileformat = "png"
    df_image_ratio = dataframe.get('image_ratio', 16/9)
    create_frames  = dataframe.get('create_all_frames', True)

    # : FRAME                                                                               :
    for frame_index, frame in enumerate(dataframe.get('frames',[])):
        if not (create_frames == True or frame_index +1 in create_frames):
            continue

        cprint(f"\n::::::::::::::::::::::::::::  creating frame {frame_index + 1} of {len(dataframe['frames'])} {frame.get('name', '')} :::::::::::::::::::::::::::: \n","blue")


        # : General setup :
        if frame.get('dark_mode', df_darkmode):
            font_color = 'white'
        else:
            font_color = 'black'

        language = frame.get('language', df_language)
        image_ratio = frame.get('image_ratio', df_image_ratio)

        figure_size = (10*image_ratio ,10)
        # with ui.matplotlib(figsize=figure_size) as mpl_fig:
            # fig = mpl_fig.figure
            # ax = fig.add_subplot(1,1, 1)        # & no subplots
        fig, ax = plt.subplots(1,1, figsize=figure_size)
        if frame.get('legend_flag',True) == True:
            plt.subplots_adjust(left=0.09, right=0.86)
        
        ax.tick_params(colors=font_color, labelsize=15)
        ax.spines[:].set_color(font_color)

        plt.rcParams.update({'font.family': df_font.get('font_style',"sans-serif")})
        plt.rcParams.update({f"font.{df_font.get('font_style', 'sans-serif')}": df_font.get('font', 'Arial')})
        plt.rcParams.update({'font.size': df_font.get('font_size',22)})
        # & weight, stretch, variant, style
        # plt.rc('text',usetex='False')
        # plt.rcParams['mathtext.default'] = True
        if fileformat == "svg":
            plt.rcParams.update({"savefig.format":"svg"})

        # : class init :
        Legend  = legend(dataframe.get('legend_title',""))          # § class §

        Graphics = plotter_graphics(ax, Legend, frame.get('algorithm',"cubic"))       # plot_hull.py   → legend()  # § class §

        Sorted_data = data_handling(Graphics, dataframe, frame, language)   # plot_utilities.py # § class §

        Marker = marker(frame.get('annotations',[]), dataframe['material_colors'], Sorted_data.absolute.quantities, Sorted_data.relative.quantities, ax)   # plot_acessories.py # § class §


        # : import data :
        data = import_data(dataframe, frame, Sorted_data)
        if len(data) == 0:
            raise ValueError("No Vailid Data imported")


        # : Data plotting :
        DATA, _ = Sorted_data.plot(data)

        if not len(DATA):
            raise ValueError("No Data plotted. Please check the config.json and your data source (Excel/Teable)")
        # print(DATA)

        # : plot from config :
        Plot_size = plot_size(frame, DATA, Marker, image_ratio) # § class §
                    

        if frame.get('legend_flag',True):
            Graphics.legend.create_legend(
                language = language,
                font_color = font_color,
                above = frame.get("legend_above",False)
            )

        try:
            if len(frame.get('colored_areas',{})) > 0:
                draw_colored_areas(
                    frame['colored_areas'],
                    Sorted_data,
                    Marker,
                    Plot_size,
                    ax = ax
                )
        except:
            cprint("❗ERROR drawing colored areas. Check config.json! continuing...","red")


        try:
            draw_guideline(
                    frame.get('guidelines',{}),
                    x_min = Plot_size.x.low  / 2,
                    x_max = Plot_size.x.high * 2,
                    y_min = Plot_size.y.low  / 2,
                    y_max = Plot_size.y.high * 2,
                    font_color=font_color,
                    Marker = Marker,
                    ax = ax,
                    )
        except:
            cprint("❗ERROR drawing guidelines. Check config.json! continuing...","red")


        Marker.create_annotations(Plot_size)
        # Graphics.legend.format_label_pos(Plot_size)

        # : Figure manipulation :
        # ~ set axes limits 
        ax.set(xlim=[Plot_size.x.low, Plot_size.x.high], ylim=[Plot_size.y.low, Plot_size.y.high])        

        # ~ toggle log in plot 
        if frame.get('log_x_flag',False):
            ax.set_xscale('log')
        if frame.get('log_y_flag',False):
            ax.set_yscale('log')
        
        # ~ set x- and y-labels 
        ax.set_xlabel(axe_label(Sorted_data, 0), color=font_color, fontsize=18, labelpad=10)
        ax.set_ylabel(axe_label(Sorted_data, 1), color=font_color, fontsize=18, labelpad=5 )


        # ~ add grid lines 
        ax.grid(
                which = 'major',
                axis = 'both',
                linestyle = '-.',
            )
        # .plt.tight_layout(pad=2.5)

        # ~ general info 
        cprint(f"skipped a total of {Sorted_data.point_count['skipped']} Datapoints due to missing entries.  {Sorted_data.point_count['plotted']} were plotted.","green")

        # : export :
        if not interactive: 
            return fig
        else:
            if frame.get('export_file_name',None) == None:
                frame_title = title(frame.get('title',""), language)
                plt.title(frame_title, loc='center', size=40, pad=15)
                # fig.canvas.manager.set_window_title(figurename(frame, dataframe_index, frame_index))
                watermark(fig, alpha=0.5, pos=[0.72, 0.13], size=.13)       # & add copyright text

                # + event handling +
                handler.append(pick_event_handing(fig, ax, Graphics))
                # +                +

                plt.show(block=False)
                cprint(f"⇒ plot displayed \n","green")
                plt.pause(.3)

            else:
                os.makedirs(os.path.dirname(os.path.join('export',frame['export_file_name'])), exist_ok=True)       # mkdir
                plt.savefig(os.path.join('export', frame['export_file_name']), dpi=resolution/10, transparent=True) # save    # & export = true  → save at /dataframe x/frame y   or   dataframename/framename
                cprint(f"⇒ plot saved as ./export/{frame['export_file_name']} \n","green")
                plt.close()

        # mpl_fig.update()


if __name__ == '__main__':
    print(f"\n\n{colored(' starting Ashby-Plot Generator                     Ⓒ afffe18 @ RPS (ASL) 2025 ', on_color='on_blue')}")

    config = import_json(CONFIG_NAME) # + input config +
    create_dataframes  = config.get('create_all_dataframes', True)

    for dataframe_index, dataframe in enumerate(config.get('dataframes',[])):
        if create_dataframes == True or dataframe_index +1 in create_dataframes:
            cprint(f"\n::::::::::::::::::::::::::::::::::::  loading dataframe {dataframe_index + 1} of {len(config['dataframes'])} {dataframe.get('name', '')} ::::::::::::::::::::::::::::::::::::","blue", ["bold"])
            main(dataframe, True)
            
    cprint(f" all selected plots displayed or saved ",color="white",on_color="on_green")
    plt.show()
