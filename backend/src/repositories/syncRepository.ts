import { SyncRecord, SyncDeliveryState, SyncAcknowledgementState, SyncRetryInfo } from '@ibvap/shared';
import { db } from './database.js';

interface SyncRecordRow {
  id: string;
  entity_type: string;
  entity_id: string;
  delivery_state: SyncDeliveryState;
  retry_count: number;
  retry_info_json: string | null;
  acknowledgement_state: SyncAcknowledgementState;
  created_at: string;
  updated_at: string;
}

const mapRowToSyncRecord = (row: SyncRecordRow): SyncRecord => ({
  id: row.id,
  entityType: row.entity_type,
  entityId: row.entity_id,
  deliveryState: row.delivery_state,
  retryCount: row.retry_count,
  retryInfo: row.retry_info_json ? (JSON.parse(row.retry_info_json) as SyncRetryInfo) : undefined,
  acknowledgementState: row.acknowledgement_state,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class SyncRepository {
  async findAll(limit = 50): Promise<SyncRecord[]> {
    const rows = await db.query<SyncRecordRow>(
      'SELECT * FROM sync_records ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    return rows.map(mapRowToSyncRecord);
  }

  async findById(id: string): Promise<SyncRecord | undefined> {
    const row = await db.get<SyncRecordRow>('SELECT * FROM sync_records WHERE id = ?', [id]);
    return row ? mapRowToSyncRecord(row) : undefined;
  }

  async findPending(limit = 50): Promise<SyncRecord[]> {
    const rows = await db.query<SyncRecordRow>(
      "SELECT * FROM sync_records WHERE delivery_state = 'pending' ORDER BY created_at ASC LIMIT ?",
      [limit]
    );
    return rows.map(mapRowToSyncRecord);
  }

  async create(record: SyncRecord): Promise<SyncRecord> {
    const now = new Date().toISOString();
    const createdAt = record.createdAt || now;
    const updatedAt = record.updatedAt || now;

    await db.run(
      `INSERT INTO sync_records (id, entity_type, entity_id, delivery_state, retry_count, retry_info_json, acknowledgement_state, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.entityType,
        record.entityId,
        record.deliveryState || 'pending',
        record.retryCount || 0,
        record.retryInfo ? JSON.stringify(record.retryInfo) : null,
        record.acknowledgementState || 'unacknowledged',
        createdAt,
        updatedAt,
      ]
    );

    return { ...record, createdAt, updatedAt };
  }

  async updateDeliveryState(id: string, deliveryState: SyncDeliveryState, retryInfo?: SyncRetryInfo): Promise<SyncRecord | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    const updatedAt = new Date().toISOString();
    const retryCount = deliveryState === 'failed' ? existing.retryCount + 1 : existing.retryCount;
    const updatedRetryInfo = retryInfo || existing.retryInfo;

    await db.run(
      `UPDATE sync_records
       SET delivery_state = ?, retry_count = ?, retry_info_json = ?, updated_at = ?
       WHERE id = ?`,
      [
        deliveryState,
        retryCount,
        updatedRetryInfo ? JSON.stringify(updatedRetryInfo) : null,
        updatedAt,
        id,
      ]
    );

    return {
      ...existing,
      deliveryState,
      retryCount,
      retryInfo: updatedRetryInfo,
      updatedAt,
    };
  }
}

export const syncRepository = new SyncRepository();
