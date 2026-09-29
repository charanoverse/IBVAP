import { Router, Request, Response, NextFunction } from 'express';
import { auditService } from '../../services/auditService.js';
import { ApiSuccessResponse, AuditLog } from '@ibvap/shared';

export const auditRouter = Router();

auditRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const logs = await auditService.getAuditLogs(limit);
    const response: ApiSuccessResponse<AuditLog[]> = {
      success: true,
      data: logs,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

auditRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const log = await auditService.getAuditLogById(req.params.id);
    const response: ApiSuccessResponse<AuditLog> = {
      success: true,
      data: log,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

auditRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const created = await auditService.recordLog(req.body as AuditLog);
    const response: ApiSuccessResponse<AuditLog> = {
      success: true,
      data: created,
      message: 'Audit entry recorded',
    };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});
