import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { apiRouter } from './api/index.js';
import { errorHandler } from './api/middleware/errorHandler.js';
import { NotFoundError } from './utils/errors.js';
import { logger } from './utils/logger.js';

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Request logger middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.originalUrl}`);
    next();
  });

  // Mount API router
  app.use('/api', apiRouter);

  // Catch-all 404 handler for unknown routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
