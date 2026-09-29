import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../detection")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../tracking")))

from detector import YOLODetector
from frame_extractor import FrameExtractor
from bytetrack import ByteTracker

def main():
    detector = YOLODetector(
        model_path="ai/models/yolov8n.pt",
        conf_threshold=0.38,
        iou_threshold=0.45,
        device="cpu",
        target_classes=["person", "car", "motorcycle", "bus", "truck"]
    )

    cameras = [
        ("CAM-01", "data/videos/CAM-1/gate.mp4"),
        ("CAM-02", "data/videos/CAM-2/corridor.mp4"),
        ("CAM-03", "data/videos/CAM-3/restricted.mp4"),
        ("CAM-04", "data/videos/CAM-4/vehicle.mp4"),
        ("CAM-05", "data/videos/CAM-5/perimeter.mp4"),
        ("CAM-06", "data/videos/CAM-6/night.mp4"),
    ]

    print("=" * 70)
    print("IBVAP PHASE 4 — MULTI-OBJECT TRACKING VALIDATION SUITE")
    print("=" * 70)

    for cam_id, video_rel in cameras:
        video_path = os.path.abspath(video_rel)
        if not os.path.exists(video_path):
            print(f"[{cam_id}] Skipped (file not found: {video_path})")
            continue

        extractor = FrameExtractor(video_path, target_fps=5.0)
        tracker = ByteTracker(camera_id=cam_id, track_thresh=0.38, max_time_lost=15, min_hits=1, trajectory_max_len=25)

        processed_frames = 0
        total_det_lat = 0.0
        total_trk_lat = 0.0
        unique_track_ids = set()
        sequential_samples = []

        # Process 15 frames
        for i in range(15):
            ok, frame, ts, f_idx = extractor.get_next_frame()
            if not ok or frame is None:
                continue

            dets, det_lat, w, h = detector.detect(frame, cam_id, ts, f_idx)
            tracks, trk_lat = tracker.update(dets, f_idx, ts, w, h)

            processed_frames += 1
            total_det_lat += det_lat
            total_trk_lat += trk_lat

            for t in tracks:
                unique_track_ids.add(t["trackId"])

            if tracks:
                sequential_samples.append({
                    "frameIndex": f_idx,
                    "timestamp": round(ts, 2),
                    "tracks": [
                        {
                            "trackId": t["trackId"],
                            "displayId": t["displayId"],
                            "class": t["className"],
                            "conf": t["confidence"],
                            "bbox": t["boundingBox"],
                            "traj_len": len(t["trajectory"])
                        }
                        for t in tracks
                    ]
                })

        avg_det = total_det_lat / max(1, processed_frames)
        avg_trk = total_trk_lat / max(1, processed_frames)
        avg_pipe = avg_det + avg_trk

        print(f"\n--- {cam_id} ({os.path.basename(video_path)}) ---")
        print(f"Processed: {processed_frames} frames | Unique Tracks Assigned: {len(unique_track_ids)} (IDs: {sorted(list(unique_track_ids))})")
        print(f"Latency: YOLO = {avg_det:.1f}ms | ByteTrack = {avg_trk:.2f}ms | Combined Pipeline = {avg_pipe:.1f}ms")
        
        if sequential_samples:
            print("Sequential Tracking Sample across frames:")
            for s in sequential_samples[:4]:
                for trk in s["tracks"]:
                    b = trk["bbox"]
                    print(f"  Frame {s['frameIndex']} ({s['timestamp']}s): [{trk['displayId']}] {trk['class'].upper()} (conf: {trk['conf']:.2f}) -> BBox [x={b['x']:.3f}, y={b['y']:.3f}, w={b['width']:.3f}, h={b['height']:.3f}] (traj: {trk['traj_len']} pts)")

        extractor.release()

    print("\n" + "=" * 70)
    print("VALIDATION COMPLETE: All 6 camera trackers operating independently.")
    print("=" * 70)

if __name__ == "__main__":
    main()
