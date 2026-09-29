"""
IBVAP Phase 5 Real Video Rule Engine Validation Suite
Runs sequential detection, tracking, and rule engine evaluation on real video feeds:
- CAM-01 (gate.mp4): LINE_CROSSING / WRONG_DIRECTION
- CAM-02 (corridor.mp4): LINE_CROSSING / REPEATED_CROSSING
- CAM-03 (restricted.mp4): ZONE_ENTRY / DWELL
- CAM-04 (vehicle.mp4): LINE_CROSSING / ZONE_EXIT
- CAM-05 (perimeter.mp4): ZONE_ENTRY
- CAM-06 (night.mp4): DWELL / LINE_CROSSING
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../detection")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../tracking")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../rules")))

from detector import YOLODetector
from frame_extractor import FrameExtractor
from bytetrack import ByteTracker
from engine import RuleEngine

def main():
    detector = YOLODetector(
        model_path="ai/models/yolov8n.pt",
        conf_threshold=0.38,
        iou_threshold=0.45,
        device="cpu",
        target_classes=["person", "car", "motorcycle", "bus", "truck"]
    )

    rule_engine = RuleEngine(
        rules_path="config/rules/demo_rules.json",
        zones_path="config/zones/demo_zones.json",
        lines_path="config/zones/demo_lines.json",
    )

    cameras = [
        ("CAM-01", "data/videos/CAM-1/gate.mp4"),
        ("CAM-02", "data/videos/CAM-2/corridor.mp4"),
        ("CAM-03", "data/videos/CAM-3/restricted.mp4"),
        ("CAM-04", "data/videos/CAM-4/vehicle.mp4"),
        ("CAM-05", "data/videos/CAM-5/perimeter.mp4"),
        ("CAM-06", "data/videos/CAM-6/night.mp4"),
    ]

    print("=" * 80)
    print("IBVAP PHASE 5 — RULE ENGINE & VERIFIED SECURITY EVENTS VALIDATION")
    print("=" * 80)

    total_verified_all = 0

    for cam_id, video_rel in cameras:
        video_path = os.path.abspath(video_rel)
        if not os.path.exists(video_path):
            print(f"[{cam_id}] Skipped (file not found: {video_path})")
            continue

        extractor = FrameExtractor(video_path, target_fps=5.0)
        tracker = ByteTracker(camera_id=cam_id, track_thresh=0.38, max_time_lost=15, min_hits=1, trajectory_max_len=25)
        rule_engine.reset_camera(cam_id)

        processed_frames = 0
        total_rule_lat = 0.0
        verified_events_cam = []
        candidate_events_cam = []

        # Process 25 frames (5 seconds of CCTV footage)
        for i in range(25):
            ok, frame, ts, f_idx = extractor.get_next_frame()
            if not ok or frame is None:
                continue

            dets, det_lat, w, h = detector.detect(frame, cam_id, ts, f_idx)
            tracks, trk_lat = tracker.update(dets, f_idx, ts, w, h)
            v_evts, c_evts, telemetry = rule_engine.evaluate(cam_id, tracks, ts, f_idx)

            processed_frames += 1
            total_rule_lat += telemetry.get("evaluationLatencyMs", 0.0)

            if v_evts:
                verified_events_cam.extend(v_evts)
            if c_evts:
                candidate_events_cam.extend(c_evts)

        avg_rule_lat = total_rule_lat / max(1, processed_frames)
        total_verified_all += len(verified_events_cam)

        print(f"\n--- {cam_id} ({os.path.basename(video_path)}) ---")
        print(f"Frames: {processed_frames} | Candidates Observed: {len(candidate_events_cam)} | Verified Events: {len(verified_events_cam)} | Avg Rule Latency: {avg_rule_lat:.3f}ms")

        if verified_events_cam:
            print("Verified Events Emitted:")
            for evt in verified_events_cam:
                print(f"  ★ [{evt['id']}] {evt['eventType']} @ {evt['videoTimestamp']:.2f}s | Track: {evt['trackDisplayId']} ({evt['objectClass'].upper()})")
                print(f"    Explanation: \"{evt['explanation']}\"")
        else:
            print("  (No verified events in first 5s window)")

        extractor.release()

    print("\n" + "=" * 80)
    print(f"VALIDATION SUMMARY: Verified Security Events across all camera feeds = {total_verified_all}")
    print("=" * 80)

if __name__ == "__main__":
    main()
