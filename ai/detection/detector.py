import time
import os
import uuid
import logging
from typing import List, Dict, Any, Optional, Tuple
import torch
from ultralytics import YOLO

logger = logging.getLogger("IBVAP.YOLODetector")

DEFAULT_CLASSES = ["person", "car", "motorcycle", "bus", "truck"]

class YOLODetector:
    """
    Core YOLO Object Detection Engine for IBVAP Phase 3.
    Pure object detection without persistent tracking IDs or trajectory maintenance.
    """
    def __init__(
        self,
        model_path: str = "ai/models/yolov8n.pt",
        conf_threshold: float = 0.40,
        iou_threshold: float = 0.45,
        device: str = "auto",
        target_classes: Optional[List[str]] = None,
    ):
        self.model_path = os.path.abspath(model_path)
        self.conf_threshold = float(conf_threshold)
        self.iou_threshold = float(iou_threshold)
        self.target_classes = [c.lower() for c in (target_classes or DEFAULT_CLASSES)]

        # Determine target device
        if device == "auto":
            self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        elif device.lower() in ("cuda", "gpu") and torch.cuda.is_available():
            self.device = "cuda:0"
        else:
            self.device = "cpu"

        logger.info(f"Initializing YOLO Model from '{self.model_path}' on device '{self.device}'...")
        
        if not os.path.exists(self.model_path):
            # If not in exact path, try ultralytics default name
            base_name = os.path.basename(self.model_path)
            logger.info(f"Model file not found at '{self.model_path}', falling back to '{base_name}'")
            self.model = YOLO(base_name)
        else:
            self.model = YOLO(self.model_path)

        self.model_name = os.path.basename(self.model_path)
        logger.info(f"YOLO Model '{self.model_name}' successfully loaded. Target classes: {self.target_classes}")

    def detect(
        self,
        frame: any,
        camera_id: str,
        frame_timestamp: float = 0.0,
        frame_index: int = 0,
    ) -> Tuple[List[Dict[str, Any]], float, int, int]:
        """
        Runs object detection on a single video frame.
        
        Returns:
            Tuple of (detections_list, latency_ms, frame_width, frame_height)
        """
        if frame is None:
            return [], 0.0, 0, 0

        h, w = frame.shape[:2]
        start_time = time.perf_counter()

        # Run inference (Pure detection, no tracking)
        results = self.model(
            frame,
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            device=self.device,
            verbose=False,
        )

        latency_ms = (time.perf_counter() - start_time) * 1000.0
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        detections: List[Dict[str, Any]] = []

        if len(results) > 0 and results[0].boxes is not None:
            boxes = results[0].boxes
            for box in boxes:
                cls_id = int(box.cls[0].item())
                class_name = self.model.names.get(cls_id, f"class_{cls_id}").lower()
                confidence = float(box.conf[0].item())

                # Filter to surveillance target classes
                if self.target_classes and class_name not in self.target_classes:
                    continue

                if confidence < self.conf_threshold:
                    continue

                # Coordinates in xyxy (pixels)
                x1, y1, x2, y2 = box.xyxy[0].tolist()

                # Convert to normalized coordinates (0.0 to 1.0)
                norm_x = max(0.0, min(1.0, x1 / w))
                norm_y = max(0.0, min(1.0, y1 / h))
                norm_w = max(0.0, min(1.0, (x2 - x1) / w))
                norm_h = max(0.0, min(1.0, (y2 - y1) / h))

                detection_record = {
                    "id": f"det-{camera_id.lower()}-{uuid.uuid4().hex[:10]}",
                    "cameraId": camera_id,
                    "timestamp": now_iso,
                    "frameIndex": frame_index,
                    "frameTimestamp": round(frame_timestamp, 3),
                    "videoTimestamp": round(frame_timestamp, 3),
                    "objectClass": class_name,
                    "classId": cls_id,
                    "confidence": round(confidence, 4),
                    "boundingBox": {
                        "x": round(norm_x, 4),
                        "y": round(norm_y, 4),
                        "width": round(norm_w, 4),
                        "height": round(norm_h, 4),
                    },
                    "frameWidth": w,
                    "frameHeight": h,
                    "trackRef": None, # STRICTLY NO TRACK ID IN PHASE 3
                    "createdAt": now_iso,
                }
                detections.append(detection_record)

        return detections, round(latency_ms, 2), w, h
