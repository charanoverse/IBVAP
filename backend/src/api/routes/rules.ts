import { Router, Request, Response, NextFunction } from 'express';
import { aiDetectionService } from '../../services/aiDetectionService.js';
import { ApiSuccessResponse, Line, Rule, Zone } from '@ibvap/shared';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';
import fs from 'fs';
import path from 'path';

export const rulesRouter = Router();

// Fallback loader for demo configurations when AI service is initializing or offline
const loadFallbackJson = <T>(filePath: string, key: string): T[] => {
  const candidatePaths = [
    path.resolve(process.cwd(), filePath),
    path.resolve(process.cwd(), '..', filePath),
    path.resolve(process.cwd(), '../../', filePath),
  ];

  for (const fullPath of candidatePaths) {
    try {
      if (fs.existsSync(fullPath)) {
        const raw = fs.readFileSync(fullPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed[key] && Array.isArray(parsed[key])) {
          return parsed[key] as T[];
        }
      }
    } catch {
      // Continue to next path
    }
  }
  return [];
};

/**
 * GET /api/rules
 * List configured declarative rules, optionally filtered by cameraId
 */
rulesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cameraId = req.query.cameraId as string | undefined;
    let rules = await aiDetectionService.getAllRules();

    if (!rules || rules.length === 0) {
      rules = loadFallbackJson<Rule>('config/rules/demo_rules.json', 'rules');
    }

    if (cameraId) {
      const normCam = cameraId.toUpperCase();
      rules = rules.filter((r) => r.cameraId.toUpperCase() === normCam);
    }

    const response: ApiSuccessResponse<Rule[]> = {
      success: true,
      data: rules,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rules/toggle
 * Toggle enabled/disabled state of a rule
 */
rulesRouter.post('/toggle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ruleId, enabled } = req.body;
    if (!ruleId || enabled === undefined) {
      throw new BadRequestError('ruleId and enabled (boolean) are required');
    }

    const success = await aiDetectionService.toggleRule(ruleId, Boolean(enabled));
    const response: ApiSuccessResponse<{ ruleId: string; enabled: boolean }> = {
      success: true,
      data: { ruleId, enabled: Boolean(enabled) },
      message: `Rule ${ruleId} enabled status updated to ${enabled}`,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/rules/zones
 * List virtual polygon zones, optionally filtered by cameraId
 */
rulesRouter.get('/zones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cameraId = req.query.cameraId as string | undefined;
    let zones = await aiDetectionService.getAllZones();

    if (!zones || zones.length === 0) {
      zones = loadFallbackJson<Zone>('config/zones/demo_zones.json', 'zones');
    }

    if (cameraId) {
      const normCam = cameraId.toUpperCase();
      zones = zones.filter((z) => z.cameraId.toUpperCase() === normCam);
    }

    const response: ApiSuccessResponse<Zone[]> = {
      success: true,
      data: zones,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/rules/lines
 * List virtual tripwire lines, optionally filtered by cameraId
 */
rulesRouter.get('/lines', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cameraId = req.query.cameraId as string | undefined;
    let lines = await aiDetectionService.getAllLines();

    if (!lines || lines.length === 0) {
      lines = loadFallbackJson<Line>('config/zones/demo_lines.json', 'lines');
    }

    if (cameraId) {
      const normCam = cameraId.toUpperCase();
      lines = lines.filter((l) => l.cameraId.toUpperCase() === normCam);
    }

    const response: ApiSuccessResponse<Line[]> = {
      success: true,
      data: lines,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});
