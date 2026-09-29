import { Router, Request, Response, NextFunction } from 'express';
import { correlationService } from '../../services/correlationService.js';
import {
  ApiSuccessResponse,
  CameraTopologyConfig,
  Correlation,
  CorrelationFilterOptions,
  CorrelationState,
} from '@ibvap/shared';

export const correlationsRouter = Router();

// 1. Get Topology Graph & Config
correlationsRouter.get('/topology', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const topology = correlationService.getTopology();
    const response: ApiSuccessResponse<CameraTopologyConfig> = {
      success: true,
      data: topology,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 2. List correlations with filter options
correlationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const options: CorrelationFilterOptions = {
      state: req.query.state as CorrelationState | undefined,
      cameraId: req.query.cameraId as string | undefined,
      sourceCameraId: req.query.sourceCameraId as string | undefined,
      targetCameraId: req.query.targetCameraId as string | undefined,
      eventId: req.query.eventId as string | undefined,
      minScore: req.query.minScore ? parseFloat(req.query.minScore as string) : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    const correlations = await correlationService.getCorrelations(options);

    const response: ApiSuccessResponse<Correlation[]> = {
      success: true,
      data: correlations,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 3. Get single correlation by ID
correlationsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlation = await correlationService.getCorrelationById(req.params.id);
    const response: ApiSuccessResponse<Correlation> = {
      success: true,
      data: correlation,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 4. Propose new correlation
correlationsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const created = await correlationService.proposeCorrelation(req.body as Correlation);
    const response: ApiSuccessResponse<Correlation> = {
      success: true,
      data: created,
      message: 'Proposed cross-camera correlation recorded',
    };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

// 5. Update state directly
correlationsRouter.patch('/:id/state', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { state, reviewedBy, reviewNote } = req.body as {
      state: CorrelationState;
      reviewedBy?: string;
      reviewNote?: string;
    };
    const updated = await correlationService.updateState(req.params.id, state, { reviewedBy, reviewNote });
    const response: ApiSuccessResponse<Correlation> = {
      success: true,
      data: updated,
      message: `Correlation state transitioned to ${state.toUpperCase()}`,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 6. Operator Accept action
correlationsRouter.patch('/:id/accept', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reviewedBy, reviewNote } = req.body || {};
    const updated = await correlationService.accept(req.params.id, reviewedBy, reviewNote);
    const response: ApiSuccessResponse<Correlation> = {
      success: true,
      data: updated,
      message: 'Cross-camera event correlation accepted by operator',
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 7. Operator Reject action
correlationsRouter.patch('/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reviewedBy, reviewNote } = req.body || {};
    const updated = await correlationService.reject(req.params.id, reviewedBy, reviewNote);
    const response: ApiSuccessResponse<Correlation> = {
      success: true,
      data: updated,
      message: 'Cross-camera event correlation rejected by operator',
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 8. Add operator review notes
correlationsRouter.post('/:id/notes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { note, reviewedBy } = req.body || {};
    const updated = await correlationService.addNote(req.params.id, note, reviewedBy);
    const response: ApiSuccessResponse<Correlation> = {
      success: true,
      data: updated,
      message: 'Review note added to correlation candidate',
    };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});
