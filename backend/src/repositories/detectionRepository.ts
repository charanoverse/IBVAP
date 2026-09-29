import { Detection, BoundingBox } from '@ibvap/shared';
import { db } from './database.js';

interface DetectionRow {
  id: string;
  camera_id: string;
  timestamp: string;
  object_class: string;
  confidence: number;
  bounding_box_json: string;
  track_ref: string | null;
  created_at: string;
}

const mapRowToDetection = (row: DetectionRow): Detection => ({
  id: row.id,
  cameraId: row.camera_id,
  timestamp: row.timestamp,
  objectClass: row.object_class,
  confidence: row.confidence,
  boundingBox: JSON.parse(row.bounding_box_json) as BoundingBox,
  trackRef: row.track_ref || undefined,
  createdAt: row.created_at,
});

export class DetectionRepository {
  async findAll(limit = 50): Promise<Detection[]> {
    const rows = await db.query<DetectionRow>(
      'SELECT * FROM detections ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
    return rows.map(mapRowToDetection);
  }

  async findByCameraId(cameraId: string, limit = 50): Promise<Detection[]> {
    const rows = await db.query<DetectionRow>(
      'SELECT * FROM detections WHERE camera_id = ? ORDER BY timestamp DESC LIMIT ?',
      [cameraId, limit]
    );
    return rows.map(mapRowToDetection);
  }

  async findById(id: string): Promise<Detection | undefined> {
    const row = await db.get<DetectionRow>('SELECT * FROM detections WHERE id = ?', [id]);
    return row ? mapRowToDetection(row) : undefined;
  }

  async create(detection: Detection): Promise<Detection> {
    const createdAt = detection.createdAt || new Date().toISOString();
    await db.run(
      `INSERT INTO detections (id, camera_id, timestamp, object_class, confidence, bounding_box_json, track_ref, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        detection.id,
        detection.cameraId,
        detection.timestamp,
        detection.objectClass,
        detection.confidence,
        JSON.stringify(detection.boundingBox),
        detection.trackRef || null,
        createdAt,
      ]
    );
    return { ...detection, createdAt };
  }
}

export const detectionRepository = new DetectionRepository();
