import { SyncRecord, SyncDeliveryState, SyncRetryInfo } from '@ibvap/shared';
import { syncRepository } from '../repositories/syncRepository.js';
import { NotFoundError } from '../utils/errors.js';

export class SyncService {
  async getSyncRecords(limit?: number): Promise<SyncRecord[]> {
    return syncRepository.findAll(limit);
  }

  async getSyncRecordById(id: string): Promise<SyncRecord> {
    const record = await syncRepository.findById(id);
    if (!record) {
      throw new NotFoundError(`SyncRecord with ID '${id}' not found`);
    }
    return record;
  }

  async getPendingRecords(limit?: number): Promise<SyncRecord[]> {
    return syncRepository.findPending(limit);
  }

  async queueSync(record: SyncRecord): Promise<SyncRecord> {
    return syncRepository.create(record);
  }

  async updateDeliveryStatus(id: string, deliveryState: SyncDeliveryState, retryInfo?: SyncRetryInfo): Promise<SyncRecord> {
    const updated = await syncRepository.updateDeliveryState(id, deliveryState, retryInfo);
    if (!updated) {
      throw new NotFoundError(`SyncRecord with ID '${id}' not found`);
    }
    return updated;
  }
}

export const syncService = new SyncService();
