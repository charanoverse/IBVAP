"""
IBVAP Phase 5 Geometry Utilities
Normalized coordinate spatial operations for virtual zones, tripwires, and bounding box anchors.
"""

from typing import List, Tuple, Sequence, Dict, Any, Union

def get_bottom_center_anchor(bbox: Dict[str, Any]) -> Tuple[float, float]:
    """
    Computes the bottom-center anchor point of a normalized bounding box.
    This serves as the primary ground-position reference point for spatial evaluation of persons and vehicles.
    
    Formula:
        anchor_x = x + width / 2
        anchor_y = y + height
    """
    x = float(bbox.get("x", 0.0))
    y = float(bbox.get("y", 0.0))
    w = float(bbox.get("width", 0.0))
    h = float(bbox.get("height", 0.0))
    
    anchor_x = max(0.0, min(1.0, x + w / 2.0))
    anchor_y = max(0.0, min(1.0, y + h))
    return (round(anchor_x, 5), round(anchor_y, 5))


def point_in_polygon(point: Tuple[float, float], polygon: List[Union[Sequence[float], Dict[str, float]]]) -> bool:
    """
    Ray-casting point-in-polygon algorithm with boundary inclusivity.
    Determines if a 2D point (x, y) is inside a polygon defined by normalized vertices.
    """
    if not polygon or len(polygon) < 3:
        return False
    
    px, py = point
    
    # Parse points into (x, y) tuples
    coords: List[Tuple[float, float]] = []
    for pt in polygon:
        if isinstance(pt, dict):
            coords.append((float(pt.get("x", 0.0)), float(pt.get("y", 0.0))))
        else:
            coords.append((float(pt[0]), float(pt[1])))
            
    n = len(coords)
    inside = False
    
    # Check if point is on any vertex or edge
    epsilon = 1e-6
    for i in range(n):
        x1, y1 = coords[i]
        x2, y2 = coords[(i + 1) % n]
        
        # Vertex check
        if abs(px - x1) < epsilon and abs(py - y1) < epsilon:
            return True
            
        # Point on segment check
        min_x, max_x = min(x1, x2), max(x1, x2)
        min_y, max_y = min(y1, y2), max(y1, y2)
        if min_x - epsilon <= px <= max_x + epsilon and min_y - epsilon <= py <= max_y + epsilon:
            cross = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)
            if abs(cross) < epsilon:
                return True
                
        # Ray casting
        if ((y1 > py) != (y2 > py)):
            if y2 != y1:
                x_intersect = (x2 - x1) * (py - y1) / (y2 - y1) + x1
                if px < x_intersect:
                    inside = not inside
                    
    return inside


def line_side(p1: Union[Sequence[float], Dict[str, float]], 
              p2: Union[Sequence[float], Dict[str, float]], 
              point: Tuple[float, float]) -> float:
    """
    Calculates which side of directed line segment p1 -> p2 a point lies on using 2D cross product.
    Returns:
        > 0 : Side A (Left side of vector p1 -> p2)
        < 0 : Side B (Right side of vector p1 -> p2)
        = 0 : Collinear (On the line)
    """
    if isinstance(p1, dict):
        x1, y1 = float(p1.get("x", 0.0)), float(p1.get("y", 0.0))
    else:
        x1, y1 = float(p1[0]), float(p1[1])
        
    if isinstance(p2, dict):
        x2, y2 = float(p2.get("x", 0.0)), float(p2.get("y", 0.0))
    else:
        x2, y2 = float(p2[0]), float(p2[1])
        
    px, py = point
    
    # 2D cross product: (x2 - x1)*(py - y1) - (y2 - y1)*(px - x1)
    val = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)
    
    if abs(val) < 1e-6:
        return 0.0
    return 1.0 if val > 0 else -1.0


def segments_intersect(p1: Tuple[float, float], q1: Tuple[float, float],
                       p2: Tuple[float, float], q2: Tuple[float, float]) -> bool:
    """
    Returns True if line segment p1q1 intersects segment p2q2.
    """
    def orientation(p: Tuple[float, float], q: Tuple[float, float], r: Tuple[float, float]) -> int:
        val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1])
        if abs(val) < 1e-6:
            return 0  # collinear
        return 1 if val > 0 else 2  # clock or counterclockwise

    def on_segment(p: Tuple[float, float], q: Tuple[float, float], r: Tuple[float, float]) -> bool:
        return (q[0] <= max(p[0], r[0]) + 1e-6 and q[0] >= min(p[0], r[0]) - 1e-6 and
                q[1] <= max(p[1], r[1]) + 1e-6 and q[1] >= min(p[1], r[1]) - 1e-6)

    o1 = orientation(p1, q1, p2)
    o2 = orientation(p1, q1, q2)
    o3 = orientation(p2, q2, p1)
    o4 = orientation(p2, q2, q1)

    # General case
    if o1 != o2 and o3 != o4:
        return True

    # Special Cases
    if o1 == 0 and on_segment(p1, p2, q1): return True
    if o2 == 0 and on_segment(p1, q2, q1): return True
    if o3 == 0 and on_segment(p2, p1, q2): return True
    if o4 == 0 and on_segment(p2, q1, q2): return True

    return False
