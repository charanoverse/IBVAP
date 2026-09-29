import { Router, Request, Response, NextFunction } from 'express';
import { cameraService } from '../../services/cameraService.js';
import { videoSourceService } from '../../services/videoSourceService.js';
import { ApiSuccessResponse, Camera, CameraVideoMetadata } from '@ibvap/shared';
import { logger } from '../../utils/logger.js';

export const camerasRouter = Router();

// 1. List all cameras
camerasRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cameras = await cameraService.getAllCameras();
    const response: ApiSuccessResponse<Camera[]> = {
      success: true,
      data: cameras,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 2. Video Streams Manifest
camerasRouter.get('/video/manifest', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const streams = await videoSourceService.listAllVideoStreams();
    const response: ApiSuccessResponse<CameraVideoMetadata[]> = {
      success: true,
      data: streams,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 2B. All Cameras Health Summary (Phase 8)
camerasRouter.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { cameraHealthService } = await import('../../health/CameraHealthService.js');
    const healthMap = await cameraHealthService.getAllCamerasHealth();
    res.json({
      success: true,
      data: healthMap,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Camera Video Stream Metadata
camerasRouter.get('/:id/video/metadata', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metadata = await videoSourceService.getVideoMetadata(req.params.id);
    const response: ApiSuccessResponse<CameraVideoMetadata> = {
      success: true,
      data: metadata,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 4. Camera Video Stream Playback (with HTTP Range Request support)
camerasRouter.get('/:id/video', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const rangeHeader = req.headers.range;

    const result = await videoSourceService.streamVideo(id, rangeHeader);

    const headers: Record<string, string | number> = {
      'Content-Type': result.contentType,
      'Accept-Ranges': result.acceptRanges,
      'Content-Length': result.contentLength,
      'Cache-Control': 'no-cache',
    };

    if (result.contentRange) {
      headers['Content-Range'] = result.contentRange;
    }

    res.writeHead(result.statusCode, headers);

    result.stream.pipe(res);

    result.stream.on('error', (streamErr) => {
      logger.error(`Stream error during video delivery for camera ${id}:`, streamErr);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    req.on('close', () => {
      if ('destroy' in result.stream && typeof (result.stream as any).destroy === 'function') {
        (result.stream as any).destroy();
      }
    });
  } catch (err) {
    next(err);
  }
});

// 4B. Single Camera Health & Visibility Assessment (Phase 8)
camerasRouter.get('/:id/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cameraHealthService } = await import('../../health/CameraHealthService.js');
    const health = await cameraHealthService.getCameraHealth(req.params.id);
    const transitions = await cameraHealthService.getHealthTransitions(req.params.id, 10);
    res.json({
      success: true,
      data: {
        ...health,
        recentTransitions: transitions,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 4C. Camera Health Transitions Audit Log (Phase 8)
camerasRouter.get('/:id/health-transitions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cameraHealthService } = await import('../../health/CameraHealthService.js');
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const transitions = await cameraHealthService.getHealthTransitions(req.params.id, limit);
    res.json({
      success: true,
      data: transitions,
    });
  } catch (err) {
    next(err);
  }
});

// 4D. Development / Simulation Controls: Simulate Degradation (Phase 8)
camerasRouter.post('/:id/simulate-degradation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cameraHealthService } = await import('../../health/CameraHealthService.js');
    const { type, reason } = req.body;
    if (!type) {
      res.status(400).json({ success: false, error: { code: 'INVALID_TYPE', message: 'Degradation type is required.' } });
      return;
    }
    const updatedHealth = await cameraHealthService.simulateDegradation(req.params.id, type, reason);
    res.json({
      success: true,
      data: updatedHealth,
      message: `Simulated degradation [${type}] applied to camera ${req.params.id}`,
    });
  } catch (err) {
    next(err);
  }
});

// 4E. Development / Simulation Controls: Restore Camera (Phase 8)
camerasRouter.post('/:id/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cameraHealthService } = await import('../../health/CameraHealthService.js');
    const restoredHealth = await cameraHealthService.restoreCamera(req.params.id);
    res.json({
      success: true,
      data: restoredHealth,
      message: `Camera ${req.params.id} restored to nominal telemetry.`,
    });
  } catch (err) {
    next(err);
  }
});

// 5. Get camera by ID
camerasRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const camera = await cameraService.getCameraById(req.params.id);
    const response: ApiSuccessResponse<Camera> = {
      success: true,
      data: camera,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 6. Register a new camera
camerasRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newCamera = await cameraService.registerCamera(req.body as Camera);
    const response: ApiSuccessResponse<Camera> = {
      success: true,
      data: newCamera,
      message: 'Camera registered successfully',
    };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});
