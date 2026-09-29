import { Router } from 'express';
import { healthRouter } from './routes/health.js';
import { camerasRouter } from './routes/cameras.js';
import { observationsRouter } from './routes/observations.js';
import { detectionsRouter } from './routes/detections.js';
import { tracksRouter } from './routes/tracks.js';
import { eventsRouter } from './routes/events.js';
import { rulesRouter } from './routes/rules.js';
import { incidentsRouter } from './routes/incidents.js';
import { correlationsRouter } from './routes/correlations.js';
import { evidenceRouter } from './routes/evidence.js';
import { syncRouter } from './routes/sync.js';
import { auditRouter } from './routes/audit.js';
import { coverageRouter } from './routes/coverage.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/cameras', camerasRouter);
apiRouter.use('/coverage', coverageRouter);
apiRouter.use('/observations', observationsRouter);
apiRouter.use('/detections', detectionsRouter);
apiRouter.use('/tracks', tracksRouter);
apiRouter.use('/events', eventsRouter);
apiRouter.use('/rules', rulesRouter);
apiRouter.use('/zones', (req, res, next) => {
  req.url = '/zones' + req.url;
  rulesRouter(req, res, next);
});
apiRouter.use('/lines', (req, res, next) => {
  req.url = '/lines' + req.url;
  rulesRouter(req, res, next);
});
apiRouter.use('/incidents', incidentsRouter);
apiRouter.use('/correlations', correlationsRouter);
apiRouter.use('/evidence', evidenceRouter);
apiRouter.use('/sync', syncRouter);
apiRouter.use('/audit', auditRouter);
