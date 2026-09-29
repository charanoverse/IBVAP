"""
IBVAP Phase 5 Modular Rule Evaluators
Stateful evaluators for spatial and temporal rule conditions:
- ZONE_ENTRY
- ZONE_EXIT
- DWELL
- LINE_CROSSING
- WRONG_DIRECTION
- REPEATED_CROSSING
"""

import time
from collections import deque
from typing import Dict, Any, List, Optional, Tuple, Set
from geometry import get_bottom_center_anchor, point_in_polygon, line_side, segments_intersect

class TrackRuleState:
    """
    Maintains transient in-memory evaluation state for a single (Track, Rule) pair.
    """
    def __init__(self, rule_id: str, track_id: int):
        self.rule_id = rule_id
        self.track_id = track_id
        
        # Zone tracking state
        self.is_inside_zone: bool = False
        self.zone_entry_timestamp: Optional[float] = None
        self.zone_entry_frame: Optional[int] = None
        self.frames_inside: int = 0
        self.frames_outside: int = 0
        
        # Line crossing state
        self.last_line_side: Optional[float] = None  # +1.0 (Side A), -1.0 (Side B), 0.0 (On line)
        self.last_anchor: Optional[Tuple[float, float]] = None
        self.crossing_timestamps: deque = deque(maxlen=20)  # Rolling crossings for repeated crossing rule
        
        # Candidate / Verification state
        self.is_candidate: bool = False
        self.candidate_start_time: Optional[float] = None
        self.candidate_start_frame: Optional[int] = None
        self.candidate_metadata: Dict[str, Any] = {}
        
        # Event deduplication & cooldown
        self.has_emitted_verified: bool = False
        self.last_verified_timestamp: Optional[float] = None
        self.last_verified_video_timestamp: Optional[float] = None


class BaseEvaluator:
    """
    Base class for declarative rule evaluators.
    """
    def __init__(self, rule: Dict[str, Any]):
        self.rule = rule
        self.rule_id = rule.get("id", "RULE-UNKNOWN")
        self.rule_name = rule.get("name", self.rule_id)
        self.camera_id = rule.get("cameraId", "")
        self.rule_type = rule.get("type", "")
        self.classes: Set[str] = set(rule.get("classes") or rule.get("targetClasses") or ["person", "car", "truck", "bus", "motorcycle"])
        self.enabled: bool = rule.get("enabled", True)
        
        # Verification requirements
        verification = rule.get("verification", {})
        self.min_frames = int(verification.get("minimumFrames", 2))
        self.min_seconds = float(verification.get("minimumSeconds", 0.0))
        
        # Conditions & Cooldown
        conditions = rule.get("conditions", {})
        self.cooldown_seconds = float(rule.get("cooldownSeconds", conditions.get("cooldownSeconds", 5.0)))

    def is_class_allowed(self, class_name: str) -> bool:
        if not self.classes:
            return True
        return class_name.lower() in self.classes

    def check_cooldown(self, state: TrackRuleState, video_timestamp: float) -> bool:
        if state.last_verified_video_timestamp is None:
            return True
        return (video_timestamp - state.last_verified_video_timestamp) >= self.cooldown_seconds

    def evaluate(
        self,
        track: Dict[str, Any],
        state: TrackRuleState,
        context: Dict[str, Any],
        video_timestamp: float,
        frame_idx: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """
        Evaluates a track against the rule.
        Returns: (verified_event, candidate_event)
        """
        raise NotImplementedError


class ZoneEntryEvaluator(BaseEvaluator):
    """
    Evaluates entry into a polygon zone using the bottom-center anchor.
    """
    def __init__(self, rule: Dict[str, Any]):
        super().__init__(rule)
        self.zone_id = rule.get("zoneId", "")

    def evaluate(
        self,
        track: Dict[str, Any],
        state: TrackRuleState,
        context: Dict[str, Any],
        video_timestamp: float,
        frame_idx: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        if not self.enabled or not self.is_class_allowed(track.get("className", "")):
            return None, None

        zones = context.get("zones", {})
        zone = zones.get(self.zone_id)
        if not zone or not zone.get("polygon"):
            return None, None

        anchor = get_bottom_center_anchor(track.get("boundingBox", {}))
        inside = point_in_polygon(anchor, zone["polygon"])
        zone_name = zone.get("name", self.zone_id)
        display_id = track.get("displayId", f"T{track.get('trackId', 0):03d}")
        class_name = track.get("className", "object")

        verified_event = None
        candidate_event = None

        if inside:
            state.frames_inside += 1
            state.frames_outside = 0

            if not state.is_inside_zone:
                # Initial candidate entry
                if not state.is_candidate:
                    state.is_candidate = True
                    state.candidate_start_time = video_timestamp
                    state.candidate_start_frame = frame_idx

                elapsed_sec = max(0.0, video_timestamp - (state.candidate_start_time or video_timestamp))
                frames_count = state.frames_inside

                # Check verification criteria
                meets_frames = frames_count >= self.min_frames
                meets_time = elapsed_sec >= self.min_seconds

                if meets_frames and meets_time and not state.has_emitted_verified and self.check_cooldown(state, video_timestamp):
                    state.is_inside_zone = True
                    state.has_emitted_verified = True
                    state.last_verified_video_timestamp = video_timestamp
                    state.zone_entry_timestamp = state.candidate_start_time
                    state.is_candidate = False

                    verified_event = {
                        "id": f"EVT-{self.camera_id}-{int(video_timestamp*100):05d}-{track.get('trackId')}-ENTRY",
                        "eventType": "ZONE_ENTRY",
                        "cameraId": self.camera_id,
                        "ruleId": self.rule_id,
                        "ruleName": self.rule_name,
                        "zoneId": self.zone_id,
                        "trackId": track.get("trackId"),
                        "trackDisplayId": display_id,
                        "objectClass": class_name,
                        "confidence": track.get("confidence", 0.0),
                        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "verifiedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "videoTimestamp": round(video_timestamp, 3),
                        "status": "VERIFIED",
                        "verificationState": "verified",
                        "explanation": f"{class_name.capitalize()} track {display_id} entered {zone_name} and remained inside for {elapsed_sec:.2f}s, satisfying Rule {self.rule_id}.",
                        "metadata": {
                            "anchor": {"x": anchor[0], "y": anchor[1]},
                            "framesInside": frames_count,
                            "elapsedSeconds": round(elapsed_sec, 2),
                        }
                    }
                elif not state.has_emitted_verified:
                    candidate_event = {
                        "id": f"CAND-{self.camera_id}-{track.get('trackId')}-ENTRY",
                        "eventType": "ZONE_ENTRY",
                        "cameraId": self.camera_id,
                        "ruleId": self.rule_id,
                        "zoneId": self.zone_id,
                        "trackId": track.get("trackId"),
                        "trackDisplayId": display_id,
                        "objectClass": class_name,
                        "videoTimestamp": round(video_timestamp, 3),
                        "status": "CANDIDATE",
                        "explanation": f"Candidate entry: {class_name} {display_id} in {zone_name} ({frames_count}/{self.min_frames} frames)",
                    }
        else:
            state.frames_outside += 1
            if state.frames_outside >= 2:
                state.is_inside_zone = False
                state.is_candidate = False
                state.frames_inside = 0
                state.has_emitted_verified = False
                state.candidate_start_time = None

        return verified_event, candidate_event


class ZoneExitEvaluator(BaseEvaluator):
    """
    Evaluates exit from a polygon zone after verified presence inside.
    """
    def __init__(self, rule: Dict[str, Any]):
        super().__init__(rule)
        self.zone_id = rule.get("zoneId", "")

    def evaluate(
        self,
        track: Dict[str, Any],
        state: TrackRuleState,
        context: Dict[str, Any],
        video_timestamp: float,
        frame_idx: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        if not self.enabled or not self.is_class_allowed(track.get("className", "")):
            return None, None

        zones = context.get("zones", {})
        zone = zones.get(self.zone_id)
        if not zone or not zone.get("polygon"):
            return None, None

        anchor = get_bottom_center_anchor(track.get("boundingBox", {}))
        inside = point_in_polygon(anchor, zone["polygon"])
        zone_name = zone.get("name", self.zone_id)
        display_id = track.get("displayId", f"T{track.get('trackId', 0):03d}")
        class_name = track.get("className", "object")

        verified_event = None
        candidate_event = None

        if inside:
            state.is_inside_zone = True
            state.frames_outside = 0
        else:
            if state.is_inside_zone:
                state.frames_outside += 1
                if state.frames_outside >= self.min_frames and self.check_cooldown(state, video_timestamp):
                    state.is_inside_zone = False
                    state.last_verified_video_timestamp = video_timestamp

                    verified_event = {
                        "id": f"EVT-{self.camera_id}-{int(video_timestamp*100):05d}-{track.get('trackId')}-EXIT",
                        "eventType": "ZONE_EXIT",
                        "cameraId": self.camera_id,
                        "ruleId": self.rule_id,
                        "ruleName": self.rule_name,
                        "zoneId": self.zone_id,
                        "trackId": track.get("trackId"),
                        "trackDisplayId": display_id,
                        "objectClass": class_name,
                        "confidence": track.get("confidence", 0.0),
                        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "verifiedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "videoTimestamp": round(video_timestamp, 3),
                        "status": "VERIFIED",
                        "verificationState": "verified",
                        "explanation": f"{class_name.capitalize()} track {display_id} exited {zone_name}.",
                        "metadata": {
                            "anchor": {"x": anchor[0], "y": anchor[1]},
                        }
                    }
                elif state.frames_outside < self.min_frames:
                    candidate_event = {
                        "id": f"CAND-{self.camera_id}-{track.get('trackId')}-EXIT",
                        "eventType": "ZONE_EXIT",
                        "cameraId": self.camera_id,
                        "ruleId": self.rule_id,
                        "zoneId": self.zone_id,
                        "trackId": track.get("trackId"),
                        "trackDisplayId": display_id,
                        "objectClass": class_name,
                        "videoTimestamp": round(video_timestamp, 3),
                        "status": "CANDIDATE",
                        "explanation": f"Candidate exit: {class_name} {display_id} left {zone_name} (confirming...)",
                    }

        return verified_event, candidate_event


class DwellEvaluator(BaseEvaluator):
    """
    Evaluates continuous dwell duration inside a polygon zone.
    """
    def __init__(self, rule: Dict[str, Any]):
        super().__init__(rule)
        self.zone_id = rule.get("zoneId", "")
        conditions = rule.get("conditions", {})
        self.min_dwell_seconds = float(conditions.get("minimumSeconds", conditions.get("minDwellSeconds", 2.0)))

    def evaluate(
        self,
        track: Dict[str, Any],
        state: TrackRuleState,
        context: Dict[str, Any],
        video_timestamp: float,
        frame_idx: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        if not self.enabled or not self.is_class_allowed(track.get("className", "")):
            return None, None

        zones = context.get("zones", {})
        zone = zones.get(self.zone_id)
        if not zone or not zone.get("polygon"):
            return None, None

        anchor = get_bottom_center_anchor(track.get("boundingBox", {}))
        inside = point_in_polygon(anchor, zone["polygon"])
        zone_name = zone.get("name", self.zone_id)
        display_id = track.get("displayId", f"T{track.get('trackId', 0):03d}")
        class_name = track.get("className", "object")

        verified_event = None
        candidate_event = None

        if inside:
            if state.zone_entry_timestamp is None:
                state.zone_entry_timestamp = video_timestamp
                state.zone_entry_frame = frame_idx

            dwell_sec = max(0.0, video_timestamp - state.zone_entry_timestamp)

            if dwell_sec >= self.min_dwell_seconds and not state.has_emitted_verified and self.check_cooldown(state, video_timestamp):
                state.has_emitted_verified = True
                state.last_verified_video_timestamp = video_timestamp

                verified_event = {
                    "id": f"EVT-{self.camera_id}-{int(video_timestamp*100):05d}-{track.get('trackId')}-DWELL",
                    "eventType": "DWELL",
                    "cameraId": self.camera_id,
                    "ruleId": self.rule_id,
                    "ruleName": self.rule_name,
                    "zoneId": self.zone_id,
                    "trackId": track.get("trackId"),
                    "trackDisplayId": display_id,
                    "objectClass": class_name,
                    "confidence": track.get("confidence", 0.0),
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "verifiedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "videoTimestamp": round(video_timestamp, 3),
                    "status": "VERIFIED",
                    "verificationState": "verified",
                    "explanation": f"{class_name.capitalize()} track {display_id} dwelled inside {zone_name} for {dwell_sec:.2f}s (threshold: {self.min_dwell_seconds}s).",
                    "metadata": {
                        "anchor": {"x": anchor[0], "y": anchor[1]},
                        "dwellSeconds": round(dwell_sec, 2),
                        "dwellThreshold": self.min_dwell_seconds,
                    }
                }
            elif not state.has_emitted_verified:
                candidate_event = {
                    "id": f"CAND-{self.camera_id}-{track.get('trackId')}-DWELL",
                    "eventType": "DWELL",
                    "cameraId": self.camera_id,
                    "ruleId": self.rule_id,
                    "zoneId": self.zone_id,
                    "trackId": track.get("trackId"),
                    "trackDisplayId": display_id,
                    "objectClass": class_name,
                    "videoTimestamp": round(video_timestamp, 3),
                    "status": "CANDIDATE",
                    "explanation": f"Dwell candidate: {class_name} {display_id} inside {zone_name} for {dwell_sec:.1f}s / {self.min_dwell_seconds}s",
                    "metadata": {
                        "currentDwellSeconds": round(dwell_sec, 2),
                        "targetDwellSeconds": self.min_dwell_seconds,
                    }
                }
        else:
            state.zone_entry_timestamp = None
            state.zone_entry_frame = None
            state.has_emitted_verified = False

        return verified_event, candidate_event


class LineCrossingEvaluator(BaseEvaluator):
    """
    Evaluates crossing of a virtual tripwire line between Side A and Side B.
    """
    def __init__(self, rule: Dict[str, Any]):
        super().__init__(rule)
        self.line_id = rule.get("lineId", "")

    def evaluate(
        self,
        track: Dict[str, Any],
        state: TrackRuleState,
        context: Dict[str, Any],
        video_timestamp: float,
        frame_idx: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        if not self.enabled or not self.is_class_allowed(track.get("className", "")):
            return None, None

        lines = context.get("lines", {})
        line = lines.get(self.line_id)
        if not line or not line.get("start") or not line.get("end"):
            return None, None

        p1, p2 = line["start"], line["end"]
        anchor = get_bottom_center_anchor(track.get("boundingBox", {}))
        current_side = line_side(p1, p2, anchor)

        line_name = line.get("name", self.line_id)
        display_id = track.get("displayId", f"T{track.get('trackId', 0):03d}")
        class_name = track.get("className", "object")

        verified_event = None
        candidate_event = None

        # Check trajectory history for crossing
        trajectory = track.get("trajectory", [])
        crossed = False
        direction = None

        if state.last_line_side is not None and current_side != 0.0:
            if state.last_line_side != 0.0 and state.last_line_side != current_side:
                crossed = True
                direction = "A_TO_B" if (state.last_line_side > 0 and current_side < 0) else "B_TO_A"

        # Also check segment intersection if trajectory has >= 2 points
        if not crossed and state.last_anchor and len(trajectory) >= 2:
            p1_t = (float(p1[0]), float(p1[1])) if not isinstance(p1, dict) else (float(p1.get("x", 0)), float(p1.get("y", 0)))
            p2_t = (float(p2[0]), float(p2[1])) if not isinstance(p2, dict) else (float(p2.get("x", 0)), float(p2.get("y", 0)))
            prev_anchor = state.last_anchor
            if segments_intersect(prev_anchor, anchor, p1_t, p2_t):
                crossed = True
                s1 = line_side(p1, p2, prev_anchor)
                s2 = line_side(p1, p2, anchor)
                direction = "A_TO_B" if (s1 >= 0 and s2 < 0) else "B_TO_A"

        state.last_line_side = current_side if current_side != 0.0 else state.last_line_side
        state.last_anchor = anchor

        if crossed and direction:
            state.crossing_timestamps.append((video_timestamp, direction))
            if self.check_cooldown(state, video_timestamp):
                state.last_verified_video_timestamp = video_timestamp
                label_from = line.get("labelA", "Side A") if direction == "A_TO_B" else line.get("labelB", "Side B")
                label_to = line.get("labelB", "Side B") if direction == "A_TO_B" else line.get("labelA", "Side A")

                verified_event = {
                    "id": f"EVT-{self.camera_id}-{int(video_timestamp*100):05d}-{track.get('trackId')}-CROSS",
                    "eventType": "LINE_CROSSING",
                    "cameraId": self.camera_id,
                    "ruleId": self.rule_id,
                    "ruleName": self.rule_name,
                    "lineId": self.line_id,
                    "trackId": track.get("trackId"),
                    "trackDisplayId": display_id,
                    "objectClass": class_name,
                    "confidence": track.get("confidence", 0.0),
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "verifiedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "videoTimestamp": round(video_timestamp, 3),
                    "status": "VERIFIED",
                    "verificationState": "verified",
                    "explanation": f"{class_name.capitalize()} track {display_id} crossed {line_name} ({label_from} → {label_to}).",
                    "metadata": {
                        "direction": direction,
                        "anchor": {"x": anchor[0], "y": anchor[1]},
                    }
                }

        return verified_event, candidate_event


class WrongDirectionEvaluator(BaseEvaluator):
    """
    Evaluates crossing against a prohibited or unauthorized line direction.
    """
    def __init__(self, rule: Dict[str, Any]):
        super().__init__(rule)
        self.line_id = rule.get("lineId", "")
        conditions = rule.get("conditions", {})
        self.allowed_direction = conditions.get("allowedDirection", "A_TO_B")

    def evaluate(
        self,
        track: Dict[str, Any],
        state: TrackRuleState,
        context: Dict[str, Any],
        video_timestamp: float,
        frame_idx: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        if not self.enabled or not self.is_class_allowed(track.get("className", "")):
            return None, None

        lines = context.get("lines", {})
        line = lines.get(self.line_id)
        if not line or not line.get("start") or not line.get("end"):
            return None, None

        p1, p2 = line["start"], line["end"]
        anchor = get_bottom_center_anchor(track.get("boundingBox", {}))
        current_side = line_side(p1, p2, anchor)

        line_name = line.get("name", self.line_id)
        display_id = track.get("displayId", f"T{track.get('trackId', 0):03d}")
        class_name = track.get("className", "object")

        verified_event = None
        candidate_event = None

        crossed = False
        direction = None

        if state.last_line_side is not None and current_side != 0.0:
            if state.last_line_side != 0.0 and state.last_line_side != current_side:
                crossed = True
                direction = "A_TO_B" if (state.last_line_side > 0 and current_side < 0) else "B_TO_A"

        if not crossed and state.last_anchor:
            p1_t = (float(p1[0]), float(p1[1])) if not isinstance(p1, dict) else (float(p1.get("x", 0)), float(p1.get("y", 0)))
            p2_t = (float(p2[0]), float(p2[1])) if not isinstance(p2, dict) else (float(p2.get("x", 0)), float(p2.get("y", 0)))
            if segments_intersect(state.last_anchor, anchor, p1_t, p2_t):
                crossed = True
                s1 = line_side(p1, p2, state.last_anchor)
                s2 = line_side(p1, p2, anchor)
                direction = "A_TO_B" if (s1 >= 0 and s2 < 0) else "B_TO_A"

        state.last_line_side = current_side if current_side != 0.0 else state.last_line_side
        state.last_anchor = anchor

        if crossed and direction:
            # Check if crossing violates configured allowedDirection
            if direction != self.allowed_direction:
                if self.check_cooldown(state, video_timestamp):
                    state.last_verified_video_timestamp = video_timestamp
                    verified_event = {
                        "id": f"EVT-{self.camera_id}-{int(video_timestamp*100):05d}-{track.get('trackId')}-WRONGDIR",
                        "eventType": "WRONG_DIRECTION",
                        "cameraId": self.camera_id,
                        "ruleId": self.rule_id,
                        "ruleName": self.rule_name,
                        "lineId": self.line_id,
                        "trackId": track.get("trackId"),
                        "trackDisplayId": display_id,
                        "objectClass": class_name,
                        "confidence": track.get("confidence", 0.0),
                        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "verifiedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "videoTimestamp": round(video_timestamp, 3),
                        "status": "VERIFIED",
                        "verificationState": "verified",
                        "explanation": f"{class_name.capitalize()} track {display_id} crossed {line_name} in unauthorized direction ({direction}, expected {self.allowed_direction}).",
                        "metadata": {
                            "actualDirection": direction,
                            "allowedDirection": self.allowed_direction,
                            "anchor": {"x": anchor[0], "y": anchor[1]},
                        }
                    }

        return verified_event, candidate_event


class RepeatedCrossingEvaluator(BaseEvaluator):
    """
    Evaluates multiple crossings across a tripwire within a rolling time window.
    """
    def __init__(self, rule: Dict[str, Any]):
        super().__init__(rule)
        self.line_id = rule.get("lineId", "")
        conditions = rule.get("conditions", {})
        self.repeat_count = int(conditions.get("repeatCount", 2))
        self.window_seconds = float(conditions.get("windowSeconds", 10.0))

    def evaluate(
        self,
        track: Dict[str, Any],
        state: TrackRuleState,
        context: Dict[str, Any],
        video_timestamp: float,
        frame_idx: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        if not self.enabled or not self.is_class_allowed(track.get("className", "")):
            return None, None

        lines = context.get("lines", {})
        line = lines.get(self.line_id)
        if not line or not line.get("start") or not line.get("end"):
            return None, None

        p1, p2 = line["start"], line["end"]
        anchor = get_bottom_center_anchor(track.get("boundingBox", {}))
        current_side = line_side(p1, p2, anchor)

        line_name = line.get("name", self.line_id)
        display_id = track.get("displayId", f"T{track.get('trackId', 0):03d}")
        class_name = track.get("className", "object")

        verified_event = None
        candidate_event = None

        crossed = False
        direction = None

        if state.last_line_side is not None and current_side != 0.0:
            if state.last_line_side != 0.0 and state.last_line_side != current_side:
                crossed = True
                direction = "A_TO_B" if (state.last_line_side > 0 and current_side < 0) else "B_TO_A"

        if not crossed and state.last_anchor:
            p1_t = (float(p1[0]), float(p1[1])) if not isinstance(p1, dict) else (float(p1.get("x", 0)), float(p1.get("y", 0)))
            p2_t = (float(p2[0]), float(p2[1])) if not isinstance(p2, dict) else (float(p2.get("x", 0)), float(p2.get("y", 0)))
            if segments_intersect(state.last_anchor, anchor, p1_t, p2_t):
                crossed = True
                s1 = line_side(p1, p2, state.last_anchor)
                s2 = line_side(p1, p2, anchor)
                direction = "A_TO_B" if (s1 >= 0 and s2 < 0) else "B_TO_A"

        state.last_line_side = current_side if current_side != 0.0 else state.last_line_side
        state.last_anchor = anchor

        if crossed:
            state.crossing_timestamps.append(video_timestamp)

        # Count crossings within rolling window
        cutoff = video_timestamp - self.window_seconds
        recent_crossings = [t for t in state.crossing_timestamps if t >= cutoff]

        if len(recent_crossings) >= self.repeat_count and self.check_cooldown(state, video_timestamp):
            state.last_verified_video_timestamp = video_timestamp
            state.crossing_timestamps.clear()

            verified_event = {
                "id": f"EVT-{self.camera_id}-{int(video_timestamp*100):05d}-{track.get('trackId')}-REPCROSS",
                "eventType": "REPEATED_CROSSING",
                "cameraId": self.camera_id,
                "ruleId": self.rule_id,
                "ruleName": self.rule_name,
                "lineId": self.line_id,
                "trackId": track.get("trackId"),
                "trackDisplayId": display_id,
                "objectClass": class_name,
                "confidence": track.get("confidence", 0.0),
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "verifiedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "videoTimestamp": round(video_timestamp, 3),
                "status": "VERIFIED",
                "verificationState": "verified",
                "explanation": f"{class_name.capitalize()} track {display_id} crossed {line_name} {len(recent_crossings)} times within {self.window_seconds}s.",
                "metadata": {
                    "crossingCount": len(recent_crossings),
                    "windowSeconds": self.window_seconds,
                    "anchor": {"x": anchor[0], "y": anchor[1]},
                }
            }
        elif len(recent_crossings) > 0 and len(recent_crossings) < self.repeat_count:
            candidate_event = {
                "id": f"CAND-{self.camera_id}-{track.get('trackId')}-REPCROSS",
                "eventType": "REPEATED_CROSSING",
                "cameraId": self.camera_id,
                "ruleId": self.rule_id,
                "lineId": self.line_id,
                "trackId": track.get("trackId"),
                "trackDisplayId": display_id,
                "objectClass": class_name,
                "videoTimestamp": round(video_timestamp, 3),
                "status": "CANDIDATE",
                "explanation": f"Repeated crossing candidate: {len(recent_crossings)}/{self.repeat_count} crossings in {self.window_seconds}s",
            }

        return verified_event, candidate_event
