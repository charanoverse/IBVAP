import { Router, Request, Response, NextFunction } from 'express';
import { observationService } from '../../services/observationService.js';
import { ApiSuccessResponse, Observation } from '@ibvap/shared';

export const observationsRouter = Router();

observationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const cameraId = req.query.cameraId as string | undefined;

    const observations = cameraId
      ? await observationService.getObservationsByCamera(cameraId, limit)
      : await observationService.getObservations(limit);

    const response: ApiSuccessResponse<Observation[]> = {
      success: true,
      data: observations,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

observationsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const obs = await observationService.getObservationById(req.params.id);
    const response: ApiSuccessResponse<Observation> = {
      success: true,
      data: obs,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

observationsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const created = await observationService.recordObservation(req.body as Observation);
    const response: ApiSuccessResponse<Observation> = {
      success: true,
      data: created,
      message: 'Observation recorded',
    };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});
