import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { ApiErrorResponse } from '@ibvap/shared';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    logger.warn(`API Error [${err.code}] on ${req.method} ${req.url}: ${err.message}`);
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  logger.error(`Unhandled Internal Error on ${req.method} ${req.url}`, err);
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal server error occurred',
    },
  };
  res.status(500).json(response);
}
