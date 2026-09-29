# Intelligent Border Video Analytics Platform (IBVAP)

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.5-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-v18.3-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-v5.4-purple.svg)](https://vitejs.dev/)
[![Python](https://img.shields.io/badge/Python-3.10--3.12-yellow.svg)](https://www.python.org/)
[![Ultralytics YOLOv8](https://img.shields.io/badge/YOLO-v8n-orange.svg)](https://github.com/ultralytics/ultralytics)

**IBVAP** (**Intelligent Border Video Analytics Platform**) is an edge-first, AI-assisted video surveillance and situational intelligence platform engineered for border defense, sterile buffer zone monitoring, and perimeter security operations.

The platform continuously processes multi-sensor optical and thermal camera feeds across wide perimeters, performs real-time YOLOv8 object detection, associates local track trajectories via ByteTrack, evaluates spatial and temporal security rules (zones, virtual tripwires, loitering), aggregates verified security incidents with forensic video clipping, performs cross-camera event correlation via declarative topology graphs, and alerts human operators via an interactive React command center.

---

## Architecture Overview

```
[ CCTV Video Feeds / Local MP4 Video Pipeline ]
                   │
                   ▼ (HTTP Range 206 Streaming)
       [ Video Ingestion Subsystem ]
                   │
                   ▼ (Frame Extraction @ Configurable Sampling FPS)
        [ AI Detection Subsystem ] (YOLOv8 on CPU/GPU)
                   │
                   ▼ (Bounding Boxes + Class + Confidence)
     [ Multi-Object Tracking Subsystem ] (ByteTrack + Kalman Filter)
                   │
                   ▼ (Persistent Track IDs + Trajectories + Ground Anchor)
       [ Spatial & Temporal Rule Engine ] (Virtual Zones & Tripwires)
                   │
                   ▼ (Verified Security Events with Explanations)
       [ Incident Policy & Aggregation Service ]
                   │
         ├─────────┴─────────────────────────────┐
         ▼                                       ▼
[ Forensic Evidence Extractor ]         [ Incident Record Lifecycle ]
(Pre / Event / Post MP4 + Hashes)       (NEW → ACK → REVIEW → CLOSE)
         │                                       │
         ▼                                       ▼
[ SQLite Database & Audit Logs ]        [ Cross-Camera Correlation Engine ]
         │                              (Adjacency, Travel Windows & Scoring)
         └───────────────────┬───────────────────┘
                             ▼
              [ Operator Command Center UI ]
           (Tactical Map, Video Player, Triage,
            Correlations, Camera Health & Coverage)
```

---

## Key Features

- **Local CCTV Ingestion & Streaming**: Fast, low-latency MP4 streaming with HTTP 206 Partial Content range requests and path-traversal security guards.
- **Real-Time YOLOv8 Detection**: Optical and thermal target classification (`person`, `car`, `motorcycle`, `bus`, `truck`) running on CPU or CUDA GPU.
- **ByteTrack Multi-Object Tracking**: Two-stage Hungarian association algorithm with Kalman filtering for robust trajectory tracking across temporary occlusions.
- **Spatial & Temporal Rule Engine**:
  - Virtual sterile zone intrusion detection with ray-casting polygon math.
  - Virtual perimeter tripwire line-crossing directionality detection.
  - Loitering and dwell time threshold evaluation.
  - Cooldown deduplication and candidate state machines.
- **Forensic Evidence Packages**: Automated extraction of pre-event (T-10s), primary event, and post-event (T+10s) clips, keyframe JPEG snapshots, and cryptographic SHA-256 manifests.
- **Cross-Camera Event Correlation**: Directed topology graph matching with travel-time window evaluation, direction consistency scoring, and explainable correlation factors.
- **Camera Health & Blind-Spot Intelligence**: Automated focus sharpness (Laplacian variance), contrast, luminance analysis, freeze detection, and ranked fallback camera recommendations.
- **Operator Command Center**: Modern, responsive React/Vite dashboard with operational KPIs, live video feeds, incident triage queues, and forensic verification tools.

---

## Directory Structure

```
IBVAP/
├── ai/                                # Python AI Subsystem
│   ├── detection/                     # YOLOv8 detector & multi-camera HTTP service
│   │   ├── detector.py                # Core YOLODetector wrapper
│   │   ├── frame_extractor.py         # OpenCV frame extraction pipeline
│   │   └── service.py                 # Multi-threaded camera workers & REST API
│   ├── models/                        # Model weights directory (yolov8n.pt)
│   ├── processing/                    # Forensic evidence extraction
│   │   └── evidence_extractor.py      # Pre/event/post clip slicer & SHA-256 verifier
│   ├── rules/                         # Rule engine & geometry evaluation
│   │   ├── engine.py                  # Rule evaluation lifecycle & candidate tracking
│   │   ├── evaluators.py              # Zone entry, line crossing & dwell evaluators
│   │   └── geometry.py                # Polygon ray-casting & line segment intersection
│   ├── tests/                         # Pytest test suite for AI subsystem
│   └── tracking/                      # Multi-object tracking
│       ├── bytetrack.py               # ByteTrack 2-stage association tracker
│       └── kalman_filter.py           # Kalman filter state estimator
├── backend/                           # Node.js / Express Backend
│   ├── src/
│   │   ├── ai/                        # AI child process supervisor (AIProcessManager)
│   │   ├── api/                       # REST routes & middleware
│   │   ├── config/                    # Environment & path configuration
│   │   ├── correlations/              # Spatio-temporal event correlation engine
│   │   ├── coverage/                  # Zone coverage & alternative view service
│   │   ├── health/                    # Camera health & stream telemetry service
│   │   ├── incidents/                 # Incident policies & event aggregation
│   │   ├── repositories/              # SQLite database layer & schema initialization
│   │   ├── services/                  # Business logic services
│   │   ├── utils/                     # Structured logger & error classes
│   │   └── video/                     # Video source abstraction & streaming
│   └── tests/                         # Backend Vitest unit & integration tests
├── config/                            # Declarative Configuration Files
│   ├── cameras/                       # Camera roster & topology graph relationships
│   ├── coverage/                      # Zone-to-camera coverage mapping
│   ├── incidents/                     # Declarative incident creation policies
│   ├── rules/                         # Active security rules (zones, tripwires)
│   └── zones/                         # Virtual polygon zones & tripwire coordinates
├── data/                              # Data Storage (gitignored, structure preserved)
│   ├── evidence/                      # Forensic evidence packages & manifests
│   ├── snapshots/                     # Keyframe image snapshots
│   └── videos/                        # Local CCTV video recordings
├── docs/                              # Project Documentation
│   ├── ARCHITECTURE.md                # In-depth architectural specifications
│   └── DEVELOPMENT.md                 # Developer setup & contribution guidelines
├── frontend/                          # React + TypeScript + Vite Dashboard
│   ├── src/
│   │   ├── components/                # UI components (tactical maps, players, cards)
│   │   ├── pages/                     # Application pages (Dashboard, Incidents, etc.)
│   │   ├── services/                  # API clients
│   │   └── layouts/                   # Main navigation shell & layout
│   └── tests/                         # Frontend Vitest & Testing Library tests
├── shared/                            # Shared TypeScript domain models & interfaces
├── package.json                       # Monorepo workspace configuration
├── requirements.txt                   # Python dependencies for AI subsystem
└── tsconfig.base.json                 # Shared TypeScript configuration
```

---

## Prerequisites

Before running the application, ensure you have the following installed:

1. **Node.js**: `v20.0.0` or later (tested on Node.js `v20.x` and `v23.x`)
2. **npm**: `v9.0.0` or later
3. **Python**: `3.10` to `3.12`
4. **Git**: For version control

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/charanoverse/IBVAP.git
cd IBVAP
```

### 2. Install Node.js Workspace Dependencies

From the repository root, install dependencies for all workspaces (`shared`, `backend`, `frontend`):

```bash
npm install
```

### 3. Install Python AI Subsystem Dependencies

Install the required Python packages for the AI detection and evidence extraction pipeline:

```bash
pip install -r requirements.txt
```

*(Optional: Use a Python virtual environment `python -m venv .venv` prior to installing dependencies)*

### 4. Configure Environment Variables

Copy the example environment configuration template:

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**Linux / macOS:**
```bash
cp .env.example .env
```

Inspect `.env` and adjust settings as needed. By default, it is configured for local development:
- `PORT=4000` (Backend API)
- `AI_SERVICE_PORT=5001` (Python AI Service)
- `DATABASE_PATH=./data/ibvap_dev.sqlite`
- `VITE_API_BASE_URL=http://127.0.0.1:4000/api`

### 5. Initialize SQLite Database

Initialize the SQLite database schema and seed the default camera roster:

```bash
npm run db:init
```

This creates the database at `./data/ibvap_dev.sqlite` and applies table schemas for cameras, detections, tracks, verified events, incidents, evidence records, and correlation candidates.

### 6. Start the Application

You can launch the full development stack with a single command or start components in dedicated terminals.

#### Option A: Unified Start (Root)

```bash
npm run dev
```

#### Option B: Separate Terminals (Recommended for Development)

**Terminal 1 — Backend API & AI Supervisor:**
```bash
npm run dev:backend
```
*(The backend automatically launches and supervises the Python AI detection service on port 5001 when `AI_ENABLED=true`)*

**Terminal 2 — Frontend Command Center:**
```bash
npm run dev:frontend
```

---

## Application Access Points

Once started, access the application via your browser:

| Component | URL | Description |
| :--- | :--- | :--- |
| **Operator Command Center** | [http://localhost:3000](http://localhost:3000) | Full tactical UI, live CCTV replay, incident queue, coverage map |
| **Backend REST API** | [http://localhost:4000/api](http://localhost:4000/api) | Core API endpoints & SSE event streams |
| **System Health Check** | [http://localhost:4000/api/health](http://localhost:4000/api/health) | Subsystem health, database status, camera online telemetry |
| **AI Detection Engine** | [http://127.0.0.1:5001/status](http://127.0.0.1:5001/status) | Direct Python AI telemetry & camera inference metrics |

---

## Available NPM Scripts

| Command | Workspace | Description |
| :--- | :--- | :--- |
| `npm run dev` | All | Starts backend and frontend development servers |
| `npm run dev:backend` | Backend | Starts Express API with hot-reload (`tsx watch`) |
| `npm run dev:frontend` | Frontend | Starts Vite React frontend on port `3000` |
| `npm run db:init` | Backend | Initializes SQLite tables and seeds demo camera fleet |
| `npm run build` | All | Compiles TypeScript packages and builds frontend production bundle |
| `npm test` | All | Runs all backend and frontend Vitest test suites |
| `npm run typecheck` | All | Runs strict TypeScript typecheck across all workspaces |

---

## Testing & Quality Assurance

The codebase includes end-to-end unit, integration, and UI test coverage:

```bash
# 1. Run all JavaScript/TypeScript tests (Backend + Frontend)
npm test

# 2. Run Backend tests only (101 tests across 10 suites)
npm test --workspace=@ibvap/backend

# 3. Run Frontend tests only (47 tests across 8 suites)
npm test --workspace=@ibvap/frontend

# 4. Run Python AI Subsystem tests (29 tests)
python -m pytest ai/tests

# 5. Run full TypeScript static type checking
npm run typecheck
```

---

## Core API Endpoints

### Cameras & Video Streaming
- `GET /api/cameras` — List all surveillance cameras with status and health metrics
- `GET /api/cameras/:id` — Get detailed camera configuration and coverage sector
- `GET /api/cameras/:id/video` — Stream camera video with HTTP 206 partial content range support

### AI Detections & Tracking
- `GET /api/detections` — Query historical detection frames
- `GET /api/detections/stream` — Real-time Server-Sent Events (SSE) detection stream
- `GET /api/tracks` — Query active tracks and trajectory ground-anchor histories

### Rules & Security Events
- `GET /api/rules` — List active spatial and temporal security rules
- `POST /api/rules/toggle` — Enable or disable a specific detection rule
- `GET /api/events` — Retrieve verified security events with explanations

### Incident Management & Evidence
- `GET /api/incidents` — List incidents with filters (`priority`, `state`, `cameraId`)
- `GET /api/incidents/metrics` — Aggregate incident counters for dashboard KPIs
- `GET /api/incidents/:id` — Retrieve full incident dossier
- `PATCH /api/incidents/:id/acknowledge` — Transition incident state to `ACKNOWLEDGED`
- `PATCH /api/incidents/:id/review` — Transition incident state to `UNDER_REVIEW`
- `PATCH /api/incidents/:id/close` — Close incident with disposition (`CONFIRMED_ACTIVITY`, `BENIGN_ACTIVITY`, `FALSE_ALERT`)
- `POST /api/incidents/:id/notes` — Add operator timestamped triage note
- `GET /api/evidence/:id/manifest` — Download cryptographic `manifest.json`
- `POST /api/evidence/:id/verify` — Verify disk files against SHA-256 hashes

### Cross-Camera Correlation & Coverage
- `GET /api/correlations` — List cross-camera candidate event correlations
- `GET /api/correlations/topology` — Retrieve camera topology adjacency graph
- `PATCH /api/correlations/:id/accept` — Operator accepts correlation candidate
- `GET /api/coverage/health` — Retrieve tactical zone coverage and blind-spot risk assessments
- `GET /api/coverage/recommendations/:zoneId` — Get ranked alternative camera recommendations

---

## Contributing & License

For architectural guidelines and extended development details, see:
- [System Architecture](docs/ARCHITECTURE.md)
- [Developer Guide](docs/DEVELOPMENT.md)

Private and proprietary project. All rights reserved.
