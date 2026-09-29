"""
IBVAP Phase 5 Unit Tests — Spatial Geometry & Anchors
Tests:
- Bounding Box Bottom-Center Anchor
- Point in Polygon (Inside, Outside, Vertex, Edge)
- Line Side Calculation (Side A, Side B, Collinear)
- Line Segment Intersection
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../rules")))

from geometry import get_bottom_center_anchor, point_in_polygon, line_side, segments_intersect

class TestGeometry(unittest.TestCase):
    def test_bottom_center_anchor(self):
        """Test calculation of ground anchor point from normalized bounding box."""
        # Standard box: x=0.2, y=0.3, w=0.1, h=0.4
        # bottom center should be x = 0.2 + 0.05 = 0.25, y = 0.3 + 0.4 = 0.70
        bbox = {"x": 0.2, "y": 0.3, "width": 0.1, "height": 0.4}
        anchor = get_bottom_center_anchor(bbox)
        self.assertAlmostEqual(anchor[0], 0.25)
        self.assertAlmostEqual(anchor[1], 0.70)

        # Clamping at boundaries
        bbox_edge = {"x": 0.95, "y": 0.90, "width": 0.2, "height": 0.3}
        anchor_edge = get_bottom_center_anchor(bbox_edge)
        self.assertAlmostEqual(anchor_edge[0], 1.0)
        self.assertAlmostEqual(anchor_edge[1], 1.0)

    def test_point_in_polygon(self):
        """Test point-in-polygon ray casting with boundary points."""
        polygon = [
            [0.2, 0.2],
            [0.8, 0.2],
            [0.8, 0.8],
            [0.2, 0.8],
        ]

        # Strictly inside
        self.assertTrue(point_in_polygon((0.5, 0.5), polygon))
        self.assertTrue(point_in_polygon((0.3, 0.3), polygon))

        # Strictly outside
        self.assertFalse(point_in_polygon((0.1, 0.5), polygon))
        self.assertFalse(point_in_polygon((0.9, 0.5), polygon))
        self.assertFalse(point_in_polygon((0.5, 0.1), polygon))
        self.assertFalse(point_in_polygon((0.5, 0.9), polygon))

        # On edge and vertex
        self.assertTrue(point_in_polygon((0.2, 0.2), polygon))  # Vertex
        self.assertTrue(point_in_polygon((0.5, 0.2), polygon))  # Top edge
        self.assertTrue(point_in_polygon((0.8, 0.5), polygon))  # Right edge

        # Dict format points
        poly_dicts = [{"x": 0.2, "y": 0.2}, {"x": 0.8, "y": 0.2}, {"x": 0.8, "y": 0.8}, {"x": 0.2, "y": 0.8}]
        self.assertTrue(point_in_polygon((0.5, 0.5), poly_dicts))
        self.assertFalse(point_in_polygon((0.1, 0.1), poly_dicts))

    def test_line_side_calculation(self):
        """Test 2D cross-product line side test."""
        # Horizontal line from (0.0, 0.5) to (1.0, 0.5)
        # Vector points right (+x). Left side (+y, or below in screen coordinates depending on convention)
        p1 = (0.0, 0.5)
        p2 = (1.0, 0.5)

        # Point above line in screen space (y < 0.5)
        side_above = line_side(p1, p2, (0.5, 0.2))
        # Point below line in screen space (y > 0.5)
        side_below = line_side(p1, p2, (0.5, 0.8))
        # Point on the line
        side_on = line_side(p1, p2, (0.5, 0.5))

        self.assertNotEqual(side_above, side_below)
        self.assertEqual(side_on, 0.0)

    def test_segments_intersect(self):
        """Test segment-segment intersection for tripwire crossing detection."""
        # Crossing segments
        p1, q1 = (0.2, 0.2), (0.8, 0.8)
        p2, q2 = (0.2, 0.8), (0.8, 0.2)
        self.assertTrue(segments_intersect(p1, q1, p2, q2))

        # Parallel non-intersecting segments
        p3, q3 = (0.1, 0.2), (0.1, 0.8)
        p4, q4 = (0.3, 0.2), (0.3, 0.8)
        self.assertFalse(segments_intersect(p3, q3, p4, q4))

if __name__ == "__main__":
    unittest.main()
