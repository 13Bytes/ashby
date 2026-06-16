import os
import matplotlib.pyplot as plt
from matplotlib import patches
from PIL import Image
import numpy as np
from datetime import datetime


class format_storage():
    def __init__(self, material_colors:dict|None, language:str="en"):
        self.language = language
        if material_colors != None:
            self.material_colors = material_colors
        else:
            self.material_colors= {"default":"#333333"}
        self.hex_characters = [0,1,2,3,4,5,6,7,8,9,'a','b','c','d','e','f','A','B','C','D','E','F']
    
    def get_color(self, color:str) -> str:
        '''retirves the corresponding color mapped in material colors if set. otherwise returns input string'''
        if isinstance(color, str):
            if color in self.material_colors:
                return self.material_colors[color] 
            # elif color[0] == "#" and len(color) in [4,5,7,9] and all(char in hex_characters for char in color):   # ≙ re.search(r'^#(?:[0-9a-fA-F]{3}){1,2}$', color): # hex color code
            return color
            # else:
            #     return self.material_colors['default']
        else:
            return self.material_colors['default']
            

    def language_text(self, label:dict|str,) -> str:
        '''retrieves the label in the correct language'''
        if isinstance(label, dict):
            label = label.get(self.language, False)
            if label == False:
                label = next(iter(mydict.values()))
        elif not isinstance(label, str):
            label = ""
        return label





class legend():
    def __init__(self, legend_title):   
        self.legend_title = legend_title    
        self.handles = []
        self.map = {}

    def append_category(self, item, color):
        patch = patches.Patch(
                color   = color,
                label   = item,
            )
        self.handles.append(patch)
        self.map[item] = [patch]

    def append_content(self, category, item):
        if category != 'default':
            self.map[category].append(item)

    # def format_label_pos(self, Plot_size):
    #     for category in self.map.values():
    #         for item in category[1:]:
    #             if item.label_pos[1] != None:
    #                 item.label_pos[1] += Plot_size.x.space
    #                 print(item.label_pos[1])
                

    def create_legend(self, Format_Storage, font_color, font_size, title_size, above):
        legend_title = Format_Storage.language_text(self.legend_title)     

        if above:
            self.legend = plt.legend(        
                handles=self.handles,
                bbox_to_anchor = (0, 1.02, 1, 0.2),
                loc  = 'lower left',
                mode = 'expand',
                borderaxespad = 0,
                fontsize = font_size,
                title_fontsize = title_size,
                labelcolor = font_color,
                facecolor = 'none',
                edgecolor = 'none',
                ncol = 5
            )
        elif not above:
            self.legend = plt.legend(
                handles=self.handles,
                bbox_to_anchor = (1, 0, 1, 1),
                title= legend_title,
                loc  = 'center left',
                labelspacing = 1.05,
                mode = 'expand',
                fontsize = font_size,
                title_fontsize = title_size,
                alignment = 'left',
                labelcolor = font_color,
                facecolor = 'none',
                edgecolor = 'none',
                ncols = np.ceil(len(self.handles)/16),  # & test
                # draggable = True
            )


        for entry in self.legend.legend_handles: # edit copy
            entry.set_picker(True)

        plt.setp(self.legend.get_title(), color=font_color)  # legend title color



def axe_label(sorted_data, axe):
    if sorted_data.relative.labels[axe] == None:
        label = f"{sorted_data.absolute.labels[axe]}"
    else:
        label = f"{sorted_data.absolute.labels[axe]}  / {sorted_data.relative.labels[axe]}"
    return label


def watermark(fig:plt.subplot, file:str|bool, alpha:float, pos:[float, float], size:float) -> None:
    if file == True:
        file = 'watermark.png'
    if not isinstance(file, str): return

    logo =  os.path.join(
            os.getcwd(),
            'media',
            file
        )
    # change alpha value
    img = Image.open(logo).convert("RGBA")
    r, g, b, a = img.split()
    a = a.point(lambda x: int(x * alpha))
    img = Image.merge("RGBA", (r, g, b, a))
    img_array = np.array(img)

    logo_ax = fig.add_axes([pos[0], pos[1], size, size], anchor='SE', zorder=101, )
    logo_ax.imshow(img_array)
    logo_ax.axis('off')


def copyright(ax:plt.subplot , text:str|bool) -> None:
    if not isinstance(text, str):
        text = f"(C) Copyright RePoySat @ ASL ({datetime.today().year}) no disclosure without permission of a team member"

    ax.text(
        x=222,          # & calculate correct variable position and move legend
        y=5,
        s=text,
        fontsize = 10,
        rotation = 90,
        rotation_mode = 'anchor',
        transform_rotates_text = True
    )



def figurename(frame, dateframe_index, frame_index):
    frame_name  = frame.get('name', None)
    export_name = frame.get('export_file_name', None)
    if frame_name != None:
        return frame_name
    if export_name != None:
        return export_name
    else:
        return f"Figure {dateframe_index+1}.{frame_index+1}"


class plot_size():
    def __init__(self, frame, DATA, marker, image_ratio):
        margin       = self.margin(frame.get("automatic_Display_Area_margin",0.12))
        self.DATA    = DATA                                                                      
        self.x = dimension(DATA, 0, marker, frame.get('log_x_flag',False), frame.get("x_lim",None), margin['left'  ],margin['right'], image_ratio**(-0.7)) # § class §
        self.y = dimension(DATA, 1, marker, frame.get('log_y_flag',False), frame.get("y_lim",None), margin['bottom'],margin['top'  ], 1                  ) # § class §
    
    def margin(self, m:float|dict) -> [float]:
        keys = ["left","right","top","bottom"]
        margin = {key:0 for key in keys}
        if type(m) == dict:
            for key in keys:
                margin[key] = m.get(key, 0.12)
        else:
            for key in keys:
                margin[key] = m
        return margin

class dimension():
    def __init__(self, DATA, dim, marker, log_flag, limit, margin_1, margin_2, shrink):
        self.log_flag = log_flag
        if limit == None:
            self.plot_padding(float(np.nanmin(DATA[:,dim])), float(np.nanmax(DATA[:,dim])), margin_1, margin_2, marker.limits(dim), shrink)
        else:
            self.plot_padding(limit[0], limit[1], 0, marker.limits(dim), shrink)

        
    def plot_padding(self, min, max, margin_1, margin_2, marker, shrink):
        low  = np.nanmin([marker[0], min])
        high = np.nanmax([marker[1], max])
        # & take hull splines into account

        if self.log_flag:
            low_log  = np.log10(low )
            high_log = np.log10(high)
            self.low  = 10 ** (low_log  - margin_1 * (high_log - low_log) * shrink)
            self.high = 10 ** (high_log + margin_2 * (high_log - low_log) * shrink)
            self.space = (np.log10(self.high) - np.log10(self.low)) / 100
        else:
            self.low  = low    -   margin_1 * (high - low) * shrink
            self.high = high   +   margin_2 * (high - low) * shrink
            self.space = (self.high - self.low) /100
    
    
    def offset(self, pos, diff) -> float:   # for relative annotation placement
        if self.log_flag:
            return 10**(np.log10(pos) + self.space * diff)
        else:
            return pos + self.space * diff

        