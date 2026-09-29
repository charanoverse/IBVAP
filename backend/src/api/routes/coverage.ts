import { Router, Request, Response, NextFunction } from 'express';
import { coverageService } from '../../coverage/CoverageService.js';
import { ApiSuccessResponse, ZoneCoverageStatus, AlternativeViewRecommendation } from '@ibvap/shared';

export const coverageRouter = Router();

// 1. Overall Zone Coverage Status & Blind-Spot Intelligence (Phase 8)
coverageRouter.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const coverageStatuses = await coverageService.getAllZoneCoverage();
    const response: ApiSuccessResponse<ZoneCoverageStatus[]> = {
      success: true,
      data: coverageStatuses,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

coverageRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const coverageStatuses = await coverageService.getAllZoneCoverage();
    const response: ApiSuccessResponse<ZoneCoverageStatus[]> = {
      success: true,
      data: coverageStatuses,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 2. Single Zone Coverage Status
coverageRouter.get('/zones/:zoneId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zoneId } = req.params;
    const status = await coverageService.getZoneCoverage(zoneId);
    if (!status) {
      res.status(404).json({
        success: false,
        error: { code: 'ZONE_NOT_FOUND', message: `Coverage zone '${zoneId}' not found.` },
      });
      return;
    }
    const response: ApiSuccessResponse<ZoneCoverageStatus> = {
      success: true,
      data: status,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 3. Alternative View Recommendations for Camera (Phase 8)
coverageRouter.get('/alternatives/:cameraId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cameraId } = req.params;
    const zoneId = req.query.zoneId as string | undefined;
    const recommendations = await coverageService.getAlternativeRecommendations(cameraId, zoneId);
    const response: ApiSuccessResponse<AlternativeViewRecommendation[]> = {
      success: true,
      data: recommendations,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 4. Raw Zone Coverage Configuration
coverageRouter.get('/configs', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = coverageService.getAllRawConfigs();
    res.json({
      success: true,
      data: configs,
    });
  } catch (err) {
    next(err);
  }
});
