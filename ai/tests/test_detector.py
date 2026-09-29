import unittest
import numpy as np
import os
import sys

# Add ai/detection to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../detection")))

from detector import YOLODetector
from frame_extractor import FrameExtractor

class TestYOLODetector(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.detector = YOLODetector(
            model_path="ai/models/yolov8n.pt",
            conf_threshold=0.35,
            iou_threshold=0.45,
            device="cpu",
            target_classes=["person", "car", "motorcycle", "bus", "truck"]
        )

    def test_initialization(self):
        self.assertIsNotNone(self.detector.model)
        self.assertEqual(self.detector.device, "cpu")
        self.assertIn("person", self.detector.target_classes)
        self.assertIn("car", self.detector.target_classes)

    def test_blank_frame_no_detections(self):
        # 720x1280 blank black image
        blank_frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        detections, latency, w, h = self.detector.detect(blank_frame, "CAM-TEST", 0.0, 0)
        self.assertIsInstance(detections, list)
        self.assertGreaterEqual(latency, 0.0)
        self.assertEqual(w, 1280)
        self.assertEqual(h, 720)

    def test_none_frame_handling(self):
        detections, latency, w, h = self.detector.detect(None, "CAM-TEST", 0.0, 0)
        self.assertEqual(detections, [])
        self.assertEqual(latency, 0.0)

    def test_detection_schema_frame_index_and_normalized_coords(self):
        # Create a frame with some content
        test_frame = np.full((720, 1280, 3), 128, dtype=np.uint8)
        detections, latency, w, h = self.detector.detect(test_frame, "CAM-01", 1.5, 36)
        for det in detections:
            self.assertTrue(det["cameraId"].startswith("CAM-"))
            self.assertIn(det["objectClass"], self.detector.target_classes)
            self.assertGreaterEqual(det["confidence"], 0.35)
            self.assertLessEqual(det["confidence"], 1.0)
            self.assertEqual(det["frameIndex"], 36)
            self.assertEqual(det["videoTimestamp"], 1.5)
            
            bbox = det["boundingBox"]
            self.assertGreaterEqual(bbox["x"], 0.0)
            self.assertLessEqual(bbox["x"], 1.0)
            self.assertGreaterEqual(bbox["y"], 0.0)
            self.assertLessEqual(bbox["y"], 1.0)
            self.assertGreaterEqual(bbox["width"], 0.0)
            self.assertLessEqual(bbox["width"], 1.0)
            self.assertGreaterEqual(bbox["height"], 0.0)
            self.assertLessEqual(bbox["height"], 1.0)

            # Strict Phase 3 check: NO trackRef or tracking ID
            self.assertIsNone(det.get("trackRef"))

    def test_moving_object_sequential_frame_bounding_box_changes(self):
        """
        Regression Test for Phase 3 Remediation:
        Verify that sequential frames from gate.mp4 produce advancing frameIndex,
        increasing videoTimestamp, and changing bounding box coordinates for moving entities.
        """
        video_path = "data/videos/CAM-1/gate.mp4"
        if not os.path.exists(video_path):
            self.skipTest(f"Video file not found at {video_path}")

        extractor = FrameExtractor(video_path, target_fps=5.0)
        collected_frames = []

        for i in range(8):
            ok, frame, ts, f_idx = extractor.get_next_frame()
            if not ok or frame is None:
                continue
            dets, lat, w, h = self.detector.detect(frame, "CAM-01", ts, f_idx)
            collected_frames.append({
                "step": i,
                "frameIndex": f_idx,
                "timestamp": ts,
                "detections": dets
            })

        self.assertGreaterEqual(len(collected_frames), 5, "Should extract at least 5 frames")

        # Verify frameIndex and timestamps are strictly advancing
        for i in range(1, len(collected_frames)):
            prev = collected_frames[i - 1]
            curr = collected_frames[i]
            self.assertGreater(curr["frameIndex"], prev["frameIndex"], "frameIndex must strictly increase")
            self.assertGreater(curr["timestamp"], prev["timestamp"], "videoTimestamp must strictly increase")

        # Verify that moving objects have changing coordinates across frames
        all_x_coords = []
        for cf in collected_frames:
            for d in cf["detections"]:
                all_x_coords.append(d["boundingBox"]["x"])

        # Multiple detections across different frames should NOT be completely identical
        unique_x_coords = set(round(x, 3) for x in all_x_coords)
        self.assertGreater(len(unique_x_coords), 1, "Bounding box coordinates must change across moving video frames")

        extractor.release()

if __name__ == "__main__":
    unittest.main()
