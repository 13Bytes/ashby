import sklearn.preprocessing
import sklearn.pipeline
import scipy.spatial

from scipy.spatial import ConvexHull
from scipy.interpolate import splprep, splev
import alphashape
from shapely.geometry import Point

import numpy as np
import matplotlib.pyplot as plt
from matplotlib import patches
import matplotlib.colors as colors

from .formatting import legend

class plot_unit_props():
    def __init__(self, legend, element, x,y, hirachie, legend_item = None, label="", picker=False, picker_nvis=False, alpha=1):
        self.element     = element
        self.hirachie    = hirachie
        self.legend      = legend
        self.label       = label
        self.label_pos   = [x,y]
        self.picker      = picker
        self.picker_nvis = picker_nvis
        self.alpha       = alpha    
        self.visible     = True
        # print(self.hirachie)

        legend.append_content(legend_item, self)
            

class plotter_graphics():
    def __init__(self, ax, Legend, algorithm):
        self.ax = ax
        self.legend      = Legend
        self.points      = []
        self.hulls       = []
        self.algorithm   = algorithm
    
    def __str__(self):
        print(f"Hulls:  {self.hulls }")
        print(f"Points: {self.points}")
        return ""
    
    def make_label(self, hirachie, X=[None, None]):
        label = ""
        for category in hirachie:
            label += f"{category}, "

        if X == [None, None]: 
            return label

        # print(X)
        coords = ["",""]
        for dim in [0,1]:
            coords[dim] += "{0:.5g}".format(X[dim][0])
            if X[dim][1] != None and X[dim][0] != X[dim][1]:
                # print(X[1][dim])
                coords[dim] += " - {0:.5g}".format(X[dim][1])
        
        return f" {label}\n ( {coords[0]} I {coords[1]} ) " 
    

    # : plot content :
    # ~ Point 
    def plot(self, x, y, color, alpha, hirachie, legend_item):
        label = self.make_label(hirachie, [[x[0], None],[y[0], None]])
        points = self.ax.plot(
                        x,
                        y,
                        color  = color,
                        marker = 'o',
                        alpha  = alpha,
                        picker = 5,
                        zorder = 5,
                    )
        # self.legend.append_content(category, points)
        point = plot_unit_props(self.legend, points, x[0],y[0], hirachie, legend_item, label, picker=5, alpha=alpha)
        self.points.append(point)

        
    # ~ Hull 
    def draw_hull(
            self,
            X,      # [:,x/y]
            hirachie,
            legend_item,
            scale,
            plot_kwargs={}, 
        ):
        n_interpolate = 120

        for pos, entry in enumerate(X):     # replace nan with value incase of range in only one dimension
            if np.isnan(entry[0]):          
                entry[0] = X[pos-1,0]
            elif np.isnan(entry[1]):
                entry[1] = X[pos-1,1]
        
        # print(np.transpose(X))

        line = True
        Data = np.unique(X, axis=0)
        
        if len(Data) < 2:
            print("can't plot Hull, only one Point - skipping", X)
        elif len(Data) > 2:
            angle = [np.atan2(Data[0,1]-Data[1,1],  Data[0,0]-Data[1,0])]
            for pos, entry in enumerate(Data[1:]):          # checks if all entries are in one line which makes calculating a hull impossible
                angle.append(np.atan2(Data[0,1]-entry[1],  Data[0,0]-entry[0]))
                if abs(angle[0] - angle[-1]) > 0.01:
                    line = False
                    break

        if line == True:
            patch = self.draw_ellipses(
                    X,
                    hirachie,
                    legend_item,
                    scale,
                    plot_kwargs = plot_kwargs,
                )
        else:
            X_hull = self.calculate_hull(
                    X,
                    scale,
                    n_interpolate=n_interpolate,
                )

            patch = plt.fill(
                    X_hull[:,0],
                    X_hull[:,1],
                    scale,
                    **plot_kwargs,
            )
            self.hulls.append(plot_unit_props(self.legend, patch, None,None, hirachie, legend_item, alpha=plot_kwargs['alpha']))

            plot_kwargs['alpha'] = .35
            outline = plt.plot( # outline
                X_hull[:,0],
                X_hull[:,1],
                **plot_kwargs
            )
            self.hulls.append(plot_unit_props(self.legend, outline, None,None, hirachie, legend_item, alpha=plot_kwargs['alpha']))


    # ~ Ellipses 
    def draw_ellipses(    # & kacke für log Darstellung
            self,
            X,      # [:,x/y]
            hirachie,
            legend_item,
            scale,
            plot_kwargs = None,
            value_ranges = False,
        ):
        angle = np.rad2deg(np.arctan2(X[1,1]-X[0,1], X[1,0]-X[0,0]))

        center_x = (np.max(X[:,0]) + np.min(X[:,0])) / 2
        center_y = (np.max(X[:,1]) + np.min(X[:,1])) / 2
        center = [center_x, center_y]

        r_x = (np.max(X[:,0]) - np.min(X[:,0]))
        r_y = (np.max(X[:,1]) - np.min(X[:,1]))

        r_1 = np.sqrt(r_x**2 + r_y**2) * scale


        if value_ranges == True:
            ellipse = self.ax.plot(X[:,0], X[:,1], linewidth=5, **plot_kwargs)

            label = self.make_label(hirachie, [[X[0,0],X[1,0]], [X[0,1],X[1,1]]])
            self.points.append(plot_unit_props(self.legend, ellipse, center_x,center_y, hirachie, legend_item, label, picker=getattr(plot_kwargs, 'picker', False), alpha=plot_kwargs['alpha']))

        else:
            r_2 = r_1 / 11      # & scale dependant   KoTraFo nichtmöglich da Plotgrößer noch nicht feststeht 

            ellipse = patches.Ellipse(
                xy = center,
                width = r_1,
                height = r_2,
                angle = angle,
                **plot_kwargs,
            )
            self.ax.add_patch(ellipse)

            label = self.make_label(hirachie)
            self.hulls.append(plot_unit_props(self.legend, [ellipse], center_x,center_y, hirachie, legend_item, alpha=plot_kwargs['alpha']))
            # print(f"⋅⋅ {len(self.hulls) - 1} ellipses: {self.hulls[-1].element}")


    def calculate_hull(
            self,
            X, 
            scale=1.1, 
            n_interpolate=100, 
            ):

        scaler = sklearn.pipeline.make_pipeline(
            sklearn.preprocessing.FunctionTransformer(np.log),
            sklearn.preprocessing.MinMaxScaler(feature_range = (0,1)),
            sklearn.preprocessing.StandardScaler(with_std=False),
            )
        points_scaled = scaler.fit_transform(X) * scale
        
        points_scaled = points_scaled[~np.isnan(points_scaled[:, 0])]
        points_scaled = points_scaled[~np.isnan(points_scaled[:, 1])]

        hull_scaled = scipy.spatial.ConvexHull(points_scaled, incremental=True)
        hull_points_scaled = points_scaled[hull_scaled.vertices]
        
        hull_points= np.concatenate([hull_points_scaled,hull_points_scaled[:1]])

        nt = np.linspace(0, 1, n_interpolate)
        
        x, y = hull_points[:,0], hull_points[:,1]
        
        if self.algorithm == 'alpha':
            hull_polynome = alphashape.alphashape(hull_points, .02)
            coords = np.column_stack(hull_polynome.exterior.xy)
            t = np.linspace(0, 1, len(x))
            tck, _ = splprep([coords[:,0], coords[:,1]], s=0.001, per=True)
            u_fine = np.linspace(0, 1, 500)
            x2, y2 = splev(u_fine, tck)
        # elif self.algorithm == 'quadratic':
        #     t = np.zeros(x.shape)
        #     t[1:] = np.sqrt((x[1:] - x[:-1])**2 + (y[1:] - y[:-1])**2)
        #     t = np.cumsum(t)
        #     t /= t[-1]
        #     x2 = scipy.interpolate.splev(nt, scipy.interpolate.splrep(t, x, per=True, k=4))
        #     y2 = scipy.interpolate.splev(nt, scipy.interpolate.splrep(t, y, per=True, k=4))
        else: # self.algorithm == 'cubic'
            t = np.zeros(x.shape)
            t[1:] = np.sqrt((x[1:] - x[:-1])**2 + (y[1:] - y[:-1])**2)
            t = np.cumsum(t)
            t /= t[-1]
            x2 = scipy.interpolate.CubicSpline(t, x, bc_type="periodic")(nt)
            y2 = scipy.interpolate.CubicSpline(t, y, bc_type="periodic")(nt)


        X_hull = np.concatenate([x2.reshape(-1,1), y2.reshape(-1,1)], axis=1)
        
        X_hull = scaler.inverse_transform(X_hull)
        X_hull = np.exp(X_hull)
        X_hull = X_hull[~np.isnan(X_hull).any(axis=1)]
            
        return X_hull