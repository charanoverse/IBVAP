# IBVAP Developer Guide (Phase 6 — Incident Management, Evidence Capture & Operator Review)

This document provides setup, development workflow, configuration specifications, and testing instructions for the **Intelligent Border Video Analytics Platform (IBVAP)**.

---

## 1. Prerequisites

- **Node.js**: `v20.0.0` or later (tested on Node.js `v23.0.0`)
- **npm**: `v9.0.0` or later (tested on npm `v10.9.0`)
- **Python**: `3.10`–`3.12` with `torch`, `ultralytics`, `opencv-python`, and `scipy` installed
- **Operating System**: Windows / Linux / macOS (CPU & CUDA auto-detected)

---

## 2. Installation & Quickstart

Clone the repository and install all dependencies:

```bash
# 1. Install Node.js workspace dependencies
npm install

# 2. Setup local environment configuration
cp .env.example .env

# 3. Initialize SQLite database with demo cameras, tracks, events, and incidents schema
npm run db:init

# 4. Launch backend and frontend development servers concurrently
npm run dev
```

The frontend command center will be accessible at `http://localhost:3000` with the backend API running at `http://localhost:4000` and Python AI service at `http://127.0.0.1:5001`.

---

## 3. Phase 6 Incident Management & Evidence Capture Architecture

### 3.1 Declarative Incident Policies (`config/incidents/incident_policies.json`)
```json
{
  "version": "1.0",
  "policies": [
    {
      "eventType": "ZONE_ENTRY",
      "ruleType": "ZONE_ENTRY",
      "createIncident": true,
      "defaultPriority": "HIGH",
      "priorityReasonTemplate": "High priority: Sterile / Restricted zone entry breach detected by rule \"{ruleName}\" on camera {cameraId}.",
      "aggregateWith": ["DWELL", "ZONE_EXIT"],
      "aggregationWindowSeconds": 15.0
    }
  ]
}
```

### 3.2 Python Forensic Evidence Extractor (`ai/processing/evidence_extractor.py`)
- **Extraction Command**:
  ```bash
  C:\Python312\python.exe ai/processing/evidence_extractor.py \
    --source data/videos/CAM-3/restricted.mp4 \
    --output-dir data/evidence/INC-000101 \
    --incident-id INC-000101 \
    --camera-id CAM-03 \
    --event-timestamp 4.0 \
    --primary-event-id EVT-001
  ```
- **Integrity Verification Command**:
  ```bash
  C:\Python312\python.exe ai/processing/evidence_extractor.py \
    --output-dir data/evidence/INC-000101 \
    --verify
  ```

### 3.3 Incident & Evidence REST API Endpoints

- `GET /api/incidents`: Query incidents with filters (`state`, `priority`, `cameraId`, `search`, `limit`, `offset`).
- `GET /api/incidents/metrics`: Active, high priority, acknowledged, and closed incident metrics.
- `GET /api/incidents/:id`: Retrieve single incident by technical ID.
- `GET /api/incidents/:id/evidence`: Retrieve evidence package metadata.
- `GET /api/incidents/:id/timeline`: Unified chronological incident milestone timeline.
- `PATCH /api/incidents/:id/acknowledge`: Operator acknowledgement transition.
- `PATCH /api/incidents/:id/review`: Operator start review transition.
- `PATCH /api/incidents/:id/escalate`: Incident escalation with justification.
- `PATCH /api/incidents/:id/close`: Incident resolution with disposition (`CONFIRMED_ACTIVITY`, `BENIGN_ACTIVITY`, `FALSE_ALERT`).
- `POST /api/incidents/:id/notes`: Add operator timestamped note to incident record.
- `GET /api/evidence/:id/manifest`: Download evidence `manifest.json`.
- `GET /api/evidence/:id/file/:filename`: Stream forensic MP4 video clips with HTTP 206 partial content range support or download snapshot JPEG.
- `POST /api/evidence/:id/verify`: Verify SHA-256 hashes against disk files.

### 3.3 Phase 7 Cross-Camera Event Correlation

#### Declarative Camera Topology Configuration (`config/cameras/camera_relationships.json`)
```json
{
  "version": "1.0",
  "scoringWeights": {
    "topologyMatch": 0.35,
    "temporalMatch": 0.30,
    "directionMatch": 0.15,
    "eventTypeMatch": 0.20
  },
  "minScoreThreshold": 0.65,
  "maxCandidatesPerEvent": 3,
  "recentEventBufferSeconds": 60,
  "relationships": [
    {
      "id": "REL-CAM01-CAM02",
      "sourceCameraId": "CAM-01",
      "targetCameraId": "CAM-02",
      "relationshipType": "ENTRY_TO_CORRIDOR",
      "minTravelTimeSeconds": 2,
      "maxTravelTimeSeconds": 15,
      "allowedDirections": ["A_TO_B", "FORWARD", "ANY"],
      "compatibleEventTypes": ["LINE_CROSSING", "ZONE_ENTRY", "ZONE_EXIT"],
      "description": "North Gate entry towards North Corridor approach line",
      "enabled": true
    }
  ]
}
```

#### REST API Endpoints
- `GET /api/correlations`: List correlation candidate records with filters (`state`, `cameraId`, `minScore`).
- `GET /api/correlations/topology`: Retrieve declarative camera topology graph, edges, and travel windows.
- `GET /api/correlations/:id`: Retrieve single correlation candidate by ID.
- `PATCH /api/correlations/:id/accept`: Operator accepts correlation candidate with note.
- `PATCH /api/correlations/:id/reject`: Operator rejects correlation candidate with note.
- `POST /api/correlations/:id/notes`: Add operator triage note to candidate record.

---

## 4. Available NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run db:init` | Connects to SQLite database, applies SQL schema DDL, and syncs cameras and tables |
| `npm run dev` | Launches backend (`:4000`) and frontend (`:3000`) concurrently with AI supervisor |
| `npm run dev:backend` | Starts Express backend with `tsx watch` (hot-reloading on port 4000) |
| `npm run dev:frontend` | Starts Vite frontend dev server (port 3000 with `/api` proxy) |
| `npm run build` | Compiles TypeScript for shared, backend, and bundles frontend for production |
| `npm test` | Runs Vitest suites across backend and frontend |
| `npm run typecheck` | Runs TypeScript type checking across all workspaces |

---

## 5. Testing Guide

Run all automated test suites from the repository root:

```bash
# 1. Run all backend Vitest tests (83 tests)
npm test --workspace=@ibvap/backend

# 2. Run all frontend Vitest tests (41 tests)
npm test --workspace=@ibvap/frontend

# 3. Run all Python AI unit tests (29 tests)
C:\Python312\python.exe -m pytest ai/tests
```

### Test Coverage Summary
- **Backend (`backend/tests/`)**: 9 test files, 83 tests covering cross-camera event correlation, topology graph loader, travel-time window bounds, event type compatibility, direction consistency, local track ID isolation, candidate deduplication, operator state machine (`candidate` → `accepted`/`rejected`), review notes, audit logging, incident policies, aggregation, evidence job queuing, REST API, video streaming, track persistence, database migrations, and health checks.
- **Frontend (`frontend/tests/`)**: 7 test files, 41 tests covering `CorrelationCard`, `CoverageMap` (with topology directional arrows & travel-time window tags), `IncidentDetailPage` (with Possibly Related Cross-Camera Events panel), `IncidentCard`, `IncidentQueue`, `EvidenceViewer`, `IncidentTimeline`, `IncidentsPage`, `EventTimeline`, zone/line overlays, track anchor dots, Active Rules panel, rule toggles, and playback controls.
- **Python AI (`ai/tests/`)**: 29 unit tests covering evidence extraction (`pre-event.mp4`, `event.mp4`, `post-event.mp4`, `snapshot.jpg`, `manifest.json`), SHA-256 cryptographic verification, tampering detection, timestamp boundary clamping, geometric algorithms, rule evaluators, ByteTrack tracking, and YOLOv8 inference.

