import {
  Evidence,
  EvidenceHashRecord,
  EvidenceManifest,
  EvidenceTimestamps,
  IncidentEvidenceState,
} from '@ibvap/shared';
import { db } from './database.js';

interface EvidenceRow {
  id: string;
  incident_id: string | null;
  camera_id: string;
  primary_event_id: string | null;
  linked_events_json: string;
  original_clip: string | null;
  derived_clip: string | null;
  pre_event_clip: string | null;
  event_clip: string | null;
  post_event_clip: string | null;
  snapshot: string | null;
  start_time: string;
  end_time: string | null;
  evidence_hash: string | null;
  hashes_json: string;
  status: string;
  error_message: string | null;
  timestamps_json: string;
  manifest_json: string | null;
  manifest_reference: string | null;
  created_at: string;
  updated_at: string;
}

const mapRowToEvidence = (row: EvidenceRow): Evidence => {
  const linkedEventIds = JSON.parse(row.linked_events_json || '[]') as string[];
  const hashes = JSON.parse(row.hashes_json || '{}') as EvidenceHashRecord;
  const timestampsParsed = JSON.parse(row.timestamps_json || '{}') as EvidenceTimestamps;
  const manifest = row.manifest_json ? (JSON.parse(row.manifest_json) as EvidenceManifest) : undefined;

  const timestamps: EvidenceTimestamps = {
    startTime: row.start_time || timestampsParsed.startTime || '',
    endTime: row.end_time || timestampsParsed.endTime || undefined,
    eventStartedAt: timestampsParsed.eventStartedAt,
    eventVerifiedAt: timestampsParsed.eventVerifiedAt,
    preStartSeconds: timestampsParsed.preStartSeconds || 0,
    eventStartSeconds: timestampsParsed.eventStartSeconds || 0,
    eventEndSeconds: timestampsParsed.eventEndSeconds || 0,
    postEndSeconds: timestampsParsed.postEndSeconds || 0,
    snapshotTimestampSeconds: timestampsParsed.snapshotTimestampSeconds || 0,
  };

  return {
    id: row.id,
    incidentId: row.incident_id || row.id.replace('EVD-', ''),
    cameraId: row.camera_id,
    primaryEventId: row.primary_event_id || undefined,
    linkedEventIds,
    originalClip: row.original_clip || undefined,
    derivedClip: row.derived_clip || row.event_clip || undefined,
    preEventClip: row.pre_event_clip || undefined,
    eventClip: row.event_clip || undefined,
    postEventClip: row.post_event_clip || undefined,
    snapshot: row.snapshot || undefined,
    manifestReference: row.manifest_reference || undefined,
    evidenceHash: row.evidence_hash || hashes.manifest || hashes.event || undefined,
    hashes,
    status: (row.status || 'PENDING').toUpperCase() as IncidentEvidenceState,
    errorMessage: row.error_message || undefined,
    timestamps,
    manifest,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export class EvidenceRepository {
  async findAll(limit = 50): Promise<Evidence[]> {
    const rows = await db.query<EvidenceRow>(
      'SELECT * FROM evidence ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    return rows.map(mapRowToEvidence);
  }

  async findById(id: string): Promise<Evidence | undefined> {
    const row = await db.get<EvidenceRow>('SELECT * FROM evidence WHERE id = ?', [id]);
    return row ? mapRowToEvidence(row) : undefined;
  }

  async findByIncidentId(incidentId: string): Promise<Evidence | undefined> {
    const row = await db.get<EvidenceRow>(
      'SELECT * FROM evidence WHERE incident_id = ? OR id = ? LIMIT 1',
      [incidentId, `EVD-${incidentId}`]
    );
    return row ? mapRowToEvidence(row) : undefined;
  }

  async findByCameraId(cameraId: string, limit = 50): Promise<Evidence[]> {
    const rows = await db.query<EvidenceRow>(
      'SELECT * FROM evidence WHERE camera_id = ? ORDER BY created_at DESC LIMIT ?',
      [cameraId, limit]
    );
    return rows.map(mapRowToEvidence);
  }

  async create(evidence: Evidence): Promise<Evidence> {
    const now = new Date().toISOString();
    const createdAt = evidence.createdAt || now;
    const updatedAt = evidence.updatedAt || now;

    const linkedEventIds = evidence.linkedEventIds || [];
    const hashes = evidence.hashes || {};
    const timestamps = evidence.timestamps || {
      startTime: '',
      preStartSeconds: 0,
      eventStartSeconds: 0,
      eventEndSeconds: 0,
      postEndSeconds: 0,
      snapshotTimestampSeconds: 0,
    };

    await db.run(
      `INSERT INTO evidence (
        id, incident_id, camera_id, primary_event_id, linked_events_json,
        original_clip, derived_clip, pre_event_clip, event_clip, post_event_clip,
        snapshot, start_time, end_time, evidence_hash, hashes_json,
        status, error_message, timestamps_json, manifest_json, manifest_reference,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?
      )`,
      [
        evidence.id,
        evidence.incidentId || null,
        evidence.cameraId,
        evidence.primaryEventId || null,
        JSON.stringify(linkedEventIds),
        evidence.originalClip || null,
        evidence.derivedClip || evidence.eventClip || null,
        evidence.preEventClip || null,
        evidence.eventClip || null,
        evidence.postEventClip || null,
        evidence.snapshot || null,
        timestamps.startTime || '',
        timestamps.endTime || null,
        evidence.evidenceHash || hashes.manifest || null,
        JSON.stringify(hashes),
        evidence.status || 'PENDING',
        evidence.errorMessage || null,
        JSON.stringify(timestamps),
        evidence.manifest ? JSON.stringify(evidence.manifest) : null,
        evidence.manifestReference || null,
        createdAt,
        updatedAt,
      ]
    );

    return { ...evidence, createdAt, updatedAt };
  }

  async update(evidence: Evidence): Promise<Evidence> {
    const updatedAt = new Date().toISOString();
    const linkedEventIds = evidence.linkedEventIds || [];
    const hashes = evidence.hashes || {};
    const timestamps = evidence.timestamps;

    await db.run(
      `UPDATE evidence SET
        incident_id = ?,
        camera_id = ?,
        primary_event_id = ?,
        linked_events_json = ?,
        original_clip = ?,
        derived_clip = ?,
        pre_event_clip = ?,
        event_clip = ?,
        post_event_clip = ?,
        snapshot = ?,
        start_time = ?,
        end_time = ?,
        evidence_hash = ?,
        hashes_json = ?,
        status = ?,
        error_message = ?,
        timestamps_json = ?,
        manifest_json = ?,
        manifest_reference = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        evidence.incidentId || null,
        evidence.cameraId,
        evidence.primaryEventId || null,
        JSON.stringify(linkedEventIds),
        evidence.originalClip || null,
        evidence.derivedClip || evidence.eventClip || null,
        evidence.preEventClip || null,
        evidence.eventClip || null,
        evidence.postEventClip || null,
        evidence.snapshot || null,
        timestamps.startTime || '',
        timestamps.endTime || null,
        evidence.evidenceHash || hashes.manifest || null,
        JSON.stringify(hashes),
        evidence.status || 'PENDING',
        evidence.errorMessage || null,
        JSON.stringify(timestamps),
        evidence.manifest ? JSON.stringify(evidence.manifest) : null,
        evidence.manifestReference || null,
        updatedAt,
        evidence.id,
      ]
    );

    return { ...evidence, updatedAt };
  }
}

export const evidenceRepository = new EvidenceRepository();
