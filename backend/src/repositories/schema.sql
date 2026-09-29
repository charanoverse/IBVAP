-- IBVAP SQLite Database Schema (Phase 0 Foundation)

PRAGMA foreign_keys = ON;

-- 1. Camera Table
CREATE TABLE IF NOT EXISTS cameras (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    source_reference TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    capabilities_json TEXT NOT NULL DEFAULT '[]',
    coverage_json TEXT,
    health_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 2. Observation Table
CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY,
    camera_id TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL,
    object_class TEXT NOT NULL,
    local_track_ref TEXT,
    metadata_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL
);

-- 3. Detection Table
CREATE TABLE IF NOT EXISTS detections (
    id TEXT PRIMARY KEY,
    camera_id TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL,
    object_class TEXT NOT NULL,
    confidence REAL NOT NULL,
    bounding_box_json TEXT NOT NULL,
    track_ref TEXT,
    created_at TEXT NOT NULL
);

-- 4. Event Table (Phase 0 + Phase 5 Verified Security Events)
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    camera_id TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    rule_id TEXT,
    rule_name TEXT,
    rule_ref TEXT,
    zone_id TEXT,
    line_id TEXT,
    track_id INTEGER,
    track_display_id TEXT,
    object_class TEXT,
    confidence REAL,
    timestamp TEXT NOT NULL,
    started_at TEXT,
    verified_at TEXT,
    ended_at TEXT,
    video_timestamp REAL,
    status TEXT NOT NULL DEFAULT 'VERIFIED',
    verification_state TEXT NOT NULL DEFAULT 'verified',
    explanation TEXT,
    evidence_ref TEXT,
    metadata_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL
);

-- 5. Incident Table (Phase 6 Management, Deduplication & Review)
CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    camera_id TEXT REFERENCES cameras(id) ON DELETE CASCADE,
    camera_name TEXT,
    zone_id TEXT,
    zone_name TEXT,
    line_id TEXT,
    line_name TEXT,
    primary_event_id TEXT NOT NULL DEFAULT '',
    linked_events_json TEXT NOT NULL DEFAULT '[]',
    priority TEXT NOT NULL DEFAULT 'MEDIUM',
    priority_reason TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT 'NEW',
    review_state TEXT NOT NULL DEFAULT 'NEW',
    opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TEXT,
    acknowledged_by TEXT,
    review_started_at TEXT,
    review_started_by TEXT,
    escalated_at TEXT,
    escalated_by TEXT,
    closed_at TEXT,
    closed_by TEXT,
    outcome TEXT,
    operator_notes TEXT,
    notes_json TEXT NOT NULL DEFAULT '[]',
    evidence_json TEXT NOT NULL DEFAULT '[]',
    evidence_state TEXT NOT NULL DEFAULT 'PENDING',
    explanation TEXT,
    track_id INTEGER,
    track_display_id TEXT,
    object_class TEXT,
    observation_quality TEXT NOT NULL DEFAULT 'GOOD',
    processing_session_id TEXT,
    related_observations_json TEXT NOT NULL DEFAULT '[]',
    recommended_views_json TEXT NOT NULL DEFAULT '[]',
    operator_outcome_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 6. Correlation Table (Phase 7 Cross-Camera Event Correlation)
-- IMPORTANT: Correlation proposes a relationship between observations/events and must NOT imply confirmed identity.
CREATE TABLE IF NOT EXISTS correlations (
    id TEXT PRIMARY KEY,
    source_event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    target_event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    source_camera_id TEXT NOT NULL DEFAULT '',
    target_camera_id TEXT NOT NULL DEFAULT '',
    relationship_type TEXT NOT NULL DEFAULT '',
    time_delta_seconds REAL NOT NULL DEFAULT 0.0,
    score REAL NOT NULL DEFAULT 0.0,
    confidence REAL,
    factors_json TEXT NOT NULL DEFAULT '{}',
    explanation TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT 'candidate',
    reason TEXT NOT NULL DEFAULT '',
    reviewed_at TEXT,
    reviewed_by TEXT,
    review_note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 7. Evidence Table (Phase 6 Temporal Clips & Hashing)
CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    incident_id TEXT REFERENCES incidents(id) ON DELETE CASCADE,
    camera_id TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    primary_event_id TEXT,
    linked_events_json TEXT NOT NULL DEFAULT '[]',
    original_clip TEXT,
    derived_clip TEXT,
    pre_event_clip TEXT,
    event_clip TEXT,
    post_event_clip TEXT,
    snapshot TEXT,
    start_time TEXT NOT NULL DEFAULT '',
    end_time TEXT,
    evidence_hash TEXT,
    hashes_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'PENDING',
    error_message TEXT,
    timestamps_json TEXT NOT NULL DEFAULT '{}',
    manifest_json TEXT,
    manifest_reference TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Sync Record Table
CREATE TABLE IF NOT EXISTS sync_records (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    delivery_state TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    retry_info_json TEXT,
    acknowledgement_state TEXT NOT NULL DEFAULT 'unacknowledged',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 9. Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    metadata_json TEXT DEFAULT '{}'
);

-- 10. Track Table (Phase 4 Persistent Track Summaries)
CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    track_id INTEGER NOT NULL,
    camera_id TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    class_name TEXT NOT NULL,
    confidence REAL NOT NULL,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    first_seen_timestamp REAL NOT NULL,
    last_seen_timestamp REAL NOT NULL,
    total_frames INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    bounding_box_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 11. Camera Health Transitions Table (Phase 8 Health & Visibility Audit Trail)
CREATE TABLE IF NOT EXISTS camera_health_transitions (
    id TEXT PRIMARY KEY,
    camera_id TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    previous_state TEXT NOT NULL,
    new_state TEXT NOT NULL,
    previous_visibility TEXT,
    new_visibility TEXT,
    reason TEXT NOT NULL,
    is_simulated INTEGER NOT NULL DEFAULT 0,
    timestamp TEXT NOT NULL
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_observations_camera_time ON observations(camera_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_detections_camera_time ON detections(camera_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_tracks_camera_status ON tracks(camera_id, status);
CREATE INDEX IF NOT EXISTS idx_tracks_camera_time ON tracks(camera_id, last_seen);
CREATE INDEX IF NOT EXISTS idx_events_camera_time ON events(camera_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_incidents_state ON incidents(review_state);
CREATE INDEX IF NOT EXISTS idx_incidents_priority ON incidents(priority);
CREATE INDEX IF NOT EXISTS idx_correlations_source ON correlations(source_event_id);
CREATE INDEX IF NOT EXISTS idx_correlations_target ON correlations(target_event_id);
CREATE INDEX IF NOT EXISTS idx_evidence_camera ON evidence(camera_id);
CREATE INDEX IF NOT EXISTS idx_sync_state ON sync_records(delivery_state);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
