"""
IBVAP Phase 5 Rule Engine
Coordinates spatial & temporal evaluation of tracked targets against declarative security rules.
Maintains transient per-track state, candidate/verified transitions, deduplication, and telemetry.
"""

import json
import logging
import os
import time
from typing import Dict, Any, List, Optional, Tuple, Set
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

logger = logging.getLogger("IBVAP-RuleEngine")

EVALUATOR_MAP = {
    "ZONE_ENTRY": ZoneEntryEvaluator,
    "sterile_zone_breach": ZoneEntryEvaluator,
    "ZONE_EXIT": ZoneExitEvaluator,
    "DWELL": DwellEvaluator,
    "corridor_loitering": DwellEvaluator,
    "LINE_CROSSING": LineCrossingEvaluator,
    "WRONG_DIRECTION": WrongDirectionEvaluator,
    "REPEATED_CROSSING": RepeatedCrossingEvaluator,
}

class RuleEngine:
    """
    Central Rule Engine for IBVAP.
    Evaluates tracks against virtual zones and tripwires to generate verified security events.
    """
    def __init__(
        self,
        rules_path: Optional[str] = "config/rules/demo_rules.json",
        zones_path: Optional[str] = "config/zones/demo_zones.json",
        lines_path: Optional[str] = "config/zones/demo_lines.json",
    ):
        self.rules_path = rules_path
        self.zones_path = zones_path
        self.lines_path = lines_path

        self.zones: Dict[str, Dict[str, Any]] = {}
        self.lines: Dict[str, Dict[str, Any]] = {}
        self.rules: Dict[str, Dict[str, Any]] = {}
        self.evaluators: Dict[str, List[BaseEvaluator]] = {}  # cameraId -> list of evaluators

        # Per-camera, per-track state: self.track_states[cameraId][trackId][ruleId] -> TrackRuleState
        self.track_states: Dict[str, Dict[int, Dict[str, TrackRuleState]]] = {}
        
        # Telemetry metrics
        self.total_verified_events: int = 0
        self.total_evaluations: int = 0

        self.load_configurations()

    def load_configurations(self) -> None:
        """Loads and parses zones, lines, and rules configuration files."""
        # 1. Load Zones
        if self.zones_path and os.path.exists(self.zones_path):
            try:
                with open(self.zones_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    zone_list = data.get("zones", [])
                    for z in zone_list:
                        self.zones[z["id"]] = z
                logger.info(f"Loaded {len(self.zones)} virtual zones from {self.zones_path}")
            except Exception as e:
                logger.error(f"Failed to load zones from {self.zones_path}: {e}")

        # 2. Load Lines
        if self.lines_path and os.path.exists(self.lines_path):
            try:
                with open(self.lines_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    line_list = data.get("lines", [])
                    for line in line_list:
                        self.lines[line["id"]] = line
                logger.info(f"Loaded {len(self.lines)} virtual tripwires from {self.lines_path}")
            except Exception as e:
                logger.error(f"Failed to load lines from {self.lines_path}: {e}")

        # 3. Load Rules & Instantiate Evaluators
        if self.rules_path and os.path.exists(self.rules_path):
            try:
                with open(self.rules_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    rule_list = data.get("rules", [])
                    for r in rule_list:
                        self.register_rule(r)
                logger.info(f"Loaded {len(self.rules)} rules across {len(self.evaluators)} cameras")
            except Exception as e:
                logger.error(f"Failed to load rules from {self.rules_path}: {e}")

    def register_rule(self, rule: Dict[str, Any]) -> None:
        """Instantiates and registers an evaluator for a declarative rule."""
        rule_id = rule.get("id")
        if not rule_id:
            logger.warning("Skipping rule with missing ID")
            return

        camera_id = rule.get("cameraId", "").upper()
        rule_type = rule.get("type", "")

        evaluator_cls = EVALUATOR_MAP.get(rule_type)
        if not evaluator_cls:
            logger.warning(f"Unknown rule type '{rule_type}' for rule {rule_id}. Skipping.")
            return

        evaluator = evaluator_cls(rule)
        self.rules[rule_id] = rule

        if camera_id not in self.evaluators:
            self.evaluators[camera_id] = []
        self.evaluators[camera_id].append(evaluator)

    def evaluate(
        self,
        camera_id: str,
        tracks: List[Dict[str, Any]],
        video_timestamp: float,
        frame_idx: int
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
        """
        Main evaluation entry point.
        Evaluates active tracks for a camera against all configured rules.
        
        Returns:
            (verified_events, candidate_events, telemetry)
        """
        start_time = time.perf_counter()
        norm_cam_id = camera_id.upper()
        evaluators = self.evaluators.get(norm_cam_id, [])

        if norm_cam_id not in self.track_states:
            self.track_states[norm_cam_id] = {}

        camera_states = self.track_states[norm_cam_id]
        active_track_ids: Set[int] = {t.get("trackId") for t in tracks if "trackId" in t}

        # 1. Clean up stale track states when tracks expire / disappear
        stale_track_ids = [tid for tid in camera_states.keys() if tid not in active_track_ids]
        for tid in stale_track_ids:
            del camera_states[tid]

        verified_events: List[Dict[str, Any]] = []
        candidate_events: List[Dict[str, Any]] = []

        context = {
            "zones": self.zones,
            "lines": self.lines,
            "rules": self.rules,
        }

        # 2. Evaluate each active track against enabled evaluators
        for track in tracks:
            track_id = track.get("trackId")
            if track_id is None:
                continue

            if track_id not in camera_states:
                camera_states[track_id] = {}

            track_rule_dict = camera_states[track_id]

            for evaluator in evaluators:
                if not evaluator.enabled:
                    continue

                rule_id = evaluator.rule_id
                if rule_id not in track_rule_dict:
                    track_rule_dict[rule_id] = TrackRuleState(rule_id, track_id)

                state = track_rule_dict[rule_id]

                try:
                    v_evt, c_evt = evaluator.evaluate(
                        track, state, context, video_timestamp, frame_idx
                    )
                    if v_evt:
                        verified_events.append(v_evt)
                        self.total_verified_events += 1
                    if c_evt:
                        candidate_events.append(c_evt)
                except Exception as e:
                    logger.error(f"Error evaluating rule {rule_id} on track {track_id} in {camera_id}: {e}")

        eval_latency_ms = round((time.perf_counter() - start_time) * 1000.0, 3)
        self.total_evaluations += 1

        active_rule_states_count = sum(len(states) for states in camera_states.values())
        enabled_rules_count = sum(1 for e in evaluators if e.enabled)

        telemetry = {
            "enabledRulesCount": enabled_rules_count,
            "activeRuleStatesCount": active_rule_states_count,
            "tracksEvaluatedCount": len(tracks),
            "candidateEventsCount": len(candidate_events),
            "verifiedEventsCount": len(verified_events),
            "evaluationLatencyMs": eval_latency_ms,
        }

        return verified_events, candidate_events, telemetry

    def reset_camera(self, camera_id: str) -> None:
        """Resets all transient rule evaluation states for a camera (e.g. video loop or restart)."""
        norm_cam_id = camera_id.upper()
        if norm_cam_id in self.track_states:
            self.track_states[norm_cam_id].clear()
            logger.info(f"Reset all rule evaluation state for camera {camera_id}")

    def reset_all(self) -> None:
        """Resets all rule states across all cameras."""
        self.track_states.clear()
        logger.info("Reset rule evaluation state for all cameras")

    def toggle_rule(self, rule_id: str, enabled: bool) -> bool:
        """Enables or disables a rule at runtime."""
        if rule_id in self.rules:
            self.rules[rule_id]["enabled"] = enabled
            for cam_evals in self.evaluators.values():
                for ev in cam_evals:
                    if ev.rule_id == rule_id:
                        ev.enabled = enabled
            logger.info(f"Rule {rule_id} enabled status set to: {enabled}")
            return True
        return False

    def get_camera_rules(self, camera_id: str) -> List[Dict[str, Any]]:
        """Returns the list of declarative rules configured for a camera."""
        norm_cam_id = camera_id.upper()
        return [r for r in self.rules.values() if r.get("cameraId", "").upper() == norm_cam_id]

    def get_camera_zones(self, camera_id: str) -> List[Dict[str, Any]]:
        """Returns the virtual zones configured for a camera."""
        norm_cam_id = camera_id.upper()
        return [z for z in self.zones.values() if z.get("cameraId", "").upper() == norm_cam_id]

    def get_camera_lines(self, camera_id: str) -> List[Dict[str, Any]]:
        """Returns the virtual lines configured for a camera."""
        norm_cam_id = camera_id.upper()
        return [line for line in self.lines.values() if line.get("cameraId", "").upper() == norm_cam_id]
