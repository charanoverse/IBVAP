import { Router, Request, Response, NextFunction } from 'express';
import { eventService } from '../../services/eventService.js';
import { aiDetectionService } from '../../services/aiDetectionService.js';
import { ApiSuccessResponse, Event, EventStatus } from '@ibvap/shared';
import { BadRequestError } from '../../utils/errors.js';

export const eventsRouter = Router();

/**
 * GET /api/events
 * Query persisted verified events with optional filters (cameraId, eventType, status, since, limit)
 */
eventsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const cameraId = req.query.cameraId as string | undefined;
    const eventType = req.query.eventType as string | undefined;
    const status = req.query.status as EventStatus | undefined;
    const since = req.query.since as string | undefined;

    const events = await eventService.getEvents({
      cameraId,
      eventType,
      status,
      since,
      limit,
    });

    const response: ApiSuccessResponse<Event[]> = {
      success: true,
      data: events,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/events/live/:cameraId
 * Fetches recent live events directly from the AI detection & rule engine worker
 */
eventsRouter.get('/live/:cameraId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cameraId } = req.params;
    const events = await aiDetectionService.getCameraEvents(cameraId);

    const response: ApiSuccessResponse<Event[]> = {
      success: true,
      data: events,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/events/:id
 * Retrieve a single verified event by ID
 */
eventsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await eventService.getEventById(req.params.id);
    const response: ApiSuccessResponse<Event> = {
      success: true,
      data: event,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/events
 * Ingest / create an event
 */
eventsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Event;
    if (!body || !body.id || !body.eventType || !body.cameraId) {
      throw new BadRequestError('Event id, eventType, and cameraId are required');
    }

    const created = await eventService.recordEvent(body);
    const response: ApiSuccessResponse<Event> = {
      success: true,
      data: created,
      message: 'Event recorded',
    };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});
