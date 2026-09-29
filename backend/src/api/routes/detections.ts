import { Router, Request, Response, NextFunction } from 'express';
import { detectionService } from '../../services/detectionService.js';
import { aiDetectionService } from '../../services/aiDetectionService.js';
import {
  ApiSuccessResponse,
  Detection,
  AISubsystemHealth,
  CameraAIDetectionPayload,
} from '@ibvap/shared';
import { BadRequestError } from '../../utils/errors.js';
import crypto from 'crypto';

export const detectionsRouter = Router();

// 1. AI Subsystem Overall Health & Telemetry
detectionsRouter.get('/ai/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const health = await aiDetectionService.getAIHealth();
    const response: ApiSuccessResponse<AISubsystemHealth> = {
      success: true,
      data: health,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 2. Real-Time Server-Sent Events (SSE) Detection Stream
detectionsRouter.get('/stream', (req: Request, res: Response) => {
  const clientId = crypto.randomUUID();
  const cameraId = req.query.cameraId as string | undefined;
  aiDetectionService.registerSSEClient(clientId, res, cameraId);
});

// 3. Live latest detection frame for a specific camera (optional timestamp query)
detectionsRouter.get('/live/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const timestamp = req.query.timestamp !== undefined ? parseFloat(req.query.timestamp as string) : undefined;
    const payload = await aiDetectionService.getCameraDetections(req.params.id, timestamp);
    const response: ApiSuccessResponse<CameraAIDetectionPayload | null> = {
      success: true,
      data: payload,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 3b. Detection timeline frames for a specific camera
detectionsRouter.get('/timeline/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const timeline = await aiDetectionService.getCameraTimeline(req.params.id);
    const response: ApiSuccessResponse<CameraAIDetectionPayload[]> = {
      success: true,
      data: timeline || [],
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 4. Control camera AI pipeline (pause, resume, restart, reset_tracker, reset_rules)
detectionsRouter.post('/control/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const action = req.body?.action || 'resume';
    const validActions = ['pause', 'resume', 'restart', 'stop', 'reset_tracker', 'reset_rules'];
    if (!validActions.includes(action)) {
      throw new BadRequestError(`Invalid AI action "${action}". Allowed: ${validActions.join(', ')}`);
    }

    await aiDetectionService.controlCameraAI(req.params.id, action);
    const response: ApiSuccessResponse<{ success: boolean; action: string }> = {
      success: true,
      data: { success: true, action },
      message: `Camera ${req.params.id} AI state set to ${action}`,
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// 5. Query persisted detections
detectionsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const cameraId = req.query.cameraId as string | undefined;

    const detections = cameraId
      ? await detectionService.getDetectionsByCamera(cameraId, limit)
      : await detectionService.getDetections(limit);

    const response: ApiSuccessResponse<Detection[]> = {
      success: true,
      data: detections,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 6. Get single persisted detection by ID
detectionsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detection = await detectionService.getDetectionById(req.params.id);
    const response: ApiSuccessResponse<Detection> = {
      success: true,
      data: detection,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 7. Record a detection record
detectionsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const created = await detectionService.recordDetection(req.body as Detection);
    const response: ApiSuccessResponse<Detection> = {
      success: true,
      data: created,
      message: 'Detection recorded',
    };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});
