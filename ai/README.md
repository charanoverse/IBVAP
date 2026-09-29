# IBVAP AI Subsystem (Phase 3 — AI Object Detection)

## 1. Overview

The IBVAP AI Subsystem provides real-time local object detection for perimeter surveillance and CCTV video feeds. It processes local video streams (`CAM-01` through `CAM-06`), extracts frames at a configurable sampling rate, executes YOLO neural network inference on CPU or GPU, and produces structured detection records with normalized bounding boxes and confidence scores.

---

## 2. Directory Structure

```
ai/
├── models/
│   ├── yolov8n.pt            # Cached local YOLOv8 nano model weights (~6.2 MB)
│   └── .gitkeep
├── detection/
│   ├── detector.py           # Core YOLODetector wrapper (pure detection, no tracking)
│   ├── frame_extractor.py    # OpenCV video decoder with configurable FPS sampling
│   └── service.py            # Multi-threaded camera workers & local HTTP service
├── processing/               # Reserved for future processing logic
├── tracking/                 # Reserved for Phase 4 tracking
└── README.md
```

---

## 3. Configuration & Parameters

The AI subsystem is fully configured through environment variables:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `AI_ENABLED` | `true` | Master toggle for the AI detection pipeline |
| `AI_MODEL` | `yolov8n.pt` | Model architecture name |
| `AI_MODEL_PATH` | `./ai/models/yolov8n.pt` | Path to local model weights |
| `AI_CONFIDENCE_THRESHOLD` | `0.40` | Minimum confidence score to accept detection |
| `AI_IOU_THRESHOLD` | `0.45` | NMS intersection-over-union threshold |
| `AI_INFERENCE_FPS` | `5` | Target frame sampling rate for inference (independent from display FPS) |
| `AI_DEVICE` | `auto` | Target compute hardware (`auto`, `cpu`, `cuda`) |
| `AI_CLASSES` | `person,car,motorcycle,bus,truck` | Comma-separated list of surveillance target classes |
| `AI_SERVICE_PORT` | `5001` | Local HTTP API port for AI communication |
| `AI_PERSISTENCE_ENABLED` | `true` | Periodic database persistence toggle |
| `AI_PERSISTENCE_INTERVAL` | `5` | Number of seconds between persisted detection snapshots |

---

## 4. API Endpoints

- `GET /health` / `GET /status`: Returns overall AI engine health, loaded model, device, and per-camera telemetry.
- `GET /cameras/<id>/detections`: Returns latest detection frame for specified camera.
- `GET /cameras/status`: Returns telemetry status for all cameras.
- `POST /cameras/<id>/control`: Controls pipeline state (`{"action": "pause" | "resume" | "restart"}`).

---

## 5. Explicit Phase 3 Boundaries

- **NO Track IDs**: Object detection produces per-frame bounding boxes and confidences only.
- **NO ByteTrack / DeepSORT**: Tracking is strictly reserved for Phase 4.
- **NO Event / Incident Generation**: Security rules and incidents are not triggered by pure object detections.
