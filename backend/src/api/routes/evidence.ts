import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import { evidenceService } from '../../services/evidenceService.js';
import { ApiSuccessResponse, Evidence } from '@ibvap/shared';
import { ValidationError } from '../../utils/errors.js';

export const evidenceRouter = Router();

// 1. GET /api/evidence - List all evidence packages
evidenceRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const cameraId = req.query.cameraId as string | undefined;

    const evidenceList = cameraId
      ? await evidenceService.getEvidenceByCamera(cameraId, limit)
      : await evidenceService.getEvidenceList(limit);

    const response: ApiSuccessResponse<Evidence[]> = {
      success: true,
      data: evidenceList,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 2. GET /api/evidence/:id - Get evidence metadata
evidenceRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const evidence = await evidenceService.getEvidenceById(req.params.id);
    const response: ApiSuccessResponse<Evidence> = {
      success: true,
      data: evidence,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 3. GET /api/evidence/:id/manifest - Get evidence manifest JSON
evidenceRouter.get('/:id/manifest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filePath } = evidenceService.getSecureFilePath(req.params.id, 'manifest.json');
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

// 4. GET /api/evidence/:id/file/:filename - Secure media streaming with HTTP Range support
evidenceRouter.get('/:id/file/:filename', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filePath, mimeType } = evidenceService.getSecureFilePath(req.params.id, req.params.filename);
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range && mimeType.startsWith('video/')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
        return;
      }

      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mimeType,
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    next(err);
  }
});

// 5. GET /api/evidence/:id/media - Convenient media stream endpoint by segment query
evidenceRouter.get('/:id/media', (req: Request, res: Response, next: NextFunction) => {
  try {
    const segment = (req.query.type as string)?.toLowerCase() || 'event';
    let targetFilename = 'event.mp4';
    if (segment === 'pre' || segment === 'pre_event') targetFilename = 'pre-event.mp4';
    else if (segment === 'post' || segment === 'post_event') targetFilename = 'post-event.mp4';
    else if (segment === 'snapshot' || segment === 'image') targetFilename = 'snapshot.jpg';

    const { filePath, mimeType } = evidenceService.getSecureFilePath(req.params.id, targetFilename);
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range && mimeType.startsWith('video/')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mimeType,
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    next(err);
  }
});

// 6. POST /api/evidence/:id/verify - SHA-256 Integrity Verification
evidenceRouter.post('/:id/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const integrityResult = await evidenceService.verifyIntegrity(req.params.id);
    const response: ApiSuccessResponse<typeof integrityResult> = {
      success: true,
      data: integrityResult,
      message: `Integrity check completed: ${integrityResult.status}`,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 7. POST /api/evidence - Register Evidence
evidenceRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const created = await evidenceService.registerEvidence(req.body as Evidence);
    const response: ApiSuccessResponse<Evidence> = {
      success: true,
      data: created,
      message: 'Evidence registered',
    };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});
