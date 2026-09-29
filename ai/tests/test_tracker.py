import unittest
import numpy as np
import os
import sys

# Ensure ai/detection and ai/tracking are in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../detection")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../tracking")))

from bytetrack import ByteTracker, STrack, TrackState
from kalman_filter import KalmanFilter

class TestByteTracker(unittest.TestCase):
    def setUp(self):
        self.tracker = ByteTracker(
            camera_id="CAM-01",
            track_thresh=0.40,
            match_thresh=0.70,
            max_time_lost=5,
            min_hits=1,
            trajectory_max_len=10,
        )

    def test_tracker_initialization(self):
        self.assertEqual(self.tracker.camera_id, "CAM-01")
        self.assertEqual(len(self.tracker.tracked_stracks), 0)
        self.assertEqual(len(self.tracker.lost_stracks), 0)
        self.assertEqual(self.tracker._next_id, 1)

    def test_empty_detection_frame(self):
        tracks, latency = self.tracker.update([], frame_index=1, frame_timestamp=0.2)
        self.assertEqual(tracks, [])
        self.assertGreaterEqual(latency, 0.0)

    def test_single_object_stable_id_across_sequential_frames(self):
        """
        Verify that a single moving object keeps its stable Track ID across sequential frames
        while its coordinates change.
        """
        # Frame 1: Detection at x=0.20
        det_f1 = [{
            "id": "det-1",
            "cameraId": "CAM-01",
            "objectClass": "person",
            "classId": 0,
            "confidence": 0.92,
            "boundingBox": {"x": 0.20, "y": 0.30, "width": 0.10, "height": 0.25}
        }]
        tracks_f1, _ = self.tracker.update(det_f1, frame_index=1, frame_timestamp=0.2)
        self.assertEqual(len(tracks_f1), 1)
        initial_track_id = tracks_f1[0]["trackId"]
        self.assertEqual(tracks_f1[0]["displayId"], f"T{initial_track_id:03d}")
        self.assertEqual(tracks_f1[0]["status"], "ACTIVE")
        self.assertEqual(tracks_f1[0]["className"], "person")

        # Frame 2: Object moves to x=0.22
        det_f2 = [{
            "id": "det-2",
            "cameraId": "CAM-01",
            "objectClass": "person",
            "classId": 0,
            "confidence": 0.94,
            "boundingBox": {"x": 0.22, "y": 0.30, "width": 0.10, "height": 0.25}
        }]
        tracks_f2, _ = self.tracker.update(det_f2, frame_index=2, frame_timestamp=0.4)
        self.assertEqual(len(tracks_f2), 1)
        self.assertEqual(tracks_f2[0]["trackId"], initial_track_id, "Track ID must remain stable across moving frames")
        self.assertAlmostEqual(tracks_f2[0]["boundingBox"]["x"], 0.22, delta=0.03)

        # Frame 3: Object moves to x=0.24
        det_f3 = [{
            "id": "det-3",
            "cameraId": "CAM-01",
            "objectClass": "person",
            "classId": 0,
            "confidence": 0.91,
            "boundingBox": {"x": 0.24, "y": 0.30, "width": 0.10, "height": 0.25}
        }]
        tracks_f3, _ = self.tracker.update(det_f3, frame_index=3, frame_timestamp=0.6)
        self.assertEqual(len(tracks_f3), 1)
        self.assertEqual(tracks_f3[0]["trackId"], initial_track_id, "Track ID must remain stable")
        self.assertEqual(tracks_f3[0]["ageFrames"], 3)
        self.assertGreater(len(tracks_f3[0]["trajectory"]), 1, "Trajectory points must accumulate")

    def test_multi_object_tracking_independent_ids(self):
        """
        Verify that multiple distinct objects receive distinct stable Track IDs.
        """
        dets = [
            {
                "id": "det-p1",
                "cameraId": "CAM-01",
                "objectClass": "person",
                "classId": 0,
                "confidence": 0.90,
                "boundingBox": {"x": 0.10, "y": 0.20, "width": 0.08, "height": 0.20}
            },
            {
                "id": "det-p2",
                "cameraId": "CAM-01",
                "objectClass": "car",
                "classId": 2,
                "confidence": 0.88,
                "boundingBox": {"x": 0.60, "y": 0.40, "width": 0.25, "height": 0.25}
            },
        ]

        tracks, _ = self.tracker.update(dets, frame_index=10, frame_timestamp=2.0)
        self.assertEqual(len(tracks), 2)
        ids = {t["trackId"] for t in tracks}
        self.assertEqual(len(ids), 2, "Each object must receive a unique ID")
        classes = {t["className"] for t in tracks}
        self.assertIn("person", classes)
        self.assertIn("car", classes)

    def test_object_entry_and_expiration(self):
        """
        Verify that new objects create new tracks, and disappeared objects expire after max_time_lost.
        """
        det = [{
            "id": "det-enter",
            "cameraId": "CAM-01",
            "objectClass": "person",
            "classId": 0,
            "confidence": 0.85,
            "boundingBox": {"x": 0.50, "y": 0.50, "width": 0.10, "height": 0.20}
        }]
        tracks_1, _ = self.tracker.update(det, frame_index=1, frame_timestamp=0.2)
        self.assertEqual(len(tracks_1), 1)
        trk_id = tracks_1[0]["trackId"]

        # 5 empty frames (missed detections)
        for i in range(2, 8):
            t_out, _ = self.tracker.update([], frame_index=i, frame_timestamp=0.2 * i)
            self.assertEqual(t_out, [], "Lost track should not be in active output tracks")

        # Check that track is now removed / expired
        self.assertEqual(len(self.tracker.tracked_stracks), 0)
        self.assertTrue(any(t.track_id == trk_id for t in self.tracker.removed_stracks))

    def test_brief_occlusion_recovery(self):
        """
        Verify that a track recovers its ID if detection briefly drops for 1 frame and returns nearby.
        """
        det_1 = [{
            "id": "det-occ-1",
            "cameraId": "CAM-01",
            "objectClass": "person",
            "classId": 0,
            "confidence": 0.88,
            "boundingBox": {"x": 0.40, "y": 0.40, "width": 0.10, "height": 0.25}
        }]
        t1, _ = self.tracker.update(det_1, frame_index=1, frame_timestamp=0.2)
        trk_id = t1[0]["trackId"]

        # Frame 2: Occlusion (empty detection)
        t2, _ = self.tracker.update([], frame_index=2, frame_timestamp=0.4)
        self.assertEqual(len(t2), 0)
        self.assertEqual(len(self.tracker.lost_stracks), 1)

        # Frame 3: Object reappears nearby
        det_3 = [{
            "id": "det-occ-3",
            "cameraId": "CAM-01",
            "objectClass": "person",
            "classId": 0,
            "confidence": 0.89,
            "boundingBox": {"x": 0.42, "y": 0.40, "width": 0.10, "height": 0.25}
        }]
        t3, _ = self.tracker.update(det_3, frame_index=3, frame_timestamp=0.6)
        self.assertEqual(len(t3), 1)
        self.assertEqual(t3[0]["trackId"], trk_id, "Track ID must be preserved through short occlusion")

    def test_tracker_reset_on_video_loop(self):
        """
        Verify that tracker.reset() clears all state and restarts IDs.
        """
        det = [{
            "id": "det-loop",
            "cameraId": "CAM-01",
            "objectClass": "person",
            "classId": 0,
            "confidence": 0.90,
            "boundingBox": {"x": 0.30, "y": 0.30, "width": 0.10, "height": 0.20}
        }]
        self.tracker.update(det, frame_index=100, frame_timestamp=20.0)
        self.assertEqual(len(self.tracker.tracked_stracks), 1)

        # Reset
        self.tracker.reset()
        self.assertEqual(len(self.tracker.tracked_stracks), 0)
        self.assertEqual(len(self.tracker.lost_stracks), 0)
        self.assertEqual(self.tracker._next_id, 1)

    def test_independent_tracker_per_camera_no_leakage(self):
        """
        Verify that CAM-01 and CAM-02 tracker instances operate completely independently.
        """
        tracker_cam1 = ByteTracker(camera_id="CAM-01")
        tracker_cam2 = ByteTracker(camera_id="CAM-02")

        det1 = [{
            "id": "det-c1",
            "cameraId": "CAM-01",
            "objectClass": "person",
            "classId": 0,
            "confidence": 0.90,
            "boundingBox": {"x": 0.10, "y": 0.10, "width": 0.10, "height": 0.10}
        }]
        det2 = [{
            "id": "det-c2",
            "cameraId": "CAM-02",
            "objectClass": "car",
            "classId": 2,
            "confidence": 0.85,
            "boundingBox": {"x": 0.80, "y": 0.80, "width": 0.15, "height": 0.15}
        }]

        t1, _ = tracker_cam1.update(det1, frame_index=1, frame_timestamp=0.2)
        t2, _ = tracker_cam2.update(det2, frame_index=1, frame_timestamp=0.2)

        self.assertEqual(t1[0]["cameraId"], "CAM-01")
        self.assertEqual(t1[0]["className"], "person")
        self.assertEqual(t2[0]["cameraId"], "CAM-02")
        self.assertEqual(t2[0]["className"], "car")

        # CAM-1 reset does not affect CAM-2
        tracker_cam1.reset()
        self.assertEqual(len(tracker_cam1.tracked_stracks), 0)
        self.assertEqual(len(tracker_cam2.tracked_stracks), 1)

    def test_trajectory_bounded_length(self):
        """
        Verify trajectory does not grow indefinitely.
        """
        for i in range(30):
            det = [{
                "id": f"det-{i}",
                "cameraId": "CAM-01",
                "objectClass": "person",
                "classId": 0,
                "confidence": 0.90,
                "boundingBox": {"x": 0.10 + i * 0.005, "y": 0.20, "width": 0.10, "height": 0.20}
            }]
            tracks, _ = self.tracker.update(det, frame_index=i+1, frame_timestamp=0.2*(i+1))

        self.assertEqual(len(tracks), 1)
        self.assertLessEqual(len(tracks[0]["trajectory"]), 10, "Trajectory length must be bounded by trajectory_max_len")

    def test_no_identity_metadata_exists(self):
        """
        Verify strict boundary: No personName, identity, faceId, globalTrackId in track contract.
        """
        det = [{
            "id": "det-b",
            "cameraId": "CAM-01",
            "objectClass": "person",
            "classId": 0,
            "confidence": 0.90,
            "boundingBox": {"x": 0.20, "y": 0.20, "width": 0.10, "height": 0.20}
        }]
        tracks, _ = self.tracker.update(det, frame_index=1, frame_timestamp=0.2)
        track = tracks[0]

        self.assertNotIn("personName", track)
        self.assertNotIn("identity", track)
        self.assertNotIn("faceId", track)
        self.assertNotIn("crossCameraId", track)
        self.assertNotIn("globalTrackId", track)

if __name__ == "__main__":
    unittest.main()
