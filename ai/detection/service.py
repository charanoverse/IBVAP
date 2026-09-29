import os
import sys
import time
import json
import logging
import threading
import argparse
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from typing import Dict, Any, Optional, List

# Ensure ai/detection, ai/tracking, and ai/rules are in sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
_parent_dir = os.path.abspath(os.path.join(_current_dir, ".."))
_tracking_dir = os.path.join(_parent_dir, "tracking")
_rules_dir = os.path.join(_parent_dir, "rules")
for p in [_current_dir, _parent_dir, _tracking_dir, _rules_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

from detector import YOLODetector, DEFAULT_CLASSES
from frame_extractor import FrameExtractor
from bytetrack import ByteTracker
from engine import RuleEngine

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [AI] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
logger = logging.getLogger("IBVAP.AIService")

class CameraPipelineWorker:
    """
    Independent background processing thread for a single camera stream.
    Runs YOLO detection, ByteTrack multi-object tracking, and Rule Engine spatial/temporal evaluation.
    """
    def __init__(
        self,
        camera_id: str,
        video_path: str,
        detector: YOLODetector,
        rule_engine: RuleEngine,
        target_fps: float = 5.0,
        track_thresh: float = 0.40,
        max_time_lost: int = 15,
        min_hits: int = 1,
        trajectory_max_len: int = 25,
    ):
        self.camera_id = camera_id
        self.video_path = video_path
        self.detector = detector
        self.rule_engine = rule_engine
        self.target_fps = target_fps
        self.is_running = False
        self.is_paused = False
        self.thread: Optional[threading.Thread] = None
        self.extractor: Optional[FrameExtractor] = None

        # Camera-local ByteTracker instance (Strictly 1:1 with camera)
        self.tracker = ByteTracker(
            camera_id=self.camera_id,
            track_thresh=track_thresh,
            match_thresh=0.70,
            second_match_thresh=0.50,
            unconfirmed_match_thresh=0.70,
            max_time_lost=max_time_lost,
            min_hits=min_hits,
            trajectory_max_len=trajectory_max_len,
        )

        # Telemetry & latest state
        self.status = "starting"
        self.latest_payload: Dict[str, Any] = {
            "cameraId": self.camera_id,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "frameIndex": 0,
            "frameTimestamp": 0.0,
            "videoTimestamp": 0.0,
            "duration": 0.0,
            "latencyMs": 0.0,
            "trackerLatencyMs": 0.0,
            "ruleLatencyMs": 0.0,
            "pipelineLatencyMs": 0.0,
            "detections": [],
            "tracks": [],
            "events": [],
            "candidateEvents": [],
            "ruleTelemetry": {
                "enabledRulesCount": 0,
                "activeRuleStatesCount": 0,
                "tracksEvaluatedCount": 0,
                "candidateEventsCount": 0,
                "verifiedEventsCount": 0,
                "evaluationLatencyMs": 0.0,
            },
            "activeTracksCount": 0,
            "activeRulesCount": 0,
            "verifiedEventsCount": 0,
            "cameraStatus": "starting",
        }
        self.timeline_cache: Dict[float, Dict[str, Any]] = {}
        self.recent_verified_events: List[Dict[str, Any]] = []
        self.lock = threading.Lock()
        self.processed_frames = 0
        self.total_detections_count = 0
        self.total_verified_events_count = 0
        self.last_detection_latency_ms = 0.0
        self.last_tracker_latency_ms = 0.0
        self.last_rule_latency_ms = 0.0
        self.last_pipeline_latency_ms = 0.0
        self.actual_fps = 0.0
        self.error_message: Optional[str] = None
        self.fps_frame_count = 0
        self.fps_start_time = time.time()
        self.last_frame_idx = -1

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.status = "starting"
        self.tracker.reset()
        self.rule_engine.reset_camera(self.camera_id)
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        logger.info(f"Started AI detection & tracking pipeline for {self.camera_id} ({self.video_path})")

    def pause(self):
        self.is_paused = True
        self.status = "paused"
        logger.info(f"Paused AI pipeline for {self.camera_id}")

    def resume(self):
        self.is_paused = False
        self.status = "running"
        self.tracker.reset()
        self.rule_engine.reset_camera(self.camera_id)
        logger.info(f"Resumed AI pipeline for {self.camera_id} (Tracker & Rule states reset)")

    def reset_tracker(self):
        with self.lock:
            self.tracker.reset()
            self.rule_engine.reset_camera(self.camera_id)
        logger.info(f"Explicitly reset ByteTracker & Rule state for {self.camera_id}")

    def reset_rules(self):
        with self.lock:
            self.rule_engine.reset_camera(self.camera_id)
        logger.info(f"Explicitly reset Rule state for {self.camera_id}")

    def stop(self):
        self.is_running = False
        self.status = "stopped"
        if self.extractor:
            self.extractor.release()
        self.tracker.reset()
        self.rule_engine.reset_camera(self.camera_id)
        logger.info(f"Stopped AI pipeline for {self.camera_id}")

    def _run_loop(self):
        try:
            self.extractor = FrameExtractor(self.video_path, self.target_fps)
            self.status = "running"
        except Exception as e:
            self.status = "error"
            self.error_message = str(e)
            logger.error(f"Failed to initialize FrameExtractor for {self.camera_id}: {e}")
            return

        interval = 1.0 / self.target_fps

        while self.is_running:
            loop_start = time.perf_counter()

            if self.is_paused:
                time.sleep(0.1)
                continue

            try:
                success, frame, frame_timestamp, frame_idx = self.extractor.get_next_frame()
                if not success or frame is None:
                    time.sleep(0.05)
                    continue

                # Check for video replay loop boundary
                if self.extractor.was_loop_reset or (self.last_frame_idx >= 0 and frame_idx < self.last_frame_idx):
                    logger.info(f"Video loop boundary detected for {self.camera_id} (rewind from F#{self.last_frame_idx} to F#{frame_idx}). Resetting Tracker and Rules.")
                    self.tracker.reset()
                    self.rule_engine.reset_camera(self.camera_id)

                self.last_frame_idx = frame_idx

                # 1. Step 1: Run YOLO object detection
                detections, det_latency_ms, w, h = self.detector.detect(
                    frame, self.camera_id, frame_timestamp, frame_idx
                )

                # 2. Step 2: Run ByteTrack multi-object tracking (Strictly after detection)
                tracks, tracker_latency_ms = self.tracker.update(
                    detections, frame_idx, frame_timestamp, w, h
                )

                # 3. Step 3: Run Rule Engine spatial & temporal evaluation (Strictly after tracking)
                events, candidate_events, rule_telemetry = self.rule_engine.evaluate(
                    self.camera_id, tracks, frame_timestamp, frame_idx
                )
                rule_latency_ms = rule_telemetry.get("evaluationLatencyMs", 0.0)

                pipeline_latency_ms = round(det_latency_ms + tracker_latency_ms + rule_latency_ms, 2)
                now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                duration = self.extractor.duration_sec if self.extractor else 0.0

                frame_payload = {
                    "cameraId": self.camera_id,
                    "timestamp": now_iso,
                    "frameIndex": frame_idx,
                    "frameTimestamp": round(frame_timestamp, 3),
                    "videoTimestamp": round(frame_timestamp, 3),
                    "duration": round(duration, 2),
                    "frameWidth": w,
                    "frameHeight": h,
                    "latencyMs": det_latency_ms,
                    "trackerLatencyMs": tracker_latency_ms,
                    "ruleLatencyMs": rule_latency_ms,
                    "pipelineLatencyMs": pipeline_latency_ms,
                    "detections": detections,
                    "tracks": tracks,
                    "events": events,
                    "candidateEvents": candidate_events,
                    "ruleTelemetry": rule_telemetry,
                    "activeTracksCount": len(tracks),
                    "activeRulesCount": rule_telemetry.get("enabledRulesCount", 0),
                    "verifiedEventsCount": len(events),
                    "cameraStatus": self.status,
                }

                with self.lock:
                    self.processed_frames += 1
                    self.last_detection_latency_ms = det_latency_ms
                    self.last_tracker_latency_ms = tracker_latency_ms
                    self.last_rule_latency_ms = rule_latency_ms
                    self.last_pipeline_latency_ms = pipeline_latency_ms
                    self.total_detections_count += len(detections)
                    if events:
                        self.total_verified_events_count += len(events)
                        for ev in events:
                            self.recent_verified_events.append(ev)
                        if len(self.recent_verified_events) > 100:
                            self.recent_verified_events = self.recent_verified_events[-100:]

                    self.latest_payload = frame_payload

                    # Cache frame in timeline (quantized to 1 decimal place)
                    quant_ts = round(frame_timestamp, 1)
                    self.timeline_cache[quant_ts] = {
                        "frameIndex": frame_idx,
                        "videoTimestamp": round(frame_timestamp, 3),
                        "detections": detections,
                        "tracks": tracks,
                        "events": events,
                        "candidateEvents": candidate_events,
                        "ruleTelemetry": rule_telemetry,
                        "activeTracksCount": len(tracks),
                        "latencyMs": det_latency_ms,
                        "trackerLatencyMs": tracker_latency_ms,
                        "ruleLatencyMs": rule_latency_ms,
                        "pipelineLatencyMs": pipeline_latency_ms,
                    }
                    # Cap cache size to avoid unbounded memory growth (keep up to 500 frames)
                    if len(self.timeline_cache) > 500:
                        oldest_keys = sorted(self.timeline_cache.keys())[:50]
                        for k in oldest_keys:
                            self.timeline_cache.pop(k, None)

                # Update measured actual FPS
                self.fps_frame_count += 1
                elapsed = time.time() - self.fps_start_time
                if elapsed >= 2.0:
                    self.actual_fps = round(self.fps_frame_count / elapsed, 1)
                    self.fps_frame_count = 0
                    self.fps_start_time = time.time()

            except Exception as e:
                logger.error(f"Error in pipeline worker for {self.camera_id}: {e}", exc_info=True)
                self.status = "error"
                self.error_message = str(e)
                time.sleep(0.5)

            # Sleep to maintain target FPS
            loop_time = time.perf_counter() - loop_start
            sleep_needed = interval - loop_time
            if sleep_needed > 0:
                time.sleep(sleep_needed)

    def get_latest_payload(self) -> Dict[str, Any]:
        with self.lock:
            payload = dict(self.latest_payload)
            payload["cameraStatus"] = self.status
            return payload

    def get_latest_tracks(self) -> List[Dict[str, Any]]:
        with self.lock:
            return list(self.latest_payload.get("tracks", []))

    def get_latest_events(self) -> List[Dict[str, Any]]:
        with self.lock:
            return list(self.latest_payload.get("events", []))

    def get_recent_events(self) -> List[Dict[str, Any]]:
        with self.lock:
            return list(self.recent_verified_events)

    def get_telemetry(self) -> Dict[str, Any]:
        with self.lock:
            enabled_rules = len(self.rule_engine.get_camera_rules(self.camera_id))
            return {
                "cameraId": self.camera_id,
                "status": self.status,
                "modelName": self.detector.model_name,
                "trackerName": "ByteTrack",
                "device": self.detector.device.upper(),
                "targetFps": self.target_fps,
                "actualFps": self.actual_fps or self.target_fps,
                "latencyMs": self.last_detection_latency_ms,
                "trackerLatencyMs": self.last_tracker_latency_ms,
                "ruleLatencyMs": self.last_rule_latency_ms,
                "pipelineLatencyMs": self.last_pipeline_latency_ms,
                "detectionsCount": len(self.latest_payload.get("detections", [])),
                "activeTracksCount": len(self.latest_payload.get("tracks", [])),
                "activeRulesCount": enabled_rules,
                "verifiedEventsCount": self.total_verified_events_count,
                "processedFrames": self.processed_frames,
                "lastInferenceTimestamp": self.latest_payload.get("timestamp"),
                "errorMessage": self.error_message,
            }


class AIServiceManager:
    """
    Central Manager managing YOLO model, ByteTrack trackers, and Rule Engine.
    """
    def __init__(
        self,
        model_path: str = "ai/models/yolov8n.pt",
        conf_threshold: float = 0.40,
        iou_threshold: float = 0.45,
        target_fps: float = 5.0,
        device: str = "auto",
        target_classes: Optional[list] = None,
        videos_dir: str = "data/videos",
        track_thresh: float = 0.40,
        max_time_lost: int = 15,
        min_hits: int = 1,
    ):
        self.videos_dir = os.path.abspath(videos_dir)
        self.target_fps = target_fps
        self.track_thresh = track_thresh
        self.max_time_lost = max_time_lost
        self.min_hits = min_hits
        self.detector = YOLODetector(
            model_path=model_path,
            conf_threshold=conf_threshold,
            iou_threshold=iou_threshold,
            device=device,
            target_classes=target_classes,
        )
        self.rule_engine = RuleEngine(
            rules_path="config/rules/demo_rules.json",
            zones_path="config/zones/demo_zones.json",
            lines_path="config/zones/demo_lines.json",
        )
        self.workers: Dict[str, CameraPipelineWorker] = {}
        self._init_camera_workers()

    def _init_camera_workers(self):
        camera_video_map = {
            "CAM-01": ["CAM-1/gate.mp4", "cam-01/gate.mp4", "gate.mp4"],
            "CAM-02": ["CAM-2/corridor.mp4", "cam-02/corridor.mp4", "corridor.mp4"],
            "CAM-03": ["CAM-3/restricted.mp4", "cam-03/restricted.mp4", "restricted.mp4"],
            "CAM-04": ["CAM-4/vehicle.mp4", "cam-04/vehicles.mp4", "cam-04/vehicle.mp4", "vehicle.mp4"],
            "CAM-05": ["CAM-5/perimeter.mp4", "cam-05/perimeter.mp4", "perimeter.mp4"],
            "CAM-06": ["CAM-6/night.mp4", "cam-06/night.mp4", "night.mp4"],
        }

        for cam_id, relative_paths in camera_video_map.items():
            matched_path = None
            for rel in relative_paths:
                full_p = os.path.join(self.videos_dir, rel)
                if os.path.exists(full_p):
                    matched_path = full_p
                    break

            if matched_path:
                worker = CameraPipelineWorker(
                    camera_id=cam_id,
                    video_path=matched_path,
                    detector=self.detector,
                    rule_engine=self.rule_engine,
                    target_fps=self.target_fps,
                    track_thresh=self.track_thresh,
                    max_time_lost=self.max_time_lost,
                    min_hits=self.min_hits,
                )
                self.workers[cam_id] = worker
                worker.start()
            else:
                logger.warning(f"Video file for {cam_id} not found in {self.videos_dir}")

    def get_health(self) -> Dict[str, Any]:
        total_dets = sum(w.total_detections_count for w in self.workers.values())
        total_tracks = sum(len(w.get_latest_tracks()) for w in self.workers.values())
        total_events = sum(w.total_verified_events_count for w in self.workers.values())
        avg_det_lat = (
            sum(w.last_detection_latency_ms for w in self.workers.values()) / max(1, len(self.workers))
        )
        avg_trk_lat = (
            sum(w.last_tracker_latency_ms for w in self.workers.values()) / max(1, len(self.workers))
        )
        avg_rule_lat = (
            sum(w.last_rule_latency_ms for w in self.workers.values()) / max(1, len(self.workers))
        )
        return {
            "status": "online",
            "modelName": self.detector.model_name,
            "trackerName": "ByteTrack",
            "device": self.detector.device.upper(),
            "supportedClasses": self.detector.target_classes,
            "activeCamerasCount": len(self.workers),
            "totalDetectionsProcessed": total_dets,
            "totalTracksActive": total_tracks,
            "totalEventsVerified": total_events,
            "avgLatencyMs": round(avg_det_lat, 1),
            "avgTrackerLatencyMs": round(avg_trk_lat, 1),
            "avgRuleLatencyMs": round(avg_rule_lat, 2),
            "cameras": {cid: w.get_telemetry() for cid, w in self.workers.items()},
        }

    def get_camera_detections(self, camera_id: str, timestamp: Optional[float] = None) -> Optional[Dict[str, Any]]:
        worker = self.workers.get(camera_id) or self.workers.get(camera_id.upper())
        if not worker:
            return None
        
        payload = worker.get_latest_payload()
        if timestamp is not None and worker.timeline_cache:
            best_diff = 1.0
            best_frame = None
            for cached_ts, cdata in worker.timeline_cache.items():
                diff = abs(cached_ts - timestamp)
                if diff < best_diff:
                    best_diff = diff
                    best_frame = cdata
            if best_frame:
                payload["frameIndex"] = best_frame["frameIndex"]
                payload["videoTimestamp"] = best_frame["videoTimestamp"]
                payload["detections"] = best_frame["detections"]
                payload["tracks"] = best_frame.get("tracks", [])
                payload["events"] = best_frame.get("events", [])
                payload["candidateEvents"] = best_frame.get("candidateEvents", [])
                payload["ruleTelemetry"] = best_frame.get("ruleTelemetry")
                payload["activeTracksCount"] = best_frame.get("activeTracksCount", len(payload["tracks"]))
                payload["latencyMs"] = best_frame["latencyMs"]
                payload["trackerLatencyMs"] = best_frame.get("trackerLatencyMs", 0.0)
                payload["ruleLatencyMs"] = best_frame.get("ruleLatencyMs", 0.0)
                payload["pipelineLatencyMs"] = best_frame.get("pipelineLatencyMs", best_frame["latencyMs"])
        return payload

    def get_camera_tracks(self, camera_id: str) -> Optional[List[Dict[str, Any]]]:
        worker = self.workers.get(camera_id) or self.workers.get(camera_id.upper())
        if not worker:
            return None
        return worker.get_latest_tracks()

    def get_camera_events(self, camera_id: str) -> Optional[List[Dict[str, Any]]]:
        worker = self.workers.get(camera_id) or self.workers.get(camera_id.upper())
        if not worker:
            return None
        return worker.get_recent_events()

    def get_camera_rules(self, camera_id: str) -> List[Dict[str, Any]]:
        return self.rule_engine.get_camera_rules(camera_id)

    def get_camera_zones(self, camera_id: str) -> List[Dict[str, Any]]:
        return self.rule_engine.get_camera_zones(camera_id)

    def get_camera_lines(self, camera_id: str) -> List[Dict[str, Any]]:
        return self.rule_engine.get_camera_lines(camera_id)

    def toggle_rule(self, rule_id: str, enabled: bool) -> bool:
        return self.rule_engine.toggle_rule(rule_id, enabled)

    def get_camera_timeline(self, camera_id: str) -> Optional[List[Dict[str, Any]]]:
        worker = self.workers.get(camera_id) or self.workers.get(camera_id.upper())
        if not worker:
            return None
        with worker.lock:
            sorted_items = sorted(worker.timeline_cache.values(), key=lambda x: x.get("videoTimestamp", 0))
            return sorted_items

    def control_camera(self, camera_id: str, action: str) -> bool:
        worker = self.workers.get(camera_id) or self.workers.get(camera_id.upper())
        if not worker:
            return False
        if action == "pause":
            worker.pause()
        elif action in ("resume", "start"):
            worker.resume()
        elif action == "reset_tracker":
            worker.reset_tracker()
        elif action == "reset_rules":
            worker.reset_rules()
        elif action == "restart":
            worker.stop()
            worker.start()
        elif action == "stop":
            worker.stop()
        return True


def create_handler(manager: AIServiceManager):
    class AIServiceHandler(BaseHTTPRequestHandler):
        def _send_json(self, status: int, data: Any):
            body = json.dumps(data).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def do_GET(self):
            parsed = urlparse(self.path)
            path = parsed.path.rstrip("/")
            query_params = parse_qs(parsed.query)

            if path in ("/health", "/api/ai/health", "/api/ai/status", "/status"):
                self._send_json(200, {"success": True, "data": manager.get_health()})
                return

            if path == "/rules" or path == "/api/rules":
                self._send_json(200, {"success": True, "data": list(manager.rule_engine.rules.values())})
                return

            if path == "/zones" or path == "/api/zones":
                self._send_json(200, {"success": True, "data": list(manager.rule_engine.zones.values())})
                return

            if path == "/lines" or path == "/api/lines":
                self._send_json(200, {"success": True, "data": list(manager.rule_engine.lines.values())})
                return

            if path.startswith("/cameras/") and path.endswith("/rules"):
                parts = path.split("/")
                cam_id = parts[2]
                rules = manager.get_camera_rules(cam_id)
                self._send_json(200, {"success": True, "data": rules})
                return

            if path.startswith("/cameras/") and path.endswith("/zones"):
                parts = path.split("/")
                cam_id = parts[2]
                zones = manager.get_camera_zones(cam_id)
                self._send_json(200, {"success": True, "data": zones})
                return

            if path.startswith("/cameras/") and path.endswith("/lines"):
                parts = path.split("/")
                cam_id = parts[2]
                lines = manager.get_camera_lines(cam_id)
                self._send_json(200, {"success": True, "data": lines})
                return

            if path.startswith("/cameras/") and path.endswith("/events"):
                parts = path.split("/")
                cam_id = parts[2]
                events = manager.get_camera_events(cam_id)
                if events is not None:
                    self._send_json(200, {"success": True, "data": events})
                else:
                    self._send_json(404, {"success": False, "error": f"Camera {cam_id} not found"})
                return

            if path.startswith("/cameras/") and path.endswith("/timeline"):
                parts = path.split("/")
                cam_id = parts[2]
                timeline = manager.get_camera_timeline(cam_id)
                if timeline is not None:
                    self._send_json(200, {"success": True, "data": timeline})
                else:
                    self._send_json(404, {"success": False, "error": f"Camera {cam_id} not found"})
                return

            if path.startswith("/cameras/") and path.endswith("/tracks"):
                parts = path.split("/")
                cam_id = parts[2]
                tracks = manager.get_camera_tracks(cam_id)
                if tracks is not None:
                    self._send_json(200, {"success": True, "data": tracks})
                else:
                    self._send_json(404, {"success": False, "error": f"Camera {cam_id} not found"})
                return

            if path.startswith("/cameras/") and path.endswith("/detections"):
                parts = path.split("/")
                cam_id = parts[2]
                ts_arg = None
                if "timestamp" in query_params:
                    try:
                        ts_arg = float(query_params["timestamp"][0])
                    except ValueError:
                        pass
                payload = manager.get_camera_detections(cam_id, ts_arg)
                if payload:
                    self._send_json(200, {"success": True, "data": payload})
                else:
                    self._send_json(404, {"success": False, "error": f"Camera {cam_id} not found"})
                return

            if path == "/cameras/status":
                self._send_json(200, {
                    "success": True,
                    "data": {cid: w.get_telemetry() for cid, w in manager.workers.items()}
                })
                return

            if path == "/cameras/all/detections":
                all_payloads = {cid: w.get_latest_payload() for cid, w in manager.workers.items()}
                self._send_json(200, {"success": True, "data": all_payloads})
                return

            if path == "/cameras/all/tracks":
                all_tracks = {cid: w.get_latest_tracks() for cid, w in manager.workers.items()}
                self._send_json(200, {"success": True, "data": all_tracks})
                return

            if path == "/cameras/all/events":
                all_events = {cid: w.get_recent_events() for cid, w in manager.workers.items()}
                self._send_json(200, {"success": True, "data": all_events})
                return

            self._send_json(404, {"success": False, "error": f"Endpoint not found: {path}"})

        def do_POST(self):
            parsed = urlparse(self.path)
            path = parsed.path.rstrip("/")

            content_length = int(self.headers.get("Content-Length", 0))
            body_data = {}
            if content_length > 0:
                raw_body = self.rfile.read(content_length)
                try:
                    body_data = json.loads(raw_body.decode("utf-8"))
                except Exception:
                    body_data = {}

            if path in ("/rules/toggle", "/api/rules/toggle"):
                rule_id = body_data.get("ruleId")
                enabled = body_data.get("enabled", True)
                if not rule_id:
                    self._send_json(400, {"success": False, "error": "ruleId is required"})
                    return
                ok = manager.toggle_rule(rule_id, enabled)
                if ok:
                    self._send_json(200, {"success": True, "message": f"Rule {rule_id} enabled set to {enabled}"})
                else:
                    self._send_json(404, {"success": False, "error": f"Rule {rule_id} not found"})
                return

            if path.startswith("/cameras/") and path.endswith("/control"):
                parts = path.split("/")
                cam_id = parts[2]
                action = body_data.get("action", "resume")
                ok = manager.control_camera(cam_id, action)
                if ok:
                    self._send_json(200, {"success": True, "message": f"Action {action} applied to {cam_id}"})
                else:
                    self._send_json(404, {"success": False, "error": f"Camera {cam_id} not found"})
                return

            self._send_json(404, {"success": False, "error": f"Endpoint not found: {path}"})

        def log_message(self, format, *args):
            if "200" not in str(args):
                logger.debug(f"{self.address_string()} - {format % args}")

    return AIServiceHandler


def main():
    parser = argparse.ArgumentParser(description="IBVAP AI Object Detection, Tracking & Rule Engine Service")
    parser.add_argument("--port", type=int, default=int(os.environ.get("AI_SERVICE_PORT", 5001)))
    parser.add_argument("--model", type=str, default=os.environ.get("AI_MODEL_PATH", "ai/models/yolov8n.pt"))
    parser.add_argument("--conf", type=float, default=float(os.environ.get("AI_CONFIDENCE_THRESHOLD", 0.40)))
    parser.add_argument("--iou", type=float, default=float(os.environ.get("AI_IOU_THRESHOLD", 0.45)))
    parser.add_argument("--fps", type=float, default=float(os.environ.get("AI_INFERENCE_FPS", 5.0)))
    parser.add_argument("--device", type=str, default=os.environ.get("AI_DEVICE", "auto"))
    parser.add_argument("--videos-dir", type=str, default=os.environ.get("STORAGE_VIDEOS_PATH", "data/videos"))
    args = parser.parse_args()

    classes_str = os.environ.get("AI_CLASSES", "person,car,motorcycle,bus,truck")
    target_classes = [c.strip().lower() for c in classes_str.split(",") if c.strip()]

    logger.info(f"Starting IBVAP AI Service with YOLOv8 + ByteTrack + Rule Engine on port {args.port} (Model: {args.model}, FPS: {args.fps}, Device: {args.device})")

    manager = AIServiceManager(
        model_path=args.model,
        conf_threshold=args.conf,
        iou_threshold=args.iou,
        target_fps=args.fps,
        device=args.device,
        target_classes=target_classes,
        videos_dir=args.videos_dir,
    )

    server_address = ("127.0.0.1", args.port)
    httpd = HTTPServer(server_address, create_handler(manager))
    logger.info(f"AI Service HTTP server listening on http://127.0.0.1:{args.port}")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down AI service...")
        for worker in manager.workers.values():
            worker.stop()
        httpd.server_close()
        logger.info("AI service stopped.")

if __name__ == "__main__":
    main()

