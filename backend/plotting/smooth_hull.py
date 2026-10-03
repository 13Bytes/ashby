'''Smooth hulls: a rounded, smoothed convex hull with a margin around every point and no corners.

Works in screen-proportional units (the axes' height is 1), so a hull looks round on the plot whatever
the axis scales (linear or log), the display area or the image's aspect ratio are.'''
import numpy as np
import shapely
from scipy.ndimage import gaussian_filter1d
from shapely.geometry import MultiPoint, Polygon

BASE_MARGIN     = 0.002     # smallest margin around the points: also makes a tiny group a visible bubble
RELATIVE_MARGIN = 0.01      # extra margin per unit of the hull's size (square root of its area)
SMOOTHING       = 0.06      # Gaussian smoothing along the outline, as a share of its length
STEP            = 0.002     # spacing of the outline's points


def _resample(ring:np.ndarray, step:float) -> np.ndarray:
    '''closed outline (first point not repeated) at equal distances along it'''
    closed = np.vstack([ring, ring[:1]])
    along = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(closed, axis=0).T))])
    n = max(int(np.ceil(along[-1] / step)), 24)
    at = np.linspace(0, along[-1], n, endpoint=False)
    return np.column_stack([np.interp(at, along, closed[:, 0]), np.interp(at, along, closed[:, 1])])


def _exterior(shape) -> np.ndarray:
    if shape.geom_type == 'MultiPolygon':
        shape = max(shape.geoms, key=lambda part: part.area)
    return np.asarray(shape.exterior.coords)[:-1]


def smooth_hull(points:np.ndarray) -> np.ndarray:
    '''outline around `points` ([n, x/y], screen-proportional units) as [m, x/y], first point not repeated'''
    points = np.unique(np.asarray(points, dtype=float), axis=0)
    convex = MultiPoint(points).convex_hull
    size = np.sqrt(convex.area) if convex.area > 0 else convex.length / 3      # a line or a single point has no area
    margin = BASE_MARGIN + RELATIVE_MARGIN * size

    rounded = convex.buffer(margin, quad_segs=32)
    ring = _smooth(_exterior(rounded), SMOOTHING * rounded.length)

    # Push out evenly until every point keeps at least half of its margin.
    need = BASE_MARGIN + 0.5 * (margin - BASE_MARGIN)
    outline = _valid(Polygon(ring))
    distance = shapely.distance(outline.exterior, shapely.points(points))
    inside = shapely.contains_xy(outline, points[:, 0], points[:, 1])
    short = float(np.max(np.where(inside, need - distance, need + distance)))
    if short > 0:
        ring = _resample(_exterior(outline.buffer(short * 1.05, quad_segs=32)), STEP)
    return ring


def _smooth(ring:np.ndarray, sigma_length:float) -> np.ndarray:
    '''Gaussian smoothing along the outline (sigma as a length)'''
    dense = _resample(ring, STEP)
    sigma = max(sigma_length / STEP, 1.0)
    return np.column_stack([gaussian_filter1d(dense[:, i], sigma, mode='wrap') for i in range(2)])


def _valid(polygon:Polygon):
    return polygon if polygon.is_valid else polygon.buffer(0)


def min_radius_of_curvature(ring:np.ndarray, step:float=STEP) -> float:
    '''smallest radius of curvature along a closed outline (a corner has about 0)'''
    dense = _resample(ring, step)
    edges = np.diff(np.vstack([dense, dense[:1]]), axis=0)
    heading = np.arctan2(edges[:, 1], edges[:, 0])
    turn = np.abs((np.roll(heading, -1) - heading + np.pi) % (2 * np.pi) - np.pi)
    length = np.hypot(edges[:, 0], edges[:, 1])
    with np.errstate(divide='ignore'):
        return float(np.min((length + np.roll(length, -1)) / 2 / turn))
