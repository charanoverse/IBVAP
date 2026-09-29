/**
 * IBVAP Domain Contracts & Models
 * Phase 0 Technical Foundation + Phase 3 AI Object Detection
 */

// ==========================================
// 1. CAMERA MODEL
// ==========================================
export type CameraStatus = 'active' | 'inactive' | 'standby' | 'error' | 'maintenance';

export interface CameraCoverage {
  sector?: string;
  latitude?: number;
  longitude?: number;
  azimuth?: number; // In degrees (0-360)
  fovDegrees?: number;
  blindSpotZones?: string[];
}

export type CameraHealthState = 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';
export type CameraVisibilityState = 'GOOD' | 'DEGRADED' | 'POOR' | 'UNKNOWN';
export type CameraStreamStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'STALLED';

export interface CameraVisibilityMetrics {
  brightness: number; // 0-255 mean luminance
  contrast: number; // standard deviation of grayscale luminance
  blurScore: number; // Laplacian variance focus measure
  frameDifference?: number; // Mean absolute difference between consecutive frames
  edgeDensity?: number;
}

export interface CameraHealth {
  cameraId?: string;
  isOnline: boolean; // Legacy Phase 0 compatibility
  fps?: number; // Legacy compatibility
  lastHeartbeat?: string;
  signalQuality?: number; // 0.0 - 1.0
  errorMessage?: string;
  streamStatus?: CameraStreamStatus;
  healthState?: CameraHealthState;
  visibilityState?: CameraVisibilityState;
  measuredAt?: string;
  sourceAvailable?: boolean;
  frameFreshnessMs?: number;
  effectiveFps?: number;
  expectedFps?: number;
  latencyMs?: number;
  frozenFrameDetected?: boolean;
  metrics?: CameraVisibilityMetrics;
  reasons?: string[];
  isSimulated?: boolean;
  simulatedReason?: string;
}

// ==========================================
// 1B. COVERAGE MODEL & ALTERNATIVE VIEW CONTRACTS (Phase 8)
// ==========================================
export type CameraCoverageRole = 'PRIMARY' | 'SUPPORTING' | 'OVERLAPPING' | 'OPTIONAL';
export type RecommendationStatus = 'AVAILABLE' | 'LIMITED' | 'NONE_AVAILABLE';

export interface ZoneCameraCoverage {
  cameraId: string;
  role: CameraCoverageRole;
  coverageQuality: number; // 0.0 - 1.0 configured coverage quality weight
  description?: string;
}

export interface ZoneCoverageConfig {
  zoneId: string;
  zoneName: string;
  description?: string;
  cameras: ZoneCameraCoverage[];
}

export interface AlternativeViewFactors {
  sameZoneCoverage: boolean;
  configuredCoverageQuality: number;
  healthState: CameraHealthState;
  visibilityState: CameraVisibilityState;
  sourceAvailable: boolean;
}

export interface AlternativeViewRecommendation {
  id: string; // e.g. "REC-CAM03-ZONE01-CAM04"
  affectedCameraId: string;
  zoneId: string;
  zoneName: string;
  recommendedCameraId?: string;
  recommendedCameraName?: string;
  status: RecommendationStatus;
  rank?: number;
  reason: string;
  factors: AlternativeViewFactors;
  createdAt: string;
}

export interface ZoneCoverageStatus {
  zoneId: string;
  zoneName: string;
  coverageState: 'HEALTHY' | 'DEGRADED' | 'BLIND_SPOT_RISK';
  primaryCameras: string[];
  supportingCameras: string[];
  activePrimaryCount: number;
  usableAlternativeCount: number;
  recommendations: AlternativeViewRecommendation[];
  updatedAt: string;
}

export interface Camera {
  id: string;
  name: string;
  description?: string;
  sourceReference: string; // Stream URL, RTSP, or local video file path
  status: CameraStatus;
  capabilities: string[]; // e.g. ['optical', 'thermal', 'ir', 'ptz']
  coverage?: CameraCoverage;
  health?: CameraHealth;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 2. OBSERVATION MODEL
// ==========================================
export interface Observation {
  id: string;
  cameraId: string;
  timestamp: string;
  objectClass: string; // e.g. 'person', 'vehicle', 'vessel', 'drone'
  localTrackRef?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ==========================================
// 3. DETECTION MODEL (Phase 3 AI Pipeline)
// ==========================================
export interface BoundingBox {
  x: number; // Normalized (0.0 to 1.0)
  y: number; // Normalized (0.0 to 1.0)
  width: number; // Normalized (0.0 to 1.0)
  height: number; // Normalized (0.0 to 1.0)
}

export interface Detection {
  id: string;
  cameraId: string;
  timestamp: string;
  objectClass: string; // e.g. 'person', 'car', 'truck', 'bus', 'motorcycle'
  confidence: number; // 0.0 to 1.0
  boundingBox: BoundingBox;
  frameIndex?: number; // Video frame counter index (NOT a tracking ID)
  frameTimestamp?: number; // Offset into video stream in seconds
  videoTimestamp?: number; // Synonym/explicit video offset in seconds
  frameWidth?: number; // Source pixel width
  frameHeight?: number; // Source pixel height
  classId?: number; // YOLO internal class index
  trackRef?: string; // Local technical track reference (e.g. "T017")
  createdAt: string;
}

// ==========================================
// 3B. MULTI-OBJECT TRACKING MODEL (Phase 4 Pipeline)
// ==========================================
export type TrackStatus = 'ACTIVE' | 'LOST' | 'EXPIRED';

export interface TrajectoryPoint {
  x: number; // Normalized center X (0.0 to 1.0)
  y: number; // Normalized center Y (0.0 to 1.0)
  timestamp: number; // Video timestamp in seconds
}

/**
 * Represents a persistent LOCAL track identity within a single camera session.
 * NOTE: Track IDs are local to one camera. No cross-camera matching, no ReID, no identity claims.
 */
export interface Track {
  id: string; // Unique technical track ID (e.g. "trk-cam-01-17")
  trackId: number; // Numeric local track index (e.g. 17)
  displayId?: string; // Short UI label (e.g. "T017" or "TRACK 017")
  cameraId: string;
  classId: number;
  className: string;
  confidence: number; // Latest / smoothed detection confidence (0.0 to 1.0)
  boundingBox: BoundingBox;
  firstSeen: string; // ISO 8601 string
  lastSeen: string; // ISO 8601 string
  firstSeenTimestamp?: number; // Video timestamp in seconds
  lastSeenTimestamp?: number; // Video timestamp in seconds
  ageFrames: number; // Total number of processed frames since inception
  ageSeconds: number; // Time in seconds since first observation
  missedFrames: number; // Consecutive missed frames (buffer count)
  status: TrackStatus;
  trajectory: TrajectoryPoint[]; // Rolling center-point trajectory history
  createdAt?: string;
  updatedAt?: string;
}

export interface TrackSummary {
  id: string;
  trackId: number;
  cameraId: string;
  className: string;
  confidence: number;
  firstSeen: string;
  lastSeen: string;
  firstSeenTimestamp: number;
  lastSeenTimestamp: number;
  totalFrames: number;
  status: TrackStatus;
  boundingBox: BoundingBox;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 4. VIRTUAL ZONES & TRIPWIRE LINES (Phase 5)
// ==========================================
export type ZoneType = 'RESTRICTED' | 'MONITORED' | 'ENTRY' | 'EXIT' | 'NEUTRAL' | 'sterile_zone' | 'warning_zone';

export interface PolygonPoint {
  x: number; // Normalized (0.0 to 1.0)
  y: number; // Normalized (0.0 to 1.0)
}

export interface Zone {
  id: string; // e.g. "ZONE-RESTRICTED-01"
  cameraId: string;
  name: string;
  type: ZoneType;
  polygon: [number, number][] | PolygonPoint[]; // Normalized [x, y] coordinates
  color?: string; // Optional hex color code
  severity?: string;
  description?: string;
  enabled?: boolean;
}

export interface Line {
  id: string; // e.g. "LINE-GATE-01"
  cameraId: string;
  name: string;
  start: [number, number] | PolygonPoint; // [x, y] normalized
  end: [number, number] | PolygonPoint;   // [x, y] normalized
  color?: string;
  labelA?: string; // e.g. "Outside" / "Side A"
  labelB?: string; // e.g. "Inside" / "Side B"
  description?: string;
  enabled?: boolean;
}

// ==========================================
// 4B. RULE CONFIGURATION (Phase 5)
// ==========================================
export type RuleType =
  | 'ZONE_ENTRY'
  | 'ZONE_EXIT'
  | 'DWELL'
  | 'LINE_CROSSING'
  | 'WRONG_DIRECTION'
  | 'REPEATED_CROSSING'
  | 'sterile_zone_breach'
  | 'corridor_loitering';

export type LineDirection = 'A_TO_B' | 'B_TO_A' | 'BOTH' | 'ANY';

export interface RuleConditions {
  minDwellSeconds?: number;
  minimumSeconds?: number;
  minConfidence?: number;
  allowedDirection?: LineDirection;
  repeatCount?: number;
  windowSeconds?: number;
  cooldownSeconds?: number;
}

export interface RuleVerificationConfig {
  minimumFrames?: number;
  minimumSeconds?: number;
}

export interface Rule {
  id: string; // e.g. "RULE-CAM03-01"
  name: string;
  cameraId: string;
  type: RuleType;
  ruleType?: RuleType | string;
  eventType?: string;
  zoneId?: string;
  lineId?: string;
  classes?: string[];
  targetClasses?: string[];
  enabled: boolean;
  conditions?: RuleConditions;
  verification?: RuleVerificationConfig;
  cooldownSeconds?: number;
  description?: string;
}

export interface RuleTelemetry {
  enabledRulesCount: number;
  activeRuleStatesCount: number;
  tracksEvaluatedCount: number;
  candidateEventsCount: number;
  verifiedEventsCount: number;
  evaluationLatencyMs: number;
}

// ==========================================
// 4C. EVENT MODEL (Phase 0 Foundation + Phase 5 Verified Security Events)
// ==========================================
export type EventStatus = 'CANDIDATE' | 'VERIFIED' | 'ENDED' | 'DISMISSED';
export type EventVerificationState = 'unverified' | 'verified' | 'false_positive';

export interface Event {
  id: string; // Unique Event ID (e.g. "EVT-CAM-03-001")
  eventType: string; // "ZONE_ENTRY" | "ZONE_EXIT" | "DWELL" | "LINE_CROSSING" | "WRONG_DIRECTION" | "REPEATED_CROSSING"
  cameraId: string;
  ruleId?: string;
  ruleName?: string;
  ruleRef?: string; // Legacy/Phase 0 compatibility
  zoneId?: string;
  lineId?: string;
  trackId?: number;
  trackDisplayId?: string; // e.g. "T017"
  objectClass?: string; // "person", "car", etc.
  confidence?: number;
  timestamp: string; // ISO 8601 string
  startedAt?: string;
  verifiedAt?: string;
  endedAt?: string;
  videoTimestamp?: number; // Offset into video stream in seconds
  status?: EventStatus;
  verificationState?: EventVerificationState;
  explanation?: string; // Human-readable explanation of why event occurred
  evidenceRef?: string;
  acknowledged?: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

// ==========================================
// 5. INCIDENT MODEL (Phase 6 Management & Review)
// ==========================================
export type IncidentPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'low' | 'medium' | 'high' | 'critical';
export type IncidentState = 'NEW' | 'ACKNOWLEDGED' | 'UNDER_REVIEW' | 'ESCALATED' | 'CLOSED';
export type IncidentReviewState = IncidentState | 'open' | 'under_review' | 'escalated' | 'resolved' | 'dismissed';
export type IncidentOutcomeType = 'CONFIRMED_ACTIVITY' | 'BENIGN_ACTIVITY' | 'FALSE_ALERT' | 'UNRESOLVED' | 'OTHER';
export type IncidentEvidenceState = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
export type IncidentObservationQuality = 'GOOD' | 'DEGRADED' | 'POOR' | 'UNKNOWN';

export interface IncidentFilterOptions {
  state?: string;
  priority?: string;
  cameraId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface IncidentNote {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface IncidentTimelineEvent {
  id: string;
  timestamp: string; // ISO 8601 string
  videoTimestamp?: number; // Video offset in seconds
  title: string;
  description: string;
  type: 'DETECTION' | 'TRACK_CREATED' | 'ZONE_ACTIVITY' | 'EVENT_VERIFIED' | 'INCIDENT_OPENED' | 'EVIDENCE_STARTED' | 'EVIDENCE_READY' | 'OPERATOR_ACTION' | 'NOTE_ADDED' | 'STATUS_CHANGE';
  actor?: string;
  metadata?: Record<string, unknown>;
}

export interface OperatorOutcome {
  operatorId: string;
  action: string;
  notes?: string;
  disposition?: IncidentOutcomeType | string;
  timestamp: string;
}

export interface Incident {
  id: string; // e.g. "INC-000142"
  title: string; // e.g. "Restricted Sterile Zone Activity"
  cameraId: string;
  cameraName?: string;
  zoneId?: string;
  zoneName?: string;
  lineId?: string;
  lineName?: string;
  primaryEventId: string; // Idempotency anchor
  linkedEventIds: string[]; // Aggregated Event IDs
  linkedEvents?: string[]; // Phase 0 compatibility alias
  priority: IncidentPriority;
  priorityReason: string; // Explainable rationale for priority
  state: IncidentState;
  reviewState?: IncidentReviewState; // Phase 0 compatibility alias
  openedAt: string; // ISO 8601 string
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  reviewStartedAt?: string;
  reviewStartedBy?: string;
  escalatedAt?: string;
  escalatedBy?: string;
  closedAt?: string;
  closedBy?: string;
  outcome?: IncidentOutcomeType | string;
  operatorNotes?: string;
  notes?: IncidentNote[];
  evidenceIds: string[];
  evidence?: string[]; // Phase 0 compatibility alias
  evidenceState: IncidentEvidenceState;
  evidenceAvailable?: boolean;
  explanation?: string; // High-level summary of what, where, when, why
  trackId?: number;
  trackDisplayId?: string; // e.g. "T017"
  objectClass?: string;
  observationQuality?: IncidentObservationQuality;
  processingSessionId?: string;
  relatedObservations?: string[];
  recommendedViews?: string[];
  operatorOutcome?: OperatorOutcome;
  timeline?: IncidentTimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 5B. INCIDENT POLICY & AGGREGATION CONTRACTS
// ==========================================
export interface IncidentPolicyRule {
  eventType: string; // e.g. "ZONE_ENTRY", "DWELL", "LINE_CROSSING"
  ruleType?: string;
  createIncident: boolean;
  defaultPriority: IncidentPriority;
  priorityReasonTemplate: string;
  aggregateWith?: string[]; // Compatible event types for same-camera aggregation
  aggregationWindowSeconds?: number; // Time threshold window for grouping (e.g. 15s)
}

export interface IncidentPolicyConfig {
  version: string;
  policies: IncidentPolicyRule[];
  defaultPolicy: {
    createIncident: boolean;
    defaultPriority: IncidentPriority;
    priorityReasonTemplate: string;
  };
  evidence: {
    preSeconds: number;
    postSeconds: number;
    minEventDurationSeconds: number;
    maxConcurrency: number;
  };
}

// ==========================================
// 6. CORRELATION & TOPOLOGY MODEL (Phase 7 Cross-Camera Event Correlation)
// ==========================================
export type CorrelationState = 'candidate' | 'accepted' | 'rejected';

export interface CameraRelationship {
  id: string; // e.g. "REL-CAM01-CAM02"
  sourceCameraId: string;
  targetCameraId: string;
  relationshipType: string; // e.g. 'ENTRY_TO_CORRIDOR', 'CORRIDOR_TO_STERILE_ZONE', 'STERILE_ZONE_TO_EXIT', 'PERIMETER_TO_STERILE_ZONE', 'SERVICE_TO_EXIT', 'ADJACENT'
  minTravelTimeSeconds: number;
  maxTravelTimeSeconds: number;
  allowedDirections?: string[]; // e.g. ["A_TO_B", "FORWARD", "ANY"]
  compatibleEventTypes?: string[]; // e.g. ["LINE_CROSSING", "ZONE_ENTRY", "ZONE_EXIT"]
  description?: string;
  enabled?: boolean;
}

export interface CameraTopologyScoringWeights {
  topologyMatch: number;
  temporalMatch: number;
  directionMatch: number;
  eventTypeMatch: number;
}

export interface CameraTopologyConfig {
  version: string;
  description?: string;
  relationships: CameraRelationship[];
  scoringWeights?: CameraTopologyScoringWeights;
  minScoreThreshold?: number;
  maxCandidatesPerEvent?: number;
  recentEventBufferSeconds?: number;
}

export interface CorrelationFactors {
  topologyMatch: boolean;
  temporalMatch: boolean;
  directionMatch: boolean;
  eventTypeMatch: boolean;
  timeDeltaSeconds: number;
  minAllowedTimeSeconds: number;
  maxAllowedTimeSeconds: number;
  spatialDeltaMeters?: number;
  directionObserved?: string;
  sourceEventType?: string;
  targetEventType?: string;
}

/**
 * Represents a proposed relationship between observations/events.
 * IMPORTANT: A correlation proposes an explainable spatio-temporal link between events across cameras.
 * It MUST NOT imply confirmed identity, ReID, or biometric tracking.
 */
export interface Correlation {
  id: string; // e.g. "CORR-EVT-01-EVT-02"
  sourceEventId: string;
  targetEventId: string;
  sourceCameraId: string;
  targetCameraId: string;
  relationshipType: string;
  timeDeltaSeconds: number;
  score: number; // 0.0 - 1.0 Explainable correlation score
  confidence?: number; // Compatibility alias for score
  factors: CorrelationFactors;
  explanation: string;
  state: CorrelationState;
  reason: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CorrelationFilterOptions {
  state?: CorrelationState | string;
  cameraId?: string;
  sourceCameraId?: string;
  targetCameraId?: string;
  eventId?: string;
  minScore?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// ==========================================
// 7. EVIDENCE MODEL & MANIFEST (Phase 6)
// ==========================================
export interface EvidenceTimestamps {
  startTime?: string;
  endTime?: string;
  eventStartedAt?: string;
  eventVerifiedAt?: string;
  preStartSeconds: number;
  eventStartSeconds: number;
  eventEndSeconds: number;
  postEndSeconds: number;
  snapshotTimestampSeconds: number;
}

export interface EvidenceFileEntry {
  name: string;
  type: 'PRE_EVENT' | 'EVENT' | 'POST_EVENT' | 'SNAPSHOT' | 'MANIFEST';
  path: string;
  sizeBytes: number;
  sha256: string;
  durationSeconds?: number;
}

export interface EvidenceManifest {
  incidentId: string;
  evidenceId: string;
  cameraId: string;
  primaryEventId: string;
  linkedEventIds: string[];
  source: {
    type: 'LOCAL_FILE' | 'RTSP' | 'SYNTHETIC';
    cameraId: string;
    filePath?: string;
  };
  timestamps: EvidenceTimestamps;
  rule: {
    ruleId?: string;
    ruleName?: string;
    ruleType?: string;
  };
  model: {
    detector?: string;
    tracker?: string;
  };
  files: EvidenceFileEntry[];
  generatedAt: string;
}

export interface EvidenceHashRecord {
  preEvent?: string;
  event?: string;
  postEvent?: string;
  snapshot?: string;
  manifest?: string;
}

export interface Evidence {
  id: string;
  incidentId: string;
  cameraId: string;
  primaryEventId?: string;
  linkedEventIds?: string[];
  originalClip?: string;
  derivedClip?: string;
  preEventClip?: string;
  eventClip?: string;
  postEventClip?: string;
  snapshot?: string;
  manifestReference?: string;
  evidenceHash?: string;
  hashes?: EvidenceHashRecord;
  status: IncidentEvidenceState;
  errorMessage?: string;
  timestamps: EvidenceTimestamps;
  manifest?: EvidenceManifest;
  createdAt: string;
  updatedAt?: string;
}

// ==========================================
// 8. SYNC RECORD MODEL
// ==========================================
export type SyncDeliveryState = 'pending' | 'in_flight' | 'acknowledged' | 'failed';
export type SyncAcknowledgementState = 'unacknowledged' | 'acknowledged';

export interface SyncRetryInfo {
  lastAttempt: string;
  nextAttempt?: string;
  error?: string;
}

export interface SyncRecord {
  id: string;
  entityType: string; // e.g. 'Event', 'Incident', 'Evidence', 'AuditLog'
  entityId: string;
  deliveryState: SyncDeliveryState;
  retryCount: number;
  retryInfo?: SyncRetryInfo;
  acknowledgementState: SyncAcknowledgementState;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 9. AUDIT LOG MODEL
// ==========================================
export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  entity: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ==========================================
// 10. VIDEO INGESTION & STREAMING CONTRACTS
// ==========================================
export type VideoSourceType = 'file' | 'rtsp' | 'synthetic';

export interface CameraVideoMetadata {
  cameraId: string;
  sourceType: VideoSourceType;
  fileName?: string;
  fileSizeBytes?: number;
  mimeType: string;
  streamUrl: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  fps?: number;
  status: 'ready' | 'unavailable' | 'streaming';
  lastModified?: string;
}

// ==========================================
// 11. AI DETECTION & MULTI-OBJECT TRACKING TELEMETRY (Phase 3 & 4)
// ==========================================
export type AIPipelineState = 'disabled' | 'starting' | 'running' | 'paused' | 'error' | 'stopped';

export interface CameraAIStatus {
  cameraId: string;
  status: AIPipelineState;
  modelName: string;
  trackerName?: string; // e.g. 'ByteTrack'
  device: string; // e.g. 'CPU' or 'CUDA:0'
  targetFps: number;
  actualFps: number;
  latencyMs: number; // Detection latency
  trackerLatencyMs?: number; // Tracker association latency
  ruleLatencyMs?: number; // Rule evaluation latency
  pipelineLatencyMs?: number; // Total combined AI pipeline latency (YOLO + Tracker + Rules)
  detectionsCount: number;
  activeTracksCount?: number;
  activeRulesCount?: number;
  verifiedEventsCount?: number;
  processedFrames: number;
  lastInferenceTimestamp?: string;
  errorMessage?: string;
}

export interface AISubsystemHealth {
  status: 'online' | 'initializing' | 'degraded' | 'offline';
  modelName: string;
  trackerName?: string;
  device: string;
  supportedClasses: string[];
  activeCamerasCount: number;
  totalDetectionsProcessed: number;
  totalTracksActive?: number;
  totalEventsVerified?: number;
  avgLatencyMs: number;
  avgTrackerLatencyMs?: number;
  avgRuleLatencyMs?: number;
  cameras: Record<string, CameraAIStatus>;
}

export interface CameraAIDetectionPayload {
  cameraId: string;
  timestamp: string;
  frameIndex?: number;
  frameTimestamp?: number;
  videoTimestamp?: number;
  duration?: number;
  frameWidth?: number;
  frameHeight?: number;
  latencyMs: number;
  trackerLatencyMs?: number;
  ruleLatencyMs?: number;
  pipelineLatencyMs?: number;
  detections: Detection[];
  tracks: Track[];
  events?: Event[];
  candidateEvents?: Event[];
  ruleTelemetry?: RuleTelemetry;
  activeTracksCount?: number;
  cameraStatus?: AIPipelineState;
  timeline?: CameraAIDetectionPayload[];
}

export interface CameraAIControlRequest {
  action: 'pause' | 'resume' | 'restart' | 'stop' | 'reset_tracker' | 'reset_rules';
}

// ==========================================
// API ENVELOPES & HEALTH CONTRACTS
// ==========================================
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  timestamp?: string;
  version?: string;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
