import { Router, Request, Response, NextFunction } from 'express';
import { trackService } from '../../services/trackService.js';
import { ApiSuccessResponse, Track, TrackSummary } from '@ibvap/shared';

export const tracksRouter = Router();

// 1. Get live active tracks for a camera from the AI engine
tracksRouter.get('/live/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tracks = await trackService.getLiveTracksForCamera(req.params.id);
    const response: ApiSuccessResponse<Track[]> = {
      success: true,
      data: tracks,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 2. Query persisted tracks (filtered by camera, status, limit)
tracksRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const cameraId = req.query.cameraId as string | undefined;
    const status = req.query.status as string | undefined;

    const tracks = cameraId
      ? await trackService.getTracksByCamera(cameraId, limit, status)
      : await trackService.getTracks(limit, status);

    const response: ApiSuccessResponse<TrackSummary[]> = {
      success: true,
      data: tracks,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 3. Get single persisted track by ID
tracksRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const track = await trackService.getTrackById(req.params.id);
    const response: ApiSuccessResponse<TrackSummary> = {
      success: true,
      data: track,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 4. Record / upsert a track record
tracksRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const recorded = await trackService.recordTrack(req.body as Track);
    const response: ApiSuccessResponse<TrackSummary> = {
      success: true,
      data: recorded,
      message: 'Track summary recorded',
    };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});
