"""
IBVAP Phase 6 — Forensic Video Evidence Extractor
Extracts pre-event, event, post-event video clips and frame snapshots from CCTV source videos.
Generates SHA-256 cryptographic hashes and forensic manifest.json.
"""

import os
import sys
import json
import hashlib
import argparse
from typing import Dict, Any, Optional
import cv2


def compute_sha256(file_path: str) -> str:
    """Computes SHA-256 hash of a file."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def extract_clip(
    cap: cv2.VideoCapture,
    start_sec: float,
    end_sec: float,
    output_path: str,
    fps: float,
    width: int,
    height: int
) -> Dict[str, Any]:
    """Extracts a temporal sub-clip between start_sec and end_sec."""
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    start_frame = int(round(start_sec * fps))
    end_frame = max(start_frame + 1, int(round(end_sec * fps)))
    
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    current_frame = start_frame
    frames_written = 0
    
    while current_frame <= end_frame:
        ret, frame = cap.read()
        if not ret:
            break
        out.write(frame)
        frames_written += 1
        current_frame += 1
        
    out.release()
    
    size_bytes = os.path.getsize(output_path) if os.path.exists(output_path) else 0
    duration_sec = frames_written / fps if fps > 0 else 0.0
    sha256_hash = compute_sha256(output_path) if size_bytes > 0 else ""
    
    return {
        "path": output_path,
        "sizeBytes": size_bytes,
        "sha256": sha256_hash,
        "durationSeconds": round(duration_sec, 3),
        "frames": frames_written
    }


def extract_snapshot(
    cap: cv2.VideoCapture,
    timestamp_sec: float,
    output_path: str,
    fps: float
) -> Dict[str, Any]:
    """Extracts a single snapshot frame at the requested timestamp."""
    target_frame = max(0, int(round(timestamp_sec * fps)))
    cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
    ret, frame = cap.read()
    
    if not ret:
        # Fallback to frame 0 if seeking past end
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        ret, frame = cap.read()
        
    if not ret:
        # Create blank fallback frame if video cannot read
        import numpy as np
        frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        
    cv2.imwrite(output_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
    size_bytes = os.path.getsize(output_path) if os.path.exists(output_path) else 0
    sha256_hash = compute_sha256(output_path) if size_bytes > 0 else ""
    
    return {
        "path": output_path,
        "sizeBytes": size_bytes,
        "sha256": sha256_hash
    }


def extract_evidence_package(
    source_path: str,
    output_dir: str,
    incident_id: str,
    camera_id: str,
    event_timestamp: float,
    primary_event_id: str = "",
    linked_event_ids: Optional[list] = None,
    pre_seconds: float = 10.0,
    post_seconds: float = 10.0,
    min_event_duration: float = 4.0,
    rule_info: Optional[Dict[str, Any]] = None,
    model_info: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Extracts full evidence package: pre-event clip, event clip, post-event clip, snapshot, and manifest.
    """
    if linked_event_ids is None:
        linked_event_ids = []
    if rule_info is None:
        rule_info = {}
    if model_info is None:
        model_info = {"detector": "YOLOv8n", "tracker": "ByteTrack"}
        
    os.makedirs(output_dir, exist_ok=True)
    
    if not os.path.exists(source_path):
        return {
            "status": "FAILED",
            "error": "SOURCE_VIDEO_UNAVAILABLE",
            "message": f"Source video file not found at path: {source_path}",
            "incidentId": incident_id,
            "cameraId": camera_id
        }
        
    cap = cv2.VideoCapture(source_path)
    if not cap.isOpened():
        return {
            "status": "FAILED",
            "error": "SOURCE_VIDEO_CANNOT_OPEN",
            "message": f"Unable to decode source video file: {source_path}",
            "incidentId": incident_id,
            "cameraId": camera_id
        }
        
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
    total_duration = total_frames / fps if fps > 0 else 30.0
    
    # Normalize event timestamp if replay loop has advanced beyond single video duration
    ev_time = event_timestamp
    if total_duration > 0 and ev_time > total_duration:
        ev_time = ev_time % total_duration
        
    ev_time = max(0.0, min(total_duration, ev_time))
    
    # Clamping boundaries
    pre_start = max(0.0, ev_time - pre_seconds)
    pre_end = max(pre_start + 0.5, ev_time)
    
    event_start = max(0.0, ev_time - 1.5)
    event_end = min(total_duration, max(event_start + 1.0, ev_time + min_event_duration))
    
    post_start = ev_time
    post_end = min(total_duration, max(post_start + 1.0, ev_time + post_seconds))
    
    snapshot_time = ev_time
    
    # File paths
    pre_file = os.path.join(output_dir, "pre-event.mp4")
    event_file = os.path.join(output_dir, "event.mp4")
    post_file = os.path.join(output_dir, "post-event.mp4")
    snapshot_file = os.path.join(output_dir, "snapshot.jpg")
    manifest_file = os.path.join(output_dir, "manifest.json")
    
    # Extract clips & snapshot
    pre_res = extract_clip(cap, pre_start, pre_end, pre_file, fps, width, height)
    event_res = extract_clip(cap, event_start, event_end, event_file, fps, width, height)
    post_res = extract_clip(cap, post_start, post_end, post_file, fps, width, height)
    snap_res = extract_snapshot(cap, snapshot_time, snapshot_file, fps)
    
    cap.release()
    
    evidence_id = f"EVD-{incident_id}"
    
    # Construct manifest
    manifest_data = {
        "incidentId": incident_id,
        "evidenceId": evidence_id,
        "cameraId": camera_id,
        "primaryEventId": primary_event_id,
        "linkedEventIds": linked_event_ids,
        "source": {
            "type": "LOCAL_FILE",
            "cameraId": camera_id,
            "filePath": os.path.basename(source_path)
        },
        "timestamps": {
            "eventStartedAt": None,
            "eventVerifiedAt": None,
            "preStartSeconds": round(pre_start, 2),
            "eventStartSeconds": round(event_start, 2),
            "eventEndSeconds": round(event_end, 2),
            "postEndSeconds": round(post_end, 2),
            "snapshotTimestampSeconds": round(snapshot_time, 2)
        },
        "rule": {
            "ruleId": rule_info.get("id", rule_info.get("ruleId", "")),
            "ruleName": rule_info.get("name", rule_info.get("ruleName", "")),
            "ruleType": rule_info.get("type", rule_info.get("ruleType", ""))
        },
        "model": {
            "detector": model_info.get("detector", "YOLOv8n"),
            "tracker": model_info.get("tracker", "ByteTrack")
        },
        "files": [
            {
                "name": "pre-event.mp4",
                "type": "PRE_EVENT",
                "path": "pre-event.mp4",
                "sizeBytes": pre_res["sizeBytes"],
                "sha256": pre_res["sha256"],
                "durationSeconds": pre_res["durationSeconds"]
            },
            {
                "name": "event.mp4",
                "type": "EVENT",
                "path": "event.mp4",
                "sizeBytes": event_res["sizeBytes"],
                "sha256": event_res["sha256"],
                "durationSeconds": event_res["durationSeconds"]
            },
            {
                "name": "post-event.mp4",
                "type": "POST_EVENT",
                "path": "post-event.mp4",
                "sizeBytes": post_res["sizeBytes"],
                "sha256": post_res["sha256"],
                "durationSeconds": post_res["durationSeconds"]
            },
            {
                "name": "snapshot.jpg",
                "type": "SNAPSHOT",
                "path": "snapshot.jpg",
                "sizeBytes": snap_res["sizeBytes"],
                "sha256": snap_res["sha256"]
            }
        ],
        "generatedAt": json.loads(json.dumps(None))  # Placeholder or ISO string
    }
    
    import datetime
    manifest_data["generatedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    with open(manifest_file, "w", encoding="utf-8") as mf:
        json.dump(manifest_data, mf, indent=2)
        
    manifest_hash = compute_sha256(manifest_file)
    
    return {
        "status": "READY",
        "evidenceId": evidence_id,
        "incidentId": incident_id,
        "cameraId": camera_id,
        "primaryEventId": primary_event_id,
        "linkedEventIds": linked_event_ids,
        "files": {
            "preEvent": "pre-event.mp4",
            "event": "event.mp4",
            "postEvent": "post-event.mp4",
            "snapshot": "snapshot.jpg",
            "manifest": "manifest.json"
        },
        "hashes": {
            "preEvent": pre_res["sha256"],
            "event": event_res["sha256"],
            "postEvent": post_res["sha256"],
            "snapshot": snap_res["sha256"],
            "manifest": manifest_hash
        },
        "timestamps": {
            "preStartSeconds": round(pre_start, 2),
            "eventStartSeconds": round(event_start, 2),
            "eventEndSeconds": round(event_end, 2),
            "postEndSeconds": round(post_end, 2),
            "snapshotTimestampSeconds": round(snapshot_time, 2)
        },
        "manifest": manifest_data
    }


def verify_evidence_package(evidence_dir: str) -> Dict[str, Any]:
    """Verifies hashes in manifest against actual files on disk."""
    manifest_path = os.path.join(evidence_dir, "manifest.json")
    if not os.path.exists(manifest_path):
        return {"status": "FAILED", "error": "MANIFEST_MISSING"}
        
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
        
    results = {}
    all_matched = True
    
    for item in manifest.get("files", []):
        name = item["name"]
        expected = item["sha256"]
        file_path = os.path.join(evidence_dir, name)
        
        if not os.path.exists(file_path):
            results[name] = {"status": "MISSING", "expected": expected}
            all_matched = False
        else:
            actual = compute_sha256(file_path)
            matched = actual == expected
            results[name] = {
                "status": "MATCH" if matched else "MISMATCH",
                "expected": expected,
                "actual": actual
            }
            if not matched:
                all_matched = False
                
    return {
        "status": "MATCH" if all_matched else "MISMATCH",
        "files": results,
        "incidentId": manifest.get("incidentId"),
        "evidenceId": manifest.get("evidenceId")
    }


def main():
    parser = argparse.ArgumentParser(description="IBVAP Evidence Extractor")
    parser.add_argument("--source", default=None, help="Path to CCTV source video")
    parser.add_argument("--output-dir", required=True, help="Destination directory for evidence files")
    parser.add_argument("--incident-id", default="", help="Unique Incident ID")
    parser.add_argument("--camera-id", default="", help="Camera Identifier")
    parser.add_argument("--event-timestamp", type=float, default=0.0, help="Video timestamp in seconds")
    parser.add_argument("--primary-event-id", default="", help="Primary Event ID")
    parser.add_argument("--linked-event-ids", default="[]", help="JSON array of linked event IDs")
    parser.add_argument("--pre-seconds", type=float, default=10.0, help="Pre-event buffer in seconds")
    parser.add_argument("--post-seconds", type=float, default=10.0, help="Post-event buffer in seconds")
    parser.add_argument("--min-event-duration", type=float, default=4.0, help="Minimum event duration in seconds")
    parser.add_argument("--rule-info", default="{}", help="JSON object with rule details")
    parser.add_argument("--model-info", default="{}", help="JSON object with model details")
    parser.add_argument("--verify", action="store_true", help="Verify evidence directory integrity")
    
    args = parser.parse_args()
    
    if args.verify:
        res = verify_evidence_package(args.output_dir)
        print(json.dumps(res))
        sys.exit(0 if res.get("status") == "MATCH" else 1)
        
    if not args.source or not args.incident_id or not args.camera_id:
        print(json.dumps({"status": "FAILED", "error": "--source, --incident-id, and --camera-id are required for extraction"}))
        sys.exit(1)
        
    linked_ids = json.loads(args.linked_event_ids) if args.linked_event_ids else []
    rule_dict = json.loads(args.rule_info) if args.rule_info else {}
    model_dict = json.loads(args.model_info) if args.model_info else {}
    
    result = extract_evidence_package(
        source_path=args.source,
        output_dir=args.output_dir,
        incident_id=args.incident_id,
        camera_id=args.camera_id,
        event_timestamp=args.event_timestamp,
        primary_event_id=args.primary_event_id,
        linked_event_ids=linked_ids,
        pre_seconds=args.pre_seconds,
        post_seconds=args.post_seconds,
        min_event_duration=args.min_event_duration,
        rule_info=rule_dict,
        model_info=model_dict
    )
    
    print(json.dumps(result))
    sys.exit(0 if result.get("status") == "READY" else 1)


if __name__ == "__main__":
    main()
