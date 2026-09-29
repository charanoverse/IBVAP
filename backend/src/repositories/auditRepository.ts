import { AuditLog } from '@ibvap/shared';
import { db } from './database.js';

interface AuditLogRow {
  id: string;
  actor: string;
  action: string;
  entity: string;
  timestamp: string;
  metadata_json: string | null;
}

const mapRowToAuditLog = (row: AuditLogRow): AuditLog => ({
  id: row.id,
  actor: row.actor,
  action: row.action,
  entity: row.entity,
  timestamp: row.timestamp,
  metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
});

export class AuditRepository {
  async findAll(limit = 50): Promise<AuditLog[]> {
    const rows = await db.query<AuditLogRow>(
      'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
    return rows.map(mapRowToAuditLog);
  }

  async findById(id: string): Promise<AuditLog | undefined> {
    const row = await db.get<AuditLogRow>('SELECT * FROM audit_logs WHERE id = ?', [id]);
    return row ? mapRowToAuditLog(row) : undefined;
  }

  async create(log: AuditLog): Promise<AuditLog> {
    const timestamp = log.timestamp || new Date().toISOString();
    await db.run(
      `INSERT INTO audit_logs (id, actor, action, entity, timestamp, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        log.id,
        log.actor,
        log.action,
        log.entity,
        timestamp,
        log.metadata ? JSON.stringify(log.metadata) : '{}',
      ]
    );
    return { ...log, timestamp };
  }
}

export const auditRepository = new AuditRepository();
