import { Camera, CameraStatus, CameraCoverage, CameraHealth } from '@ibvap/shared';
import { db } from './database.js';

interface CameraRow {
  id: string;
  name: string;
  description: string | null;
  source_reference: string;
  status: CameraStatus;
  capabilities_json: string;
  coverage_json: string | null;
  health_json: string | null;
  created_at: string;
  updated_at: string;
}

const mapRowToCamera = (row: CameraRow): Camera => ({
  id: row.id,
  name: row.name,
  description: row.description || undefined,
  sourceReference: row.source_reference,
  status: row.status,
  capabilities: JSON.parse(row.capabilities_json || '[]') as string[],
  coverage: row.coverage_json ? (JSON.parse(row.coverage_json) as CameraCoverage) : undefined,
  health: row.health_json ? (JSON.parse(row.health_json) as CameraHealth) : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class CameraRepository {
  async findAll(): Promise<Camera[]> {
    const rows = await db.query<CameraRow>('SELECT * FROM cameras ORDER BY name ASC');
    return rows.map(mapRowToCamera);
  }

  async findById(id: string): Promise<Camera | undefined> {
    const row = await db.get<CameraRow>('SELECT * FROM cameras WHERE id = ?', [id]);
    return row ? mapRowToCamera(row) : undefined;
  }

  async create(camera: Camera): Promise<Camera> {
    const now = new Date().toISOString();
    const createdAt = camera.createdAt || now;
    const updatedAt = camera.updatedAt || now;

    await db.run(
      `INSERT INTO cameras (id, name, description, source_reference, status, capabilities_json, coverage_json, health_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        camera.id,
        camera.name,
        camera.description || null,
        camera.sourceReference,
        camera.status || 'active',
        JSON.stringify(camera.capabilities || []),
        camera.coverage ? JSON.stringify(camera.coverage) : null,
        camera.health ? JSON.stringify(camera.health) : null,
        createdAt,
        updatedAt,
      ]
    );

    return { ...camera, createdAt, updatedAt };
  }

  async update(id: string, updates: Partial<Camera>): Promise<Camera | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    const updated: Camera = {
      ...existing,
      ...updates,
      id: existing.id, // Immutable ID
      updatedAt: new Date().toISOString(),
    };

    await db.run(
      `UPDATE cameras
       SET name = ?, description = ?, source_reference = ?, status = ?, capabilities_json = ?, coverage_json = ?, health_json = ?, updated_at = ?
       WHERE id = ?`,
      [
        updated.name,
        updated.description || null,
        updated.sourceReference,
        updated.status,
        JSON.stringify(updated.capabilities || []),
        updated.coverage ? JSON.stringify(updated.coverage) : null,
        updated.health ? JSON.stringify(updated.health) : null,
        updated.updatedAt,
        id,
      ]
    );

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.run('DELETE FROM cameras WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async count(): Promise<number> {
    const result = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM cameras');
    return result?.count || 0;
  }

  async recordHealthTransition(transition: {
    id?: string;
    cameraId: string;
    previousState: string;
    newState: string;
    previousVisibility?: string;
    newVisibility?: string;
    reason: string;
    isSimulated?: boolean;
    timestamp?: string;
  }): Promise<void> {
    const id = transition.id || `TRANS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = transition.timestamp || new Date().toISOString();
    await db.run(
      `INSERT INTO camera_health_transitions (id, camera_id, previous_state, new_state, previous_visibility, new_visibility, reason, is_simulated, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        transition.cameraId,
        transition.previousState,
        transition.newState,
        transition.previousVisibility || null,
        transition.newVisibility || null,
        transition.reason,
        transition.isSimulated ? 1 : 0,
        timestamp,
      ]
    );
  }

  async findHealthTransitions(cameraId: string, limit = 20): Promise<any[]> {
    return db.query(
      `SELECT * FROM camera_health_transitions WHERE camera_id = ? ORDER BY timestamp DESC LIMIT ?`,
      [cameraId, limit]
    );
  }
}

export const cameraRepository = new CameraRepository();
