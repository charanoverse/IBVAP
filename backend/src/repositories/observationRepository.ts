import { Observation } from '@ibvap/shared';
import { db } from './database.js';

interface ObservationRow {
  id: string;
  camera_id: string;
  timestamp: string;
  object_class: string;
  local_track_ref: string | null;
  metadata_json: string | null;
  created_at: string;
}

const mapRowToObservation = (row: ObservationRow): Observation => ({
  id: row.id,
  cameraId: row.camera_id,
  timestamp: row.timestamp,
  objectClass: row.object_class,
  localTrackRef: row.local_track_ref || undefined,
  metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
  createdAt: row.created_at,
});

export class ObservationRepository {
  async findAll(limit = 50): Promise<Observation[]> {
    const rows = await db.query<ObservationRow>(
      'SELECT * FROM observations ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
    return rows.map(mapRowToObservation);
  }

  async findByCameraId(cameraId: string, limit = 50): Promise<Observation[]> {
    const rows = await db.query<ObservationRow>(
      'SELECT * FROM observations WHERE camera_id = ? ORDER BY timestamp DESC LIMIT ?',
      [cameraId, limit]
    );
    return rows.map(mapRowToObservation);
  }

  async findById(id: string): Promise<Observation | undefined> {
    const row = await db.get<ObservationRow>('SELECT * FROM observations WHERE id = ?', [id]);
    return row ? mapRowToObservation(row) : undefined;
  }

  async create(obs: Observation): Promise<Observation> {
    const createdAt = obs.createdAt || new Date().toISOString();
    await db.run(
      `INSERT INTO observations (id, camera_id, timestamp, object_class, local_track_ref, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        obs.id,
        obs.cameraId,
        obs.timestamp,
        obs.objectClass,
        obs.localTrackRef || null,
        obs.metadata ? JSON.stringify(obs.metadata) : '{}',
        createdAt,
      ]
    );
    return { ...obs, createdAt };
  }
}

export const observationRepository = new ObservationRepository();
