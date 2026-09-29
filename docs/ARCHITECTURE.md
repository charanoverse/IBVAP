# IBVAP System Architecture Documentation (Phase 6 — Incident Management, Evidence Capture & Operator Review)

## 1. What is IBVAP?

**IBVAP** (**Intelligent Border Video Analytics Platform**) is an edge-first, AI-assisted video surveillance and situational intelligence platform designed for border security, sterile zone monitoring, and perimeter defense operations.

The platform processes multi-sensor optical and thermal camera feeds across wide geographic perimeters, detects perimeter intrusions and anomalous behaviors, correlates cross-camera trajectories, maintains forensic evidence trails, and presents real-time actionable insights to human operators while adhering to strict auditability and local-first resilience requirements.

---

## 2. Logical Architecture & Separation of Concerns

IBVAP is structured with strict modular boundaries across ingestion, AI detection, multi-object tracking, spatial/temporal rule evaluation, incident management, forensic evidence clipping, and operator review:

```
[ Camera Feeds / Local MP4 Video Pipeline ] (Phase 2)
                 │
                 ▼ (HTTP Range 206 Streaming)
     [ Video Source Subsystem ] 
     (VideoSource → FileVideoSource → VideoSourceService)
                 │
                 ▼ (Frame Extraction @ Configurable Sampling FPS)
      [ AI Detection Subsystem ] (Phase 3)
      (YOLODetector → Ultralytics YOLOv8n on CPU/GPU)
                 │
                 ▼ (Normalized BBox + Class + Confidence)
      [ Multi-Object Tracking Subsystem ] (Phase 4)
      (ByteTracker → 2-Stage Hungarian Association + Kalman Filter)
                 │
                 ▼ (Local Persistent Track IDs + Trajectories + Ground Anchor)
      [ Spatial & Temporal Rule Engine ] (Phase 5)
      (Geometry Evaluators + Candidate Verification + Cooldown/Deduplication)
                 │
                 ▼ (Verified Security Events with Explanations)
      [ Incident Policy & Aggregation Service ] (Phase 6)
      (Declarative Policies + Same-Camera/Same-Track Window Aggregation)
                 │
                 ├───────────────────────────────────────┐
                 ▼                                       ▼
    [ Forensic Evidence Extractor ]         [ Incident Record Lifecycle ]
    (OpenCV 4.11 Temporal Buffer Slicer)    (NEW → ACK → REVIEW → CLOSE)
    ├── pre-event.mp4 (T - 10s)                          │
    ├── event.mp4 (T to T + Dur)                         ▼
    ├── post-event.mp4 (T + 10s)             [ SQLite Database & Audit Logs ]
    ├── snapshot.jpg (Keyframe)              (Incidents, Evidence, AuditTrail)
    └── manifest.json + SHA-256 Hashing                  │
                 │                                       ▼
                 └──────────────────────────► [ Operator Command Center UI ]
                                              (Triage Queue, 4-Tab Evidence Player,
                                               Timeline, Disposition Actions, Notes)
```

### Critical Architectural Distinctions & Phase Boundaries

- **Detection ≠ Track**: A detection is an isolated, frame-local observation (*"At timestamp T, this frame contains a bounding box at (x, y)"*). A **Track** represents an associated continuous temporal entity across frames with state history, motion vectors, duration, and rolling trajectory.
- **Track ID ≠ Global Identity**: Track IDs (`T001`, `T002`, `T017`) are **strictly technical, ephemeral, and local to a single camera stream**. They carry **NO** cross-camera re-identification, face biometrics, license plate numbers, or external person identities.
- **Track ≠ Event**: The persistence of a track does not by itself constitute an alarm or intrusion. An **Event** is emitted only when spatial rules (zones, tripwires) and temporal verification constraints (minimum frames, dwell duration, direction) are fully satisfied.
- **Event ≠ Incident**: A **Verified Event** is a single camera-level security occurrence (`ZONE_ENTRY`, `DWELL`, `LINE_CROSSING`). An **Incident** is an operator-facing record aggregating compatible events on the same camera and track within a temporal window, assigned an explainable priority, and bundled with reviewable forensic evidence.
- **Incident ≠ Operator Decision**: Incidents present objective algorithmic and forensic findings. Only authorized human operators can transition review states, escalate, add triage notes, and record final closure dispositions (`CONFIRMED_ACTIVITY`, `BENIGN_ACTIVITY`, `FALSE_ALERT`).

---

## 3. Major Modules Overview

| Subsystem / Directory | Responsibility | Status |
| :--- | :--- | :--- |
| `ai/detection/` | Python YOLOv8 detector, OpenCV frame extractor, and multi-camera HTTP service | **Phase 3 Complete** |
| `ai/tracking/` | ByteTrack multi-object tracker, Kalman filter state estimator, track lifecycle manager | **Phase 4 Complete** |
| `ai/rules/` | Spatial geometry (polygon ray-casting, line crossing), rule evaluators, candidate state machine, explanation generator | **Phase 5 Complete** |
| `ai/processing/evidence_extractor.py` | Forensic video clipping (pre/event/post), frame snapshots, SHA-256 hashing, `manifest.json`, and integrity verification | **Phase 6 Complete** |
| `config/incidents/incident_policies.json` | Declarative event-to-incident mapping, priorities, aggregation rules, and buffer durations | **Phase 6 Complete** |
| `backend/src/incidents/IncidentPolicyService.ts` | Evaluates verified events against declarative incident policies and generates explainable priority rationales | **Phase 6 Complete** |
| `backend/src/incidents/IncidentAggregator.ts` | Idempotent event deduplication and conservative same-camera same-track aggregation | **Phase 6 Complete** |
| `backend/src/services/evidenceService.ts` | Asynchronous evidence extraction job queue, file streaming with range requests, and SHA-256 validation | **Phase 6 Complete** |
| `backend/src/services/incidentService.ts` | Complete operator triage state machine (`NEW` → `ACKNOWLEDGED` → `UNDER_REVIEW` → `ESCALATED` / `CLOSED`), audit logs | **Phase 6 Complete** |
| `config/cameras/camera_relationships.json` | Declarative camera topology graph, directed adjacency, travel-time windows, and scoring weights | **Phase 7 Complete** |
| `backend/src/correlations/TopologyService.ts` | Graph loader, adjacency querying, travel-time bounds, and directional compatibility | **Phase 7 Complete** |
| `backend/src/correlations/CorrelationEngine.ts` | Spatio-temporal correlation evaluator, explainable factor calculator, weighted scoring, explanation generator | **Phase 7 Complete** |
| `backend/src/services/correlationService.ts` | Candidate lifecycle manager, operator review flows (`accept`, `reject`, `notes`), SSE broadcasting, audit logging | **Phase 7 Complete** |
| `frontend/src/pages/IncidentDetailPage.tsx` | Comprehensive incident triage workstation with evidence playback, telemetry, notes editor, and action buttons | **Phase 6 & 7 Complete** |
| `config/coverage/zone_coverage.json` | Declarative zone coverage model mapping primary and supporting cameras to physical sectors | **Phase 8 Complete** |
| `backend/src/health/CameraHealthService.ts` | Multi-dimensional stream telemetry, Laplacian focus sharpness, luminance, contrast, freeze detection, rolling window, simulation overrides, audit logging | **Phase 8 Complete** |
| `backend/src/coverage/CoverageService.ts` | Declarative zone coverage evaluation, blind-spot risk detection, ranked usable alternative recommendation engine with explainable factors | **Phase 8 Complete** |
| `backend/src/api/routes/coverage.ts` | Coverage health status, zone query, and alternative camera view recommendation endpoints | **Phase 8 Complete** |
| `frontend/src/services/cameraHealthService.ts` | Frontend client for live camera health telemetry, metrics inspection, and simulation overrides | **Phase 8 Complete** |
| `frontend/src/services/coverageService.ts` | Frontend client for zone coverage health and alternative view recommendations | **Phase 8 Complete** |
| `frontend/src/pages/CoveragePage.tsx` | Tactical coverage overview with 2D perimeter map, coverage KPI cards, zone status matrix, and operator safety disclaimer | **Phase 8 Complete** |
| `frontend/src/pages/CameraDetailPage.tsx` | Camera workstation with Health & Visibility telemetry tab, simulation controls, and alternative view recommendation cards | **Phase 8 Complete** |

---

## 4. Phase 7 Cross-Camera Event Correlation

### Core Principles & Non-Identity Invariant

IBVAP Phase 7 establishes bounded, explainable cross-camera event relationships without making assumptions about physical person identity:

```
CAM-01 Verified Event (t1) ──┐
                             ├─► [ Camera Topology Graph ] ──► [ Correlation Candidate ] ──► [ Operator Review ]
CAM-02 Verified Event (t2) ──┘   (Travel-Time Window,          (Explainable Score & Factors)  (ACCEPT / REJECT)
                                  Direction, Event Compatibility)
```

1. **Correlation $\neq$ Identity**: A correlation represents an explainable spatio-temporal link between distinct events on adjacent cameras. It does **NOT** assert that the subjects are the same person or vehicle.
2. **Local Track ID Isolation**: Local track IDs (`CAM-01 T001` vs `CAM-02 T001`) remain strictly isolated technical indices and are never cross-compared.
3. **No Automatic Incident Merging**: Cross-camera events are displayed as context in the operator command center; incidents on separate cameras remain independently reviewable records.
4. **Transparent Explainability**: Every candidate provides a full factor breakdown ($S_{\text{topo}}$, $S_{\text{time}}$, $S_{\text{dir}}$, $S_{\text{type}}$) and human-readable natural language rationale.
5. **Auditable Human Agency**: Operators explicitly accept or reject correlation proposals with recorded operator identity, timestamp, and optional triage notes.

---

## 5. Phase 8 Camera Health, Visibility Assessment & Blind-Spot Intelligence

### 5.1 Architecture & Separation of Concerns

Phase 8 introduces continuous real-time camera health assessment, optical visibility scoring, declarative coverage modeling, automatic blind-spot intelligence, and ranked alternative usable-view recommendations:

```
 CAMERA FEED / REPLAY
         │
         ▼
 ┌──────────────────────────────────────────┐
 │       CameraHealthService (Backend)      │
 │  ├── Stream Availability & Freshness     │
 │  ├── Effective FPS vs Expected FPS       │
 │  ├── Frozen Frame / Motion Detector      │
 │  ├── Laplacian Focus Sharpness (Blur)    │
 │  ├── Mean Luminance (Darkness / Glare)   │
 │  └── Contrast Deviation                  │
 └────────────────────┬─────────────────────┘
                      │
                      ├──────────────────────────┐
                      ▼                          ▼
               HEALTH STATE              VISIBILITY STATE
          (HEALTHY/DEGRADED/OFFLINE)  (GOOD/DEGRADED/POOR)
                      │
                      ▼
 ┌──────────────────────────────────────────┐
 │         CoverageService (Backend)        │
 │  ├── Declarative Model (zone_coverage)   │
 │  ├── Primary Camera Evaluation           │
 │  ├── Blind-Spot Risk Detection           │
 │  └── Usable Alternative Ranking          │
 └────────────────────┬─────────────────────┘
                      │
                      ▼
 ┌──────────────────────────────────────────┐
 │      Operator Command Center (UI)        │
 │  ├── Live Health & Visibility Badges     │
 │  ├── Alternative Views in Incidents      │
 │  ├── Tactical Coverage & Blind-Spot Map  │
 │  ├── Optical Telemetry & Transition Log  │
 │  └── Dev / Demo Simulation Overrides     │
 └──────────────────────────────────────────┘
```

### 5.2 Strict Operational Invariant: View Recommendation $\neq$ Identity Continuity

- **Alternative View $\neq$ Identity Continuity**: An alternative view recommendation suggests the most suitable operational camera covering the same perimeter zone when a primary camera is degraded or unavailable.
- **Strict Boundary**: It does **NOT** perform person re-identification, face recognition, or biometric tracking across camera views. Local track identities are never linked across feeds.
- **Transparent Rationale**: Every recommendation presents its calibrated coverage quality percentage, health state, visibility state, and natural language explanation with an explicit non-biometric disclaimer.

---

## 6. Execution Guide

```bash
# Run all tests (Frontend + Backend + Python)
npm test

# Run backend tests
npm test --workspace=@ibvap/backend

# Run frontend tests
npm test --workspace=@ibvap/frontend

# Run Python AI rule engine & evidence extractor tests
C:\Python312\python.exe -m pytest ai/tests

# Extract sample forensic evidence package
C:\Python312\python.exe ai/processing/evidence_extractor.py --source data/videos/CAM-3/restricted.mp4 --output-dir data/evidence/INC-001 --incident-id INC-001 --camera-id CAM-03 --event-timestamp 4.0

# Verify evidence integrity
C:\Python312\python.exe ai/processing/evidence_extractor.py --output-dir data/evidence/INC-001 --verify

# Typecheck and build monorepo
npm run build
```

