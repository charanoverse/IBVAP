import { AuditLog } from '@ibvap/shared';
import { auditRepository } from '../repositories/auditRepository.js';
import { NotFoundError } from '../utils/errors.js';

export class AuditService {
  async getAuditLogs(limit?: number): Promise<AuditLog[]> {
    return auditRepository.findAll(limit);
  }

  async getAuditLogById(id: string): Promise<AuditLog> {
    const log = await auditRepository.findById(id);
    if (!log) {
      throw new NotFoundError(`AuditLog with ID '${id}' not found`);
    }
    return log;
  }

  async recordLog(log: AuditLog): Promise<AuditLog> {
    return auditRepository.create(log);
  }
}

export const auditService = new AuditService();
