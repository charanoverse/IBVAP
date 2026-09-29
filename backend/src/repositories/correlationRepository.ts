import { Correlation, CorrelationFactors, CorrelationFilterOptions, CorrelationState } from '@ibvap/shared';
import { db } from './database.js';

interface CorrelationRow {
  id: string;
  source_event_id: string;
  target_event_id: string;
  source_camera_id: string;
  target_camera_id: string;
  relationship_type: string;
  time_delta_seconds: number;
  score: number;
  confidence: number | null;
  factors_json: string;
  explanation: string;
  state: CorrelationState;
  reason: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

const safeParseJson = <T>(json: string | null | undefined, fallback: T): T => {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
};

const mapRowToCorrelation = (row: CorrelationRow): Correlation => {
  const factors = safeParseJson<CorrelationFactors>(row.factors_json, {
    topologyMatch: true,
    temporalMatch: true,
    directionMatch: true,
    eventTypeMatch: true,
    timeDeltaSeconds: row.time_delta_seconds || 0,
    minAllowedTimeSeconds: 0,
    maxAllowedTimeSeconds: 60,
  });

  return {
    id: row.id,
    sourceEventId: row.source_event_id,
    targetEventId: row.target_event_id,
    sourceCameraId: row.source_camera_id || '',
    targetCameraId: row.target_camera_id || '',
    relationshipType: row.relationship_type || '',
    timeDeltaSeconds: row.time_delta_seconds || 0,
    score: row.score !== undefined && row.score !== null ? row.score : (row.confidence || 0),
    confidence: row.confidence !== null ? row.confidence : row.score,
    factors,
    explanation: row.explanation || row.reason || '',
    state: row.state,
    reason: row.reason || row.explanation || '',
    reviewedAt: row.reviewed_at || undefined,
    reviewedBy: row.reviewed_by || undefined,
    reviewNote: row.review_note || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export class CorrelationRepository {
  async findAll(options: CorrelationFilterOptions = {}): Promise<Correlation[]> {
    const {
      state,
      cameraId,
      sourceCameraId,
      targetCameraId,
      eventId,
      minScore,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = options;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (state) {
      conditions.push('state = ?');
      params.push(state);
    }

    if (cameraId) {
      conditions.push('(source_camera_id = ? OR target_camera_id = ?)');
      params.push(cameraId, cameraId);
    }

    if (sourceCameraId) {
      conditions.push('source_camera_id = ?');
      params.push(sourceCameraId);
    }

    if (targetCameraId) {
      conditions.push('target_camera_id = ?');
      params.push(targetCameraId);
    }

    if (eventId) {
      conditions.push('(source_event_id = ? OR target_event_id = ?)');
      params.push(eventId, eventId);
    }

    if (minScore !== undefined) {
      conditions.push('score >= ?');
      params.push(minScore);
    }

    if (startDate) {
      conditions.push('created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('created_at <= ?');
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM correlations ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = await db.query<CorrelationRow>(sql, params);
    return rows.map(mapRowToCorrelation);
  }

  async findById(id: string): Promise<Correlation | undefined> {
    const row = await db.get<CorrelationRow>('SELECT * FROM correlations WHERE id = ?', [id]);
    return row ? mapRowToCorrelation(row) : undefined;
  }

  async findByEventId(eventId: string): Promise<Correlation[]> {
    const rows = await db.query<CorrelationRow>(
      'SELECT * FROM correlations WHERE source_event_id = ? OR target_event_id = ? ORDER BY score DESC, created_at DESC',
      [eventId, eventId]
    );
    return rows.map(mapRowToCorrelation);
  }

  async findByPair(eventIdA: string, eventIdB: string): Promise<Correlation | undefined> {
    const row = await db.get<CorrelationRow>(
      `SELECT * FROM correlations 
       WHERE (source_event_id = ? AND target_event_id = ?) 
          OR (source_event_id = ? AND target_event_id = ?) 
       LIMIT 1`,
      [eventIdA, eventIdB, eventIdB, eventIdA]
    );
    return row ? mapRowToCorrelation(row) : undefined;
  }

  async create(correlation: Correlation): Promise<Correlation> {
    const now = new Date().toISOString();
    const createdAt = correlation.createdAt || now;
    const updatedAt = correlation.updatedAt || now;
    const score = correlation.score !== undefined ? correlation.score : (correlation.confidence || 0);
    const confidence = correlation.confidence !== undefined ? correlation.confidence : score;

    await db.run(
      `INSERT INTO correlations (
        id, source_event_id, target_event_id, source_camera_id, target_camera_id,
        relationship_type, time_delta_seconds, score, confidence, factors_json,
        explanation, state, reason, reviewed_at, reviewed_by, review_note,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        state = excluded.state,
        score = excluded.score,
        confidence = excluded.confidence,
        factors_json = excluded.factors_json,
        explanation = excluded.explanation,
        reason = excluded.reason,
        reviewed_at = excluded.reviewed_at,
        reviewed_by = excluded.reviewed_by,
        review_note = excluded.review_note,
        updated_at = excluded.updated_at`,
      [
        correlation.id,
        correlation.sourceEventId,
        correlation.targetEventId,
        correlation.sourceCameraId || '',
        correlation.targetCameraId || '',
        correlation.relationshipType || '',
        correlation.timeDeltaSeconds || 0,
        score,
        confidence,
        JSON.stringify(correlation.factors || {}),
        correlation.explanation || correlation.reason || '',
        correlation.state || 'candidate',
        correlation.reason || correlation.explanation || '',
        correlation.reviewedAt || null,
        correlation.reviewedBy || null,
        correlation.reviewNote || null,
        createdAt,
        updatedAt,
      ]
    );

    return { ...correlation, score, confidence, createdAt, updatedAt };
  }

  async updateState(
    id: string,
    state: CorrelationState,
    reviewerInfo?: { reviewedBy?: string; reviewNote?: string }
  ): Promise<Correlation | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    const updatedAt = new Date().toISOString();
    const reviewedAt = state !== 'candidate' ? (existing.reviewedAt || updatedAt) : existing.reviewedAt;
    const reviewedBy = reviewerInfo?.reviewedBy || existing.reviewedBy || 'Operator';
    const reviewNote = reviewerInfo?.reviewNote !== undefined ? reviewerInfo.reviewNote : existing.reviewNote;

    await db.run(
      `UPDATE correlations 
       SET state = ?, reviewed_at = ?, reviewed_by = ?, review_note = ?, updated_at = ? 
       WHERE id = ?`,
      [state, reviewedAt || null, reviewedBy || null, reviewNote || null, updatedAt, id]
    );

    return {
      ...existing,
      state,
      reviewedAt: reviewedAt || undefined,
      reviewedBy: reviewedBy || undefined,
      reviewNote: reviewNote || undefined,
      updatedAt,
    };
  }

  async addNote(id: string, reviewNote: string, reviewedBy?: string): Promise<Correlation | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    const updatedAt = new Date().toISOString();
    const updatedNote = existing.reviewNote ? `${existing.reviewNote}\n${reviewNote}` : reviewNote;

    await db.run(
      `UPDATE correlations 
       SET review_note = ?, reviewed_by = COALESCE(?, reviewed_by), updated_at = ? 
       WHERE id = ?`,
      [updatedNote, reviewedBy || null, updatedAt, id]
    );

    return {
      ...existing,
      reviewNote: updatedNote,
      reviewedBy: reviewedBy || existing.reviewedBy,
      updatedAt,
    };
  }
}

export const correlationRepository = new CorrelationRepository();
