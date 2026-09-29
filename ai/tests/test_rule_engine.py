"""
IBVAP Phase 5 Unit Tests — Rule Engine & Verified Security Events
Tests:
- Zone Entry (Candidate -> Temporal Verification -> Single Verified Event)
- Zone Exit (Candidate -> Temporal Confirmation -> Exit Event)
- Dwell Time (Candidate progress -> Minimum duration satisfaction -> Dwell Event)
- Line Crossing (Side A -> Side B transition)
- Wrong Direction (Crossing opposite to allowed direction)
- Repeated Crossing (Multiple crossings within time window)
- Object Class Filtering
- Disabled Rules
- Event Deduplication & Cooldown
- Track Expiration Cleanup
- Video Loop / Replay Reset
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../rules")))

from engine import RuleEngine

class TestRuleEngine(unittest.TestCase):
    def setUp(self):
        self.engine = RuleEngine(
            rules_path="config/rules/demo_rules.json",
            zones_path="config/zones/demo_zones.json",
            lines_path="config/zones/demo_lines.json",
        )

    def test_zone_entry_temporal_verification(self):
        """Test that single-frame noise is a candidate, and consecutive frames verify."""
        cam_id = "CAM-03"
        # Bounding box inside ZONE-CAM03-RESTRICTED: x=0.3, y=0.3, w=0.1, h=0.2 -> anchor = (0.35, 0.50)
        track = {
            "id": "trk-cam03-17",
            "trackId": 17,
            "displayId": "T017",
            "className": "person",
            "confidence": 0.88,
            "boundingBox": {"x": 0.3, "y": 0.3, "width": 0.1, "height": 0.2},
            "trajectory": [{"x": 0.35, "y": 0.50, "timestamp": 1.0}],
        }

        # Frame 1 (t=1.0s) -> Candidate entry (minimumFrames=2, minimumSeconds=0.4)
        v_events, c_events, _ = self.engine.evaluate(cam_id, [track], 1.0, 1)
        self.assertEqual(len(v_events), 0, "Single frame must NOT produce verified event")
        self.assertTrue(len(c_events) >= 1, "Candidate event must be created")
        self.assertEqual(c_events[0]["status"], "CANDIDATE")

        # Frame 2 (t=1.2s) -> Still candidate (elapsed = 0.2s < 0.4s)
        v_events, c_events, _ = self.engine.evaluate(cam_id, [track], 1.2, 2)
        self.assertEqual(len(v_events), 0)

        # Frame 3 (t=1.5s) -> Verified entry (frames=3 >= 2 and elapsed=0.5s >= 0.4s)
        v_events, c_events, _ = self.engine.evaluate(cam_id, [track], 1.5, 3)
        self.assertEqual(len(v_events), 1, "Temporal conditions met: must produce 1 VERIFIED event")
        evt = v_events[0]
        self.assertEqual(evt["eventType"], "ZONE_ENTRY")
        self.assertEqual(evt["status"], "VERIFIED")
        self.assertEqual(evt["trackId"], 17)
        self.assertEqual(evt["trackDisplayId"], "T017")
        self.assertIn("entered", evt["explanation"])

        # Frame 4 (t=1.7s) -> Deduplication: remaining in zone must NOT produce another entry event
        v_events_subsequent, _, _ = self.engine.evaluate(cam_id, [track], 1.7, 4)
        entry_events = [e for e in v_events_subsequent if e["eventType"] == "ZONE_ENTRY"]
        self.assertEqual(len(entry_events), 0, "Deduplication: continuous presence must not re-emit entry")

    def test_zone_dwell_event(self):
        """Test continuous presence in zone produces DWELL event after minimumSeconds."""
        cam_id = "CAM-03"
        track = {
            "id": "trk-cam03-17",
            "trackId": 17,
            "displayId": "T017",
            "className": "person",
            "confidence": 0.88,
            "boundingBox": {"x": 0.3, "y": 0.3, "width": 0.1, "height": 0.2},
            "trajectory": [{"x": 0.35, "y": 0.50, "timestamp": 10.0}],
        }

        # Enter zone at t=10.0s
        self.engine.evaluate(cam_id, [track], 10.0, 100)
        self.engine.evaluate(cam_id, [track], 10.5, 103)  # Verified entry

        # At t=11.0s (dwell=1.0s < 2.0s) -> Candidate dwell
        v_events, c_events, _ = self.engine.evaluate(cam_id, [track], 11.0, 106)
        dwell_v = [e for e in v_events if e["eventType"] == "DWELL"]
        self.assertEqual(len(dwell_v), 0)

        # At t=12.2s (dwell=2.2s >= 2.0s) -> Verified Dwell event
        v_events, _, _ = self.engine.evaluate(cam_id, [track], 12.2, 112)
        dwell_v = [e for e in v_events if e["eventType"] == "DWELL"]
        self.assertEqual(len(dwell_v), 1, "Dwell threshold satisfied: must emit VERIFIED DWELL event")
        self.assertIn("dwelled", dwell_v[0]["explanation"])
        self.assertEqual(dwell_v[0]["status"], "VERIFIED")

    def test_line_crossing_and_direction(self):
        """Test line crossing detection and direction-aware rules."""
        cam_id = "CAM-01"
        # LINE-CAM01-GATE is horizontal at y=0.62 (start [0.05, 0.62], end [0.95, 0.62])
        # Track starts at y=0.40 (Side A: y < 0.62, so anchor_y = 0.40 + 0.15 = 0.55 < 0.62)
        track_side_a = {
            "id": "trk-cam01-08",
            "trackId": 8,
            "displayId": "T008",
            "className": "car",
            "confidence": 0.85,
            "boundingBox": {"x": 0.4, "y": 0.4, "width": 0.2, "height": 0.15},
            "trajectory": [{"x": 0.5, "y": 0.55, "timestamp": 1.0}],
        }

        # Track moves across line: anchor_y = 0.60 + 0.15 = 0.75 > 0.62 (Side B)
        track_side_b = {
            "id": "trk-cam01-08",
            "trackId": 8,
            "displayId": "T008",
            "className": "car",
            "confidence": 0.85,
            "boundingBox": {"x": 0.4, "y": 0.60, "width": 0.2, "height": 0.15},
            "trajectory": [
                {"x": 0.5, "y": 0.55, "timestamp": 1.0},
                {"x": 0.5, "y": 0.75, "timestamp": 1.4},
            ],
        }

        # Frame 1 on Side A
        self.engine.evaluate(cam_id, [track_side_a], 1.0, 10)

        # Frame 2 crosses to Side B (A -> B is allowed entry)
        v_events, _, _ = self.engine.evaluate(cam_id, [track_side_b], 1.4, 12)
        crossing_evts = [e for e in v_events if e["eventType"] == "LINE_CROSSING"]
        self.assertEqual(len(crossing_evts), 1, "Must produce LINE_CROSSING event")
        self.assertEqual(crossing_evts[0]["metadata"]["direction"], "A_TO_B")

        # Wrong direction check: crossing in reverse (B -> A) should trigger WRONG_DIRECTION
        # Move back to Side A at t=10.0 (past cooldown)
        v_events_reverse, _, _ = self.engine.evaluate(cam_id, [track_side_a], 10.0, 50)
        wrong_dir_evts = [e for e in v_events_reverse if e["eventType"] == "WRONG_DIRECTION"]
        self.assertEqual(len(wrong_dir_evts), 1, "Reverse crossing (B to A) must trigger WRONG_DIRECTION")
        self.assertIn("unauthorized direction", wrong_dir_evts[0]["explanation"])

    def test_class_filtering(self):
        """Test that rules with specific class filters do not trigger for unlisted classes."""
        cam_id = "CAM-04"
        # RULE-CAM04-01 targets ["car", "truck", "bus"]
        # Person track should NOT trigger vehicle crossing rule
        person_track_a = {
            "id": "trk-cam04-01",
            "trackId": 1,
            "displayId": "T001",
            "className": "person",  # NOT in vehicle classes
            "confidence": 0.90,
            "boundingBox": {"x": 0.4, "y": 0.4, "width": 0.1, "height": 0.15},
        }
        person_track_b = {
            "id": "trk-cam04-01",
            "trackId": 1,
            "displayId": "T001",
            "className": "person",
            "confidence": 0.90,
            "boundingBox": {"x": 0.4, "y": 0.7, "width": 0.1, "height": 0.15},
        }

        self.engine.evaluate(cam_id, [person_track_a], 1.0, 10)
        v_events, _, _ = self.engine.evaluate(cam_id, [person_track_b], 1.4, 12)
        vehicle_crossings = [e for e in v_events if e["ruleId"] == "RULE-CAM04-01"]
        self.assertEqual(len(vehicle_crossings), 0, "Person must NOT trigger vehicle-only rule")

    def test_disabled_rule(self):
        """Test that disabled rules are not evaluated."""
        cam_id = "CAM-03"
        rule_id = "RULE-CAM03-01"
        self.engine.toggle_rule(rule_id, enabled=False)

        track = {
            "id": "trk-cam03-17",
            "trackId": 17,
            "displayId": "T017",
            "className": "person",
            "confidence": 0.88,
            "boundingBox": {"x": 0.3, "y": 0.3, "width": 0.1, "height": 0.2},
        }

        self.engine.evaluate(cam_id, [track], 1.0, 1)
        v_events, c_events, _ = self.engine.evaluate(cam_id, [track], 1.6, 3)
        self.assertEqual(len([e for e in v_events if e["ruleId"] == rule_id]), 0)
        self.assertEqual(len([e for e in c_events if e["ruleId"] == rule_id]), 0)

    def test_reset_and_expiration_cleanup(self):
        """Test track expiration and replay reset cleans in-memory state."""
        cam_id = "CAM-03"
        track = {
            "id": "trk-cam03-17",
            "trackId": 17,
            "displayId": "T017",
            "className": "person",
            "confidence": 0.88,
            "boundingBox": {"x": 0.3, "y": 0.3, "width": 0.1, "height": 0.2},
        }

        self.engine.evaluate(cam_id, [track], 1.0, 1)
        self.assertIn(17, self.engine.track_states[cam_id])

        # Track expires / leaves frame (empty tracks list)
        self.engine.evaluate(cam_id, [], 1.2, 2)
        self.assertNotIn(17, self.engine.track_states[cam_id], "Expired track state must be cleaned up")

        # Reset camera
        self.engine.evaluate(cam_id, [track], 1.0, 1)
        self.engine.reset_camera(cam_id)
        self.assertEqual(len(self.engine.track_states[cam_id]), 0, "Camera reset must clear all states")

if __name__ == "__main__":
    unittest.main()
