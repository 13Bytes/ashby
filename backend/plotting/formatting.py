from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib import patches
from PIL import Image
import numpy as np


BACKEND_DIR = Path(__file__).resolve().parent.parent


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
                

    def create_legend(self, language, font_color, above):
        legend_title = title(self.legend_title, language)     

        if above:
            self.legend = plt.legend(        
                handles=self.handles,
                bbox_to_anchor = (0, 1.02, 1, 0.2),
                loc  = 'lower left',
                mode = 'expand',
                borderaxespad = 0,
                fontsize = 15,
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
                fontsize = 15,
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

def title(title, language):
    if isinstance(title, dict):
        title = title.get(language, "")
    elif not isinstance(title, str):
        title = ""
    return title



def axe_label(sorted_data, axe):
    if sorted_data.relative.labels[axe] == None:
        label = f"{sorted_data.absolute.labels[axe]}"
    else:
        label = f"{sorted_data.absolute.labels[axe]}  / {sorted_data.relative.labels[axe]}"
    return label


def watermark(fig, alpha, pos, size):
    logo = BACKEND_DIR / 'media' / 'watermark.png'

    # change alpha value
    img = Image.open(logo).convert("RGBA")
    r, g, b, a = img.split()
    a = a.point(lambda x: int(x * alpha))
    img = Image.merge("RGBA", (r, g, b, a))
    img_array = np.array(img)

    logo_ax = fig.add_axes([pos[0], pos[1], size, size], anchor='SE', zorder=101, )
    logo_ax.imshow(img_array)
    logo_ax.axis('off')

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
        self.margin         = frame.get("automatic_Display_Area_margin",0.12)
        self.DATA           = DATA                                                                      
        self.x = dimension(self, 0, marker, frame.get('log_x_flag',False), frame.get("x_lim",None), image_ratio**(-0.7)) # § class § 
        self.y = dimension(self, 1, marker, frame.get('log_y_flag',False), frame.get("y_lim",None), 1                  ) # § class §

class dimension():
    def __init__(self, head, dim, marker, log_flag, limit, shrink):
        self.log_flag = log_flag
        if limit == None:
            self.plot_padding(float(np.nanmin(head.DATA[:,dim])), float(np.nanmax(head.DATA[:,dim])), head.margin, marker.limits(dim), shrink)
        else:
            self.plot_padding(limit[0], limit[1], 0, marker.limits(dim), shrink)

        
    def plot_padding(self, min, max, margin, marker, shrink):
        low  = np.nanmin([marker[0], min])
        high = np.nanmax([marker[1], max])
        # & take hull splines into account

        if self.log_flag:
            low_log  = np.log10(low )
            high_log = np.log10(high)
            margin = (high_log - low_log) * margin * shrink    # & e^()
            self.low  = 10 ** (low_log  - margin)
            self.high = 10 ** (high_log + margin)
            self.space = (np.log10(self.high) - np.log10(self.low)) / 100
        else:
            margin = (high - low) * margin * shrink
            self.low  = low  - margin
            self.high = high + margin
            self.space = (self.high - self.low) /100
    
    
    def offset(self, pos, diff):
        if self.log_flag:
            return 10**(np.log10(pos) + self.space * diff)
        else:
            return pos + self.space * diff

        
