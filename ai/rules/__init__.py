"""
IBVAP Phase 5 Rule Engine Package
Exports RuleEngine, geometry helpers, and modular evaluators.
"""

from geometry import get_bottom_center_anchor, point_in_polygon, line_side, segments_intersect
from evaluators import (
    BaseEvaluator,
    TrackRuleState,
    ZoneEntryEvaluator,
    ZoneExitEvaluator,
    DwellEvaluator,
    LineCrossingEvaluator,
    WrongDirectionEvaluator,
    RepeatedCrossingEvaluator,
)
from engine import RuleEngine

__all__ = [
    "RuleEngine",
    "get_bottom_center_anchor",
    "point_in_polygon",
    "line_side",
    "segments_intersect",
    "BaseEvaluator",
    "TrackRuleState",
    "ZoneEntryEvaluator",
    "ZoneExitEvaluator",
    "DwellEvaluator",
    "LineCrossingEvaluator",
    "WrongDirectionEvaluator",
    "RepeatedCrossingEvaluator",
]
