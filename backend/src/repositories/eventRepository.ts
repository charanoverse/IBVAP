import { Event, EventStatus, EventVerificationState } from '@ibvap/shared';
import { db } from './database.js';

interface EventRow {
  id: string;
  event_type: string;
  camera_id: string;
  rule_id: string | null;
  rule_name: string | null;
  rule_ref: string | null;
  zone_id: string | null;
  line_id: string | null;
  track_id: number | null;
  track_display_id: string | null;
  object_class: string | null;
  confidence: number | null;
  timestamp: string;
  started_at: string | null;
  verified_at: string | null;
  ended_at: string | null;
  video_timestamp: number | null;
  status: EventStatus;
  verification_state: EventVerificationState;
  explanation: string | null;
  evidence_ref: string | null;
  metadata_json: string | null;
  created_at: string;
}

const mapRowToEvent = (row: EventRow): Event => ({
  id: row.id,
  eventType: row.event_type,
  cameraId: row.camera_id,
  ruleId: row.rule_id || undefined,
  ruleName: row.rule_name || undefined,
  ruleRef: row.rule_ref || undefined,
  zoneId: row.zone_id || undefined,
  lineId: row.line_id || undefined,
  trackId: row.track_id !== null ? row.track_id : undefined,
  trackDisplayId: row.track_display_id || undefined,
  objectClass: row.object_class || undefined,
  confidence: row.confidence !== null ? row.confidence : undefined,
  timestamp: row.timestamp,
  startedAt: row.started_at || undefined,
  verifiedAt: row.verified_at || undefined,
  endedAt: row.ended_at || undefined,
  videoTimestamp: row.video_timestamp !== null ? row.video_timestamp : undefined,
  status: row.status || 'VERIFIED',
  verificationState: row.verification_state || 'verified',
  explanation: row.explanation || undefined,
  evidenceRef: row.evidence_ref || undefined,
  metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
  createdAt: row.created_at,
});

export interface EventFilterOptions {
  cameraId?: string;
  eventType?: string;
  status?: EventStatus;
  since?: string;
  limit?: number;
}

export class EventRepository {
  async findAll(options: EventFilterOptions = {}): Promise<Event[]> {
    const limit = options.limit || 50;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options.cameraId) {
      conditions.push('camera_id = ?');
      params.push(options.cameraId.toUpperCase());
    }

    if (options.eventType) {
      conditions.push('event_type = ?');
      params.push(options.eventType);
    }

    if (options.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }

    if (options.since) {
      conditions.push('timestamp >= ?');
      params.push(options.since);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const rows = await db.query<EventRow>(
      `SELECT * FROM events ${whereClause} ORDER BY timestamp DESC LIMIT ?`,
      params
    );
    return rows.map(mapRowToEvent);
  }

  async findByCameraId(cameraId: string, limit = 50): Promise<Event[]> {
    return this.findAll({ cameraId, limit });
  }

  async findById(id: string): Promise<Event | undefined> {
    const row = await db.get<EventRow>('SELECT * FROM events WHERE id = ?', [id]);
    return row ? mapRowToEvent(row) : undefined;
  }

  async create(event: Event): Promise<Event> {
    return this.upsert(event);
  }

  async upsert(event: Event): Promise<Event> {
    const createdAt = event.createdAt || new Date().toISOString();
    const timestamp = event.timestamp || createdAt;
    const status = event.status || 'VERIFIED';
    const verificationState = event.verificationState || 'verified';
    const metadataJson = event.metadata ? JSON.stringify(event.metadata) : '{}';

    await db.run(
      `INSERT INTO events (
        id, event_type, camera_id, rule_id, rule_name, rule_ref, zone_id, line_id,
        track_id, track_display_id, object_class, confidence, timestamp, started_at,
        verified_at, ended_at, video_timestamp, status, verification_state, explanation,
        evidence_ref, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        rule_name = excluded.rule_name,
        confidence = excluded.confidence,
        verified_at = excluded.verified_at,
        ended_at = excluded.ended_at,
        video_timestamp = excluded.video_timestamp,
        status = excluded.status,
        verification_state = excluded.verification_state,
        explanation = excluded.explanation,
        metadata_json = excluded.metadata_json`,
      [
        event.id,
        event.eventType,
        event.cameraId.toUpperCase(),
        event.ruleId || null,
        event.ruleName || null,
        event.ruleRef || null,
        event.zoneId || null,
        event.lineId || null,
        event.trackId !== undefined ? event.trackId : null,
        event.trackDisplayId || null,
        event.objectClass || null,
        event.confidence !== undefined ? event.confidence : null,
        timestamp,
        event.startedAt || timestamp,
        event.verifiedAt || timestamp,
        event.endedAt || null,
        event.videoTimestamp !== undefined ? event.videoTimestamp : null,
        status,
        verificationState,
        event.explanation || null,
        event.evidenceRef || null,
        metadataJson,
        createdAt,
      ]
    );

    return {
      ...event,
      timestamp,
      status,
      verificationState,
      createdAt,
    };
  }

  async updateVerificationState(id: string, state: EventVerificationState): Promise<Event | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    await db.run('UPDATE events SET verification_state = ? WHERE id = ?', [state, id]);
    return { ...existing, verificationState: state };
  }
}

export const eventRepository = new EventRepository();
