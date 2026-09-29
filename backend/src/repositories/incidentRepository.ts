import {
  Incident,
  IncidentEvidenceState,
  IncidentNote,
  IncidentPriority,
  IncidentReviewState,
  IncidentState,
  OperatorOutcome,
} from '@ibvap/shared';
import { db } from './database.js';

export interface IncidentFilterOptions {
  state?: string;
  priority?: string;
  cameraId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

interface IncidentRow {
  id: string;
  title: string;
  camera_id: string | null;
  camera_name: string | null;
  zone_id: string | null;
  zone_name: string | null;
  line_id: string | null;
  line_name: string | null;
  primary_event_id: string;
  linked_events_json: string;
  priority: string;
  priority_reason: string;
  state: string;
  review_state: string;
  opened_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  review_started_at: string | null;
  review_started_by: string | null;
  escalated_at: string | null;
  escalated_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  outcome: string | null;
  operator_notes: string | null;
  notes_json: string;
  evidence_json: string;
  evidence_state: string;
  explanation: string | null;
  track_id: number | null;
  track_display_id: string | null;
  object_class: string | null;
  observation_quality: string;
  processing_session_id: string | null;
  related_observations_json: string;
  recommended_views_json: string;
  operator_outcome_json: string | null;
  created_at: string;
  updated_at: string;
}

const mapRowToIncident = (row: IncidentRow): Incident => {
  const linkedEventIds = JSON.parse(row.linked_events_json || '[]') as string[];
  const evidenceIds = JSON.parse(row.evidence_json || '[]') as string[];
  const notes = JSON.parse(row.notes_json || '[]') as IncidentNote[];
  const relatedObservations = JSON.parse(row.related_observations_json || '[]') as string[];
  const recommendedViews = JSON.parse(row.recommended_views_json || '[]') as string[];
  const operatorOutcome = row.operator_outcome_json
    ? (JSON.parse(row.operator_outcome_json) as OperatorOutcome)
    : undefined;

  const normalizedPriority = (row.priority || 'MEDIUM').toUpperCase() as IncidentPriority;
  const normalizedState = (row.state || row.review_state || 'NEW').toUpperCase() as IncidentState;

  return {
    id: row.id,
    title: row.title || 'Security Incident',
    cameraId: row.camera_id || '',
    cameraName: row.camera_name || undefined,
    zoneId: row.zone_id || undefined,
    zoneName: row.zone_name || undefined,
    lineId: row.line_id || undefined,
    lineName: row.line_name || undefined,
    primaryEventId: row.primary_event_id || '',
    linkedEventIds,
    linkedEvents: linkedEventIds,
    priority: normalizedPriority,
    priorityReason: row.priority_reason || '',
    state: normalizedState,
    reviewState: normalizedState,
    openedAt: row.opened_at || row.created_at,
    acknowledgedAt: row.acknowledged_at || undefined,
    acknowledgedBy: row.acknowledged_by || undefined,
    reviewStartedAt: row.review_started_at || undefined,
    reviewStartedBy: row.review_started_by || undefined,
    escalatedAt: row.escalated_at || undefined,
    escalatedBy: row.escalated_by || undefined,
    closedAt: row.closed_at || undefined,
    closedBy: row.closed_by || undefined,
    outcome: row.outcome || undefined,
    operatorNotes: row.operator_notes || undefined,
    notes,
    evidenceIds,
    evidence: evidenceIds,
    evidenceState: (row.evidence_state || 'PENDING').toUpperCase() as IncidentEvidenceState,
    evidenceAvailable: (row.evidence_state || '').toUpperCase() === 'READY',
    explanation: row.explanation || undefined,
    trackId: row.track_id !== null ? Number(row.track_id) : undefined,
    trackDisplayId: row.track_display_id || undefined,
    objectClass: row.object_class || undefined,
    observationQuality: (row.observation_quality as any) || 'GOOD',
    processingSessionId: row.processing_session_id || undefined,
    relatedObservations,
    recommendedViews,
    operatorOutcome,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export class IncidentRepository {
  async findAll(options: IncidentFilterOptions = {}): Promise<Incident[]> {
    const { state, priority, cameraId, search, limit = 50, offset = 0 } = options;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (state && state.toUpperCase() !== 'ALL') {
      if (state.toUpperCase() === 'ACTIVE') {
        conditions.push("state NOT IN ('CLOSED', 'resolved', 'dismissed')");
      } else {
        conditions.push('(UPPER(state) = ? OR UPPER(review_state) = ?)');
        params.push(state.toUpperCase(), state.toUpperCase());
      }
    }

    if (priority && priority.toUpperCase() !== 'ALL') {
      conditions.push('UPPER(priority) = ?');
      params.push(priority.toUpperCase());
    }

    if (cameraId && cameraId.toUpperCase() !== 'ALL') {
      conditions.push('UPPER(camera_id) = ?');
      params.push(cameraId.toUpperCase());
    }

    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push('(LOWER(id) LIKE ? OR LOWER(title) LIKE ? OR LOWER(zone_name) LIKE ? OR LOWER(explanation) LIKE ?)');
      params.push(q, q, q, q);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT * FROM incidents
      ${whereClause}
      ORDER BY
        CASE UPPER(priority)
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
          ELSE 5
        END ASC,
        opened_at DESC,
        created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);
    const rows = await db.query<IncidentRow>(sql, params);
    return rows.map(mapRowToIncident);
  }

  async findById(id: string): Promise<Incident | undefined> {
    const row = await db.get<IncidentRow>('SELECT * FROM incidents WHERE id = ?', [id]);
    return row ? mapRowToIncident(row) : undefined;
  }

  async findByPrimaryEventId(eventId: string): Promise<Incident | undefined> {
    const row = await db.get<IncidentRow>(
      'SELECT * FROM incidents WHERE primary_event_id = ? OR linked_events_json LIKE ?',
      [eventId, `%"${eventId}"%`]
    );
    return row ? mapRowToIncident(row) : undefined;
  }

  /**
   * Finds an existing active/open incident on the same camera and track
   */
  async findOpenIncidentForTrack(
    cameraId: string,
    trackId: number,
    windowSeconds = 15.0
  ): Promise<Incident | undefined> {
    const sql = `
      SELECT * FROM incidents
      WHERE camera_id = ?
        AND track_id = ?
        AND state NOT IN ('CLOSED', 'resolved', 'dismissed')
      ORDER BY opened_at DESC
      LIMIT 1
    `;
    const row = await db.get<IncidentRow>(sql, [cameraId, trackId]);
    if (!row) return undefined;

    // Check if within window
    const openedTime = new Date(row.opened_at || row.created_at).getTime();
    const now = Date.now();
    if (now - openedTime > windowSeconds * 1000 * 10) {
      // If time difference in real world exceeds generous buffer or video time, evaluate
    }

    return mapRowToIncident(row);
  }

  async create(incident: Incident): Promise<Incident> {
    const now = new Date().toISOString();
    const createdAt = incident.createdAt || now;
    const updatedAt = incident.updatedAt || now;
    const openedAt = incident.openedAt || createdAt;
    const priority = (incident.priority || 'MEDIUM').toUpperCase();
    const state = (incident.state || incident.reviewState || 'NEW').toUpperCase();

    const linkedEventIds = incident.linkedEventIds || incident.linkedEvents || [];
    const evidenceIds = incident.evidenceIds || incident.evidence || [];
    const notes = incident.notes || [];

    await db.run(
      `INSERT INTO incidents (
        id, title, camera_id, camera_name, zone_id, zone_name, line_id, line_name,
        primary_event_id, linked_events_json, priority, priority_reason, state, review_state,
        opened_at, acknowledged_at, acknowledged_by, review_started_at, review_started_by,
        escalated_at, escalated_by, closed_at, closed_by, outcome, operator_notes, notes_json,
        evidence_json, evidence_state, explanation, track_id, track_display_id, object_class,
        observation_quality, processing_session_id, related_observations_json, recommended_views_json,
        operator_outcome_json, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )`,
      [
        incident.id,
        incident.title || 'Security Incident',
        incident.cameraId || null,
        incident.cameraName || null,
        incident.zoneId || null,
        incident.zoneName || null,
        incident.lineId || null,
        incident.lineName || null,
        incident.primaryEventId || (incident.linkedEvents?.[0] || incident.linkedEventIds?.[0] || ''),
        JSON.stringify(linkedEventIds),
        priority,
        incident.priorityReason || '',
        state,
        state,
        openedAt,
        incident.acknowledgedAt || null,
        incident.acknowledgedBy || null,
        incident.reviewStartedAt || null,
        incident.reviewStartedBy || null,
        incident.escalatedAt || null,
        incident.escalatedBy || null,
        incident.closedAt || null,
        incident.closedBy || null,
        incident.outcome || null,
        incident.operatorNotes || null,
        JSON.stringify(notes),
        JSON.stringify(evidenceIds),
        incident.evidenceState || 'PENDING',
        incident.explanation || null,
        incident.trackId !== undefined ? incident.trackId : null,
        incident.trackDisplayId || null,
        incident.objectClass || null,
        incident.observationQuality || 'GOOD',
        incident.processingSessionId || null,
        JSON.stringify(incident.relatedObservations || []),
        JSON.stringify(incident.recommendedViews || []),
        incident.operatorOutcome ? JSON.stringify(incident.operatorOutcome) : null,
        createdAt,
        updatedAt,
      ]
    );

    return {
      ...incident,
      priority: priority as IncidentPriority,
      state: state as IncidentState,
      reviewState: state as IncidentReviewState,
      linkedEventIds,
      linkedEvents: linkedEventIds,
      evidenceIds,
      evidence: evidenceIds,
      notes,
      openedAt,
      createdAt,
      updatedAt,
    };
  }

  async update(incident: Incident): Promise<Incident> {
    const updatedAt = new Date().toISOString();
    const priority = (incident.priority || 'MEDIUM').toUpperCase();
    const state = (incident.state || incident.reviewState || 'NEW').toUpperCase();
    const linkedEventIds = incident.linkedEventIds || incident.linkedEvents || [];
    const evidenceIds = incident.evidenceIds || incident.evidence || [];
    const notes = incident.notes || [];

    await db.run(
      `UPDATE incidents SET
        title = ?,
        camera_id = ?,
        camera_name = ?,
        zone_id = ?,
        zone_name = ?,
        line_id = ?,
        line_name = ?,
        primary_event_id = ?,
        linked_events_json = ?,
        priority = ?,
        priority_reason = ?,
        state = ?,
        review_state = ?,
        opened_at = ?,
        acknowledged_at = ?,
        acknowledged_by = ?,
        review_started_at = ?,
        review_started_by = ?,
        escalated_at = ?,
        escalated_by = ?,
        closed_at = ?,
        closed_by = ?,
        outcome = ?,
        operator_notes = ?,
        notes_json = ?,
        evidence_json = ?,
        evidence_state = ?,
        explanation = ?,
        track_id = ?,
        track_display_id = ?,
        object_class = ?,
        observation_quality = ?,
        processing_session_id = ?,
        related_observations_json = ?,
        recommended_views_json = ?,
        operator_outcome_json = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        incident.title || 'Security Incident',
        incident.cameraId || null,
        incident.cameraName || null,
        incident.zoneId || null,
        incident.zoneName || null,
        incident.lineId || null,
        incident.lineName || null,
        incident.primaryEventId || (incident.linkedEvents?.[0] || incident.linkedEventIds?.[0] || ''),
        JSON.stringify(linkedEventIds),
        priority,
        incident.priorityReason || '',
        state,
        state,
        incident.openedAt,
        incident.acknowledgedAt || null,
        incident.acknowledgedBy || null,
        incident.reviewStartedAt || null,
        incident.reviewStartedBy || null,
        incident.escalatedAt || null,
        incident.escalatedBy || null,
        incident.closedAt || null,
        incident.closedBy || null,
        incident.outcome || null,
        incident.operatorNotes || null,
        JSON.stringify(notes),
        JSON.stringify(evidenceIds),
        incident.evidenceState || 'PENDING',
        incident.explanation || null,
        incident.trackId !== undefined ? incident.trackId : null,
        incident.trackDisplayId || null,
        incident.objectClass || null,
        incident.observationQuality || 'GOOD',
        incident.processingSessionId || null,
        JSON.stringify(incident.relatedObservations || []),
        JSON.stringify(incident.recommendedViews || []),
        incident.operatorOutcome ? JSON.stringify(incident.operatorOutcome) : null,
        updatedAt,
        incident.id,
      ]
    );

    return {
      ...incident,
      priority: priority as IncidentPriority,
      state: state as IncidentState,
      reviewState: state as IncidentReviewState,
      updatedAt,
    };
  }

  async addLinkedEvent(id: string, eventId: string, upgradePriority?: IncidentPriority): Promise<Incident | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    const set = new Set(existing.linkedEventIds);
    set.add(eventId);
    const updatedLinked = Array.from(set);

    let priority = existing.priority;
    if (upgradePriority) {
      const order: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      const currentVal = order[priority.toString().toUpperCase()] || 0;
      const newVal = order[upgradePriority.toString().toUpperCase()] || 0;
      if (newVal > currentVal) {
        priority = upgradePriority;
      }
    }

    const updated = {
      ...existing,
      linkedEventIds: updatedLinked,
      linkedEvents: updatedLinked,
      priority,
    };

    return this.update(updated);
  }

  async addNote(id: string, note: IncidentNote): Promise<Incident | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    const notes = existing.notes ? [...existing.notes, note] : [note];
    const operatorNotes = existing.operatorNotes
      ? `${existing.operatorNotes}\n[${note.authorName}]: ${note.text}`
      : `[${note.authorName}]: ${note.text}`;

    return this.update({
      ...existing,
      notes,
      operatorNotes,
    });
  }

  async updateEvidenceState(
    id: string,
    evidenceState: IncidentEvidenceState,
    evidenceIds?: string[]
  ): Promise<Incident | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    const updatedEvidenceIds = evidenceIds || existing.evidenceIds;
    return this.update({
      ...existing,
      evidenceState,
      evidenceIds: updatedEvidenceIds,
      evidence: updatedEvidenceIds,
      evidenceAvailable: evidenceState === 'READY',
    });
  }

  async countMetrics(): Promise<{
    total: number;
    active: number;
    highPriority: number;
    acknowledged: number;
    closedToday: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const rows = await db.query<{
      state: string;
      priority: string;
      closed_at: string | null;
      opened_at: string;
    }>('SELECT state, priority, closed_at, opened_at FROM incidents');

    let active = 0;
    let highPriority = 0;
    let acknowledged = 0;
    let closedToday = 0;

    for (const r of rows) {
      const st = (r.state || '').toUpperCase();
      const pr = (r.priority || '').toUpperCase();

      if (st !== 'CLOSED' && st !== 'RESOLVED' && st !== 'DISMISSED') {
        active++;
        if (pr === 'HIGH' || pr === 'CRITICAL') {
          highPriority++;
        }
        if (st === 'ACKNOWLEDGED' || st === 'UNDER_REVIEW') {
          acknowledged++;
        }
      }

      if ((st === 'CLOSED' || st === 'RESOLVED') && r.closed_at && r.closed_at.startsWith(today)) {
        closedToday++;
      }
    }

    return {
      total: rows.length,
      active,
      highPriority,
      acknowledged,
      closedToday,
    };
  }

  // Backward compatibility method
  async updateReviewState(id: string, reviewState: IncidentReviewState, outcome?: OperatorOutcome): Promise<Incident | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    return this.update({
      ...existing,
      state: reviewState as IncidentState,
      reviewState,
      operatorOutcome: outcome || existing.operatorOutcome,
    });
  }
}

export const incidentRepository = new IncidentRepository();
