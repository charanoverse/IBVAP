import { Track, TrackSummary, TrackStatus, BoundingBox } from '@ibvap/shared';
import { db } from './database.js';

interface TrackRow {
  id: string;
  track_id: number;
  camera_id: string;
  class_name: string;
  confidence: number;
  first_seen: string;
  last_seen: string;
  first_seen_timestamp: number;
  last_seen_timestamp: number;
  total_frames: number;
  status: string;
  bounding_box_json: string;
  created_at: string;
  updated_at: string;
}

const mapRowToTrackSummary = (row: TrackRow): TrackSummary => ({
  id: row.id,
  trackId: row.track_id,
  cameraId: row.camera_id,
  className: row.class_name,
  confidence: row.confidence,
  firstSeen: row.first_seen,
  lastSeen: row.last_seen,
  firstSeenTimestamp: row.first_seen_timestamp,
  lastSeenTimestamp: row.last_seen_timestamp,
  totalFrames: row.total_frames,
  status: row.status as TrackStatus,
  boundingBox: JSON.parse(row.bounding_box_json) as BoundingBox,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class TrackRepository {
  async findAll(limit = 50, status?: string): Promise<TrackSummary[]> {
    let sql = 'SELECT * FROM tracks';
    const params: (string | number)[] = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status.toUpperCase());
    }
    sql += ' ORDER BY last_seen DESC LIMIT ?';
    params.push(limit);

    const rows = await db.query<TrackRow>(sql, params);
    return rows.map(mapRowToTrackSummary);
  }

  async findByCameraId(cameraId: string, limit = 50, status?: string): Promise<TrackSummary[]> {
    let sql = 'SELECT * FROM tracks WHERE camera_id = ?';
    const params: (string | number)[] = [cameraId.toUpperCase()];
    if (status) {
      sql += ' AND status = ?';
      params.push(status.toUpperCase());
    }
    sql += ' ORDER BY last_seen DESC LIMIT ?';
    params.push(limit);

    const rows = await db.query<TrackRow>(sql, params);
    return rows.map(mapRowToTrackSummary);
  }

  async findById(id: string): Promise<TrackSummary | undefined> {
    const row = await db.get<TrackRow>('SELECT * FROM tracks WHERE id = ?', [id]);
    return row ? mapRowToTrackSummary(row) : undefined;
  }

  async upsert(track: Track): Promise<TrackSummary> {
    const now = new Date().toISOString();
    const existing = await this.findById(track.id);

    if (existing) {
      const updatedTotalFrames = existing.totalFrames + 1;
      await db.run(
        `UPDATE tracks
         SET class_name = ?, confidence = ?, last_seen = ?, last_seen_timestamp = ?, total_frames = ?, status = ?, bounding_box_json = ?, updated_at = ?
         WHERE id = ?`,
        [
          track.className,
          track.confidence,
          track.lastSeen || now,
          track.lastSeenTimestamp ?? 0.0,
          updatedTotalFrames,
          track.status,
          JSON.stringify(track.boundingBox),
          now,
          track.id,
        ]
      );
      return {
        ...existing,
        className: track.className,
        confidence: track.confidence,
        lastSeen: track.lastSeen || now,
        lastSeenTimestamp: track.lastSeenTimestamp ?? 0.0,
        totalFrames: updatedTotalFrames,
        status: track.status,
        boundingBox: track.boundingBox,
        updatedAt: now,
      };
    } else {
      await db.run(
        `INSERT INTO tracks (id, track_id, camera_id, class_name, confidence, first_seen, last_seen, first_seen_timestamp, last_seen_timestamp, total_frames, status, bounding_box_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          track.id,
          track.trackId,
          track.cameraId,
          track.className,
          track.confidence,
          track.firstSeen || now,
          track.lastSeen || now,
          track.firstSeenTimestamp ?? 0.0,
          track.lastSeenTimestamp ?? 0.0,
          track.ageFrames || 1,
          track.status,
          JSON.stringify(track.boundingBox),
          track.createdAt || now,
          now,
        ]
      );
      return {
        id: track.id,
        trackId: track.trackId,
        cameraId: track.cameraId,
        className: track.className,
        confidence: track.confidence,
        firstSeen: track.firstSeen || now,
        lastSeen: track.lastSeen || now,
        firstSeenTimestamp: track.firstSeenTimestamp ?? 0.0,
        lastSeenTimestamp: track.lastSeenTimestamp ?? 0.0,
        totalFrames: track.ageFrames || 1,
        status: track.status,
        boundingBox: track.boundingBox,
        createdAt: track.createdAt || now,
        updatedAt: now,
      };
    }
  }
}

export const trackRepository = new TrackRepository();
