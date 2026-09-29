import { Router, Request, Response, NextFunction } from 'express';
import { syncService } from '../../services/syncService.js';
import { ApiSuccessResponse, SyncRecord, SyncDeliveryState, SyncRetryInfo } from '@ibvap/shared';

export const syncRouter = Router();

syncRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const status = req.query.status as string | undefined;

    const records = status === 'pending'
      ? await syncService.getPendingRecords(limit)
      : await syncService.getSyncRecords(limit);

    const response: ApiSuccessResponse<SyncRecord[]> = {
      success: true,
      data: records,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

syncRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await syncService.getSyncRecordById(req.params.id);
    const response: ApiSuccessResponse<SyncRecord> = {
      success: true,
      data: record,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

syncRouter.post('/queue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queued = await syncService.queueSync(req.body as SyncRecord);
    const response: ApiSuccessResponse<SyncRecord> = {
      success: true,
      data: queued,
      message: 'Item queued for future synchronization',
    };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

syncRouter.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deliveryState, retryInfo } = req.body as { deliveryState: SyncDeliveryState; retryInfo?: SyncRetryInfo };
    const updated = await syncService.updateDeliveryStatus(req.params.id, deliveryState, retryInfo);
    const response: ApiSuccessResponse<SyncRecord> = {
      success: true,
      data: updated,
      message: 'Sync delivery status updated',
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});
