import { Router, Request, Response, NextFunction } from 'express';
import { incidentService, OperatorActor } from '../../services/incidentService.js';
import { evidenceService } from '../../services/evidenceService.js';
import {
  ApiSuccessResponse,
  Incident,
  IncidentEvidenceState,
  IncidentFilterOptions,
  IncidentOutcomeType,
  IncidentReviewState,
  IncidentTimelineEvent,
  OperatorOutcome,
} from '@ibvap/shared';

export const incidentsRouter = Router();

const extractActor = (req: Request): OperatorActor => {
  const actorId = (req.headers['x-operator-id'] as string) || (req.body?.actorId as string) || 'demo-operator';
  const actorName = (req.headers['x-operator-name'] as string) || (req.body?.actorName as string) || 'Demo Operator';
  const role = (req.headers['x-operator-role'] as string) || (req.body?.actorRole as string) || 'Watch Commander';
  return { id: actorId, name: actorName, role };
};

// 1. GET /api/incidents/metrics - Operational KPI counters
incidentsRouter.get('/metrics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await incidentService.getMetrics();
    const response: ApiSuccessResponse<typeof metrics> = {
      success: true,
      data: metrics,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 2. GET /api/incidents - Filtered Incident Query
incidentsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const state = req.query.state as string | undefined;
    const priority = req.query.priority as string | undefined;
    const cameraId = req.query.cameraId as string | undefined;
    const search = req.query.search as string | undefined;

    const filterOptions: IncidentFilterOptions = {
      limit,
      offset,
      state,
      priority,
      cameraId,
      search,
    };

    const incidents = await incidentService.getIncidents(filterOptions);
    const response: ApiSuccessResponse<Incident[]> = {
      success: true,
      data: incidents,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 3. GET /api/incidents/:id - Incident Detail
incidentsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const incident = await incidentService.getIncidentById(req.params.id);
    const response: ApiSuccessResponse<Incident> = {
      success: true,
      data: incident,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 4. GET /api/incidents/:id/timeline - Chronological Incident Timeline
incidentsRouter.get('/:id/timeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const incident = await incidentService.getIncidentById(req.params.id);
    const timeline = incident.timeline || (await incidentService.buildTimeline(incident));
    const response: ApiSuccessResponse<IncidentTimelineEvent[]> = {
      success: true,
      data: timeline,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 5. GET /api/incidents/:id/evidence - Evidence Details for Incident
incidentsRouter.get('/:id/evidence', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const evidence = await evidenceService.getEvidenceByIncidentId(req.params.id);
    const response: ApiSuccessResponse<typeof evidence> = {
      success: true,
      data: evidence,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 6. POST /api/incidents - Direct Creation
incidentsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const created = await incidentService.createIncident(req.body as Incident);
    const response: ApiSuccessResponse<Incident> = {
      success: true,
      data: created,
      message: 'Incident created',
    };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

// 7. PATCH /api/incidents/:id/acknowledge - Operator Acknowledge
incidentsRouter.patch('/:id/acknowledge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = extractActor(req);
    const updated = await incidentService.acknowledge(req.params.id, actor);
    const response: ApiSuccessResponse<Incident> = {
      success: true,
      data: updated,
      message: 'Incident acknowledged by operator',
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 8. PATCH /api/incidents/:id/review - Operator Start Review (or generic review state update)
incidentsRouter.patch('/:id/review', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = extractActor(req);
    const { reviewState, outcome } = req.body as {
      reviewState?: IncidentReviewState;
      outcome?: OperatorOutcome;
    };

    if (reviewState && (reviewState.toLowerCase() === 'resolved' || reviewState.toLowerCase() === 'closed')) {
      const updated = await incidentService.close(req.params.id, actor, outcome?.action || 'CONFIRMED_ACTIVITY', outcome?.notes);
      return res.json({ success: true, data: updated, message: 'Incident resolved' });
    }

    const updated = await incidentService.startReview(req.params.id, actor);
    const response: ApiSuccessResponse<Incident> = {
      success: true,
      data: updated,
      message: 'Incident review started',
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 9. PATCH /api/incidents/:id/escalate - Operator Escalate
incidentsRouter.patch('/:id/escalate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = extractActor(req);
    const reason = (req.body?.reason as string) || (req.body?.notes as string) || undefined;
    const updated = await incidentService.escalate(req.params.id, actor, reason);
    const response: ApiSuccessResponse<Incident> = {
      success: true,
      data: updated,
      message: 'Incident escalated for supervisor attention',
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 10. PATCH /api/incidents/:id/close - Operator Close
incidentsRouter.patch('/:id/close', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = extractActor(req);
    const outcome = (req.body?.outcome as IncidentOutcomeType | string) || 'CONFIRMED_ACTIVITY';
    const notes = (req.body?.notes as string) || (req.body?.operatorNotes as string) || undefined;
    const updated = await incidentService.close(req.params.id, actor, outcome, notes);
    const response: ApiSuccessResponse<Incident> = {
      success: true,
      data: updated,
      message: 'Incident closed successfully',
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 11. POST /api/incidents/:id/notes - Add Operator Note
incidentsRouter.post('/:id/notes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = extractActor(req);
    const text = (req.body?.text as string) || (req.body?.notes as string) || '';
    const updated = await incidentService.addNote(req.params.id, actor, text);
    const response: ApiSuccessResponse<Incident> = {
      success: true,
      data: updated,
      message: 'Operator note recorded',
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 12. POST /api/incidents/:id/evidence/retry - Retry Evidence Extraction
incidentsRouter.post('/:id/evidence/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = extractActor(req);
    const evidence = await evidenceService.retryEvidence(req.params.id, actor.name);
    const response: ApiSuccessResponse<typeof evidence> = {
      success: true,
      data: evidence,
      message: 'Evidence extraction retried',
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});
