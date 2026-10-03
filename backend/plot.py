import os
import matplotlib.pyplot as plt
from termcolor import (colored, cprint)

try:
    from .import_data import *
    from .plotting import *
    from .eventhandling import *
except ImportError:
    from import_data import *
    from plotting import *
    from eventhandling import *


CONFIG_NAME = "ashby-config-2026-08-03.json"
DARK_BACKGROUND = '#121212'     # background of dark mode plots that are not transparent
GENERIC_FONT_FAMILIES = ('serif', 'sans-serif', 'cursive', 'fantasy', 'monospace')


def _aspect_ratio(value:list|float, fallback:float=16 / 9) -> float:
    if isinstance(value, (list, tuple)) and len(value) == 2 and value[1]:
        return value[0] / value[1]
    if isinstance(value, (int, float)) and value > 0:
        return value
    return fallback



def _font_rc_params(font:dict) -> dict:
    '''matplotlib settings for a dataframe's font. The chosen font goes first in its generic family; the family's other fonts stay as fallback for systems without it (e.g. no Arial in Docker).'''
    family = font.get('font_style', "sans-serif")
    if family not in GENERIC_FONT_FAMILIES:
        family = "sans-serif"
    params = {'font.family': family}
    font_size = font.get('font_size', 22)
    if isinstance(font_size, (int, float)) and font_size > 0:
        params['font.size'] = font_size
    font_name = font.get('font', "Arial")
    if isinstance(font_name, str) and font_name.strip():
        fallback = [name for name in plt.rcParams[f'font.{family}'] if name != font_name.strip()]
        params[f'font.{family}'] = [font_name.strip(), *fallback]
    return params


def main(dataframe:dict, interactive:bool, frontend:bool=False, xlsx_file_bytes=None) -> list:
    # only while this dataframe's plots are drawn and saved, so one dataframe's font does not leak into the next render
    with plt.rc_context(_font_rc_params(dataframe.get('font', {}))):
        return _plot_frames(dataframe, interactive, frontend, xlsx_file_bytes)


def _plot_frames(dataframe:dict, interactive:bool, frontend:bool=False, xlsx_file_bytes=None) -> list:
    handler = []
    all_points = []     # clicked-point data for the frontend (figure-fraction coords), one frame's worth when frontend=True

    df_language = dataframe.get('language', "en")
    df_darkmode = dataframe.get('dark_mode', False)
    df_font     = dataframe.get('font', {})

    resolution = dataframe.get('resolution', None)          # & deprecated 
    if resolution in [None,"svg"]:                          #
        fileformat = "svg"                                  #
        resolution = 100                                    #
    else:                                                   #
        fileformat = "png"                                  #

    df_image_ratio = _aspect_ratio(dataframe.get('image_ratio'))
    
    create_frames  = dataframe.get('create_all_frames', True)

    # : FRAME                                                                               :
    for frame_index, frame in enumerate(dataframe.get('frames',[])):
        if not (create_frames == True or frame_index +1 in create_frames):
            continue

        cprint(f"\n::::::::::::::::::::::::::::  creating frame {frame_index + 1} of {len(dataframe['frames'])} {frame.get('name', '')} :::::::::::::::::::::::::::: \n", "blue")


        # : General setup :
        dark_mode = df_darkmode     # config version 6: set per dataframe only
        # [True] above, [False] right, [None] no legend. Since config version 6 per dataframe; older configs set it per frame.
        legend_above = dataframe.get('legend_above', frame.get('legend_above', False))
        if dark_mode:
            font_color = 'white'
        else:
            font_color = 'black'

        language = frame.get('language', df_language)
        image_ratio = _aspect_ratio(frame.get('image_ratio'), df_image_ratio)

        figure_size = (10*image_ratio ,10)
        fig, ax = plt.subplots(1,1, figsize=figure_size)
        if dark_mode:       # without this a non-transparent dark plot gets white text on matplotlib's white background
            fig.patch.set_facecolor(DARK_BACKGROUND)
            ax.set_facecolor(DARK_BACKGROUND)
        if legend_above is not None and frame.get('legend_flag',True) != None:     # room for the legend
            plt.subplots_adjust(left=0.09, right=0.86)
        
        ax.tick_params(colors=font_color, labelsize=df_font.get('tick_size',5))
        ax.spines[:].set_color(font_color)

        if fileformat == "svg":
            plt.rcParams.update({"savefig.format":"svg"})

        # : class init :
        Format_Storage = format_storage(dataframe.get('material_colors',None), language)         # § class §

        Legend  = legend(dataframe.get('legend_title',""))          # § class §

        Graphics = plotter_graphics(ax, Legend, frame.get('algorithm',"alpha"))       # plot_hull.py   → legend()  # § class §

        Sorted_data = data_handling(Format_Storage, Graphics, dataframe, frame)   # plot_utilities.py # § class §

        Marker = marker(frame.get('annotations',[]), Sorted_data.absolute.quantities, Sorted_data.relative.quantities, ax)   # plot_acessories.py # § class §


        # : import data :
        data = import_data(dataframe, frame, Sorted_data, xlsx_file_bytes=xlsx_file_bytes)
        if len(data) == 0:
            raise ValueError("No Vailid Data imported")


        # : Data plotting :
        DATA, _ = Sorted_data.plot(data)

        if not len(DATA):
            raise ValueError("No Data plotted. Please check the config.json and your data source (Excel/Teable)")

        # : plot from config :
        Plot_size = plot_size(frame, DATA, Marker, image_ratio) # § class §
                    

        if legend_above is not None:
            Graphics.legend.create_legend(
                Format_Storage = Format_Storage,
                font_color = font_color,
                font_size  = df_font.get('legend_label_size',15),
                title_size = df_font.get('legend_title_size',25),
                above = legend_above,
                copyright = (dataframe.get('copyright', False) != False)
            )

        try:
            if len(frame.get('colored_areas',{})) > 0:
                draw_colored_areas(
                    Format_Storage = Format_Storage,
                    Sorted_data    = Sorted_data,
                    colored_areas  = frame['colored_areas'],
                    Plot_size      = Plot_size,
                    ax = ax
                )
        except:
            cprint("ERROR drawing colored areas. Check config.json! continuing...","red")


        try:
            draw_guideline(
                    Format_Storage = Format_Storage,
                    guidelines = frame.get('guidelines',{}),
                    x_min = Plot_size.x.low  / 2,
                    x_max = Plot_size.x.high * 2,
                    y_min = Plot_size.y.low  / 2,
                    y_max = Plot_size.y.high * 2,
                    font_color = font_color,
                    ax = ax,
                )
        except:
            cprint("ERROR drawing guidelines. Check config.json! continuing...","red")


        Marker.create_annotations(Format_Storage, Plot_size)

        # : Figure manipulation :
        # ~ set axes limits 
        ax.set(xlim=[Plot_size.x.low, Plot_size.x.high], ylim=[Plot_size.y.low, Plot_size.y.high])        

        # ~ toggle log in plot 
        if frame.get('log_x_flag',False):
            ax.set_xscale('log')
        if frame.get('log_y_flag',False):
            ax.set_yscale('log')
        


        
        # ~ labels 
        plt.title(label = Format_Storage.language_text(frame.get('title',"")), color=font_color, size = df_font.get('title_size',40), pad=15, loc='left') 
        ax.set_xlabel(axe_label(Sorted_data, 0), color=font_color, fontsize=df_font.get('axis_label_size',20), labelpad=10)
        ax.set_ylabel(axe_label(Sorted_data, 1), color=font_color, fontsize=df_font.get('axis_label_size',20), labelpad=5 )

        # ~ copyright & watermark
        if dataframe.get('copyright', False) != False:          # & ❗ ⇒  ui
            copyright(ax, text=dataframe.get('copyright', True), font_color=font_color)
        if dataframe.get('watermark', False) != False:           # & ❗ ⇒  ui
            watermark(fig, dataframe.get('watermark',True), alpha=0.6, dark_mode=bool(dark_mode), pos=[0.72, 0.13], size=.13)


        # ~ add grid lines 
        ax.grid(
                which = 'major',
                axis  = 'both',
                linestyle = '-.',
            )

        # ~ general info 
        cprint(f"skipped a total of {Sorted_data.point_count['skipped']} Datapoints due to missing entries.  {Sorted_data.point_count['plotted']} were plotted.","green")

        # : export :
        if frame.get('export_file_name',None) == None:

            # + event handling +
            if interactive:
                handler.append(pick_event_handing(fig, ax, Graphics))
            # +                +

            plt.show(block=False)
            cprint("-> plot displayed \n","green")
            plt.pause(.3)

        else:
            # + point data for the frontend's clickable points (figure-fraction coords, y flipped to a top-left origin) +
            for point in Graphics.points:
                x, y = point.label_pos
                if x is None or y is None:
                    continue
                fx, fy = fig.transFigure.inverted().transform(ax.transData.transform((x, y)))
                if not (0 <= fx <= 1 and 0 <= fy <= 1):
                    continue
                all_points.append({
                    'x': float(fx),
                    'y': float(1 - fy),
                    'label': point.label,
                    'hierarchy': [None if category is None else str(category) for category in point.hirachie],
                    'row': getattr(point, 'row', None),
                })
            # +                +

            os.makedirs(os.path.dirname(os.path.join('export',frame['export_file_name'])), exist_ok=True)       # mkdir
            plt.savefig(os.path.join('export', frame['export_file_name']), dpi=resolution, transparent=dataframe.get('transparent', True))     # save    # & export = true  → save at /dataframe x/frame y   or   dataframename/framename       # & ❗ ⇒  ui
            cprint(f"-> plot saved as ./export/{frame['export_file_name']} \n","green")
            plt.close()


    return all_points


if __name__ == '__main__':
    print(f"\n\n{colored(' starting PolyPlot                                 Ⓒ afffe18 @ RPS (ASL) 2025 ', on_color='on_blue')}")

    config = import_json(CONFIG_NAME) # + input config +
    create_dataframes  = config.get('create_all_dataframes', True)

    for dataframe_index, dataframe in enumerate(config.get('dataframes',[])):
        if create_dataframes == True or dataframe_index +1 in create_dataframes:
            cprint(f"\n::::::::::::::::::::::::::::::::::::  loading dataframe {dataframe_index + 1} of {len(config['dataframes'])} {dataframe.get('name', '')} ::::::::::::::::::::::::::::::::::::", "blue", ["bold"])
            main(dataframe, interactive=True, frontend=False)
            
    cprint(f" all selected plots displayed or saved ",color="white",on_color="on_green")
    plt.show()
