import matplotlib.pyplot as plt 
from matplotlib import patches
from matplotlib.widgets import Button


class pick_event_handing:
    def __init__(self, fig, ax, graphics):
        self.fig = fig
        self.ax  = ax
        self.graphics = graphics
        self.hulls          = graphics.hulls
        self.map_legend     = graphics.legend.map       # dict(zip(self.entries, handles))
        self.point_label    = point_label(ax)
        self.find           = find(graphics.points, graphics.legend.handles)

        self.fig.canvas.mpl_connect('pick_event', self.handler)
        print("Event handler setup successful")


    def handler(self, event):
        entity = event.artist
        point = self.find.point(entity)
        patch = self.find.legend_patch(entity)
        
        if point != None:
            self.point_label.change_point(point)
        elif patch != None:
            self.toggle_visibility(patch)
        # & if marker

        self.fig.canvas.draw_idle()
        


    # : visibility toggling from legend :
    def toggle_visibility(self, patch):
        label = patch.get_label()
        group   = self.map_legend[label][1:]
        new_state = not group[0].visible  # bool
        for handle in self.graphics.legend.legend.legend_handles:
            if handle._label == label:
                handle.set_alpha(1 if new_state else 0.3)           

        for item in group:
            for i in range(len(item.element)):
                item.element[i].set_visible(new_state)

                if new_state == True:
                    item.element[i].set_picker(item.picker)
                else:
                    item.element[i].set_picker(item.picker_nvis)
        
            if self.point_label.last_point != None and item.element == self.point_label.last_point.element:
                self.point_label.rm_last_point()

        group[0].visible = new_state


    # : display coordinates on click :
class point_label():
    def __init__(self, ax):
        self.ax = ax
        self.last_point = None
        self.annotation = None

    def change_point(self, point):
        if self.last_point == point:
            self.rm_last_point()

        else:
            if self.annotation != None:         
                self.rm_last_point()

            # & mehrere Punkte übereinander anzeigen   (Idee: je kleiner, desto höhere Z-Ebene)
            self.annotation = self.ax.annotate(point.label, xy=point.label_pos, xycoords='data', xytext=(0,5), textcoords='offset points', ha='center', va='bottom', fontsize=12)
            point.element[0].set_alpha(1)

            self.last_point = point
    
    def rm_last_point(self):
        if self.annotation: 
                self.annotation.remove()
        self.annotation = None
        self.last_point.element[0]._alpha = self.last_point.alpha



class find():
    def __init__(self, point_list, legend_handles):
        self.point_list     = point_list
        self.legend_handles = legend_handles

    def point(self, clicked_point):
        for points in self.point_list:
            for point in points.element:
                if point == clicked_point:
                    return points
        return None

    def legend_patch(self, clicked_patch):
        if isinstance(clicked_patch, patches.Rectangle):
            for patch in self.legend_handles:
                if patch.get_label() == clicked_patch.get_label():
                    return patch
        return None