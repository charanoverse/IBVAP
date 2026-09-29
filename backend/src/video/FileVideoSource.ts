import fs from 'fs';
import path from 'path';
import { CameraVideoMetadata } from '@ibvap/shared';
import { VideoSource, VideoStreamRange, VideoStreamResult } from './VideoSource.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export class FileVideoSource implements VideoSource {
  readonly cameraId: string;
  readonly sourceType = 'file' as const;
  private readonly resolvedPath: string;
  private readonly baseAllowedDir: string;

  constructor(cameraId: string, filePath: string, baseAllowedDir: string) {
    this.cameraId = cameraId;
    this.baseAllowedDir = path.resolve(baseAllowedDir);
    
    // Resolve absolute path and verify directory confinement
    const targetPath = path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(this.baseAllowedDir, filePath);

    this.resolvedPath = targetPath;
    this.validatePathConfinement();
  }

  /**
   * Enforces that the video file resides strictly within the configured video storage directory.
   */
  private validatePathConfinement(): void {
    const normalizedBase = path.normalize(this.baseAllowedDir);
    const normalizedTarget = path.normalize(this.resolvedPath);

    // Ensure target begins with base path (case-insensitive check for Windows compatibility)
    const isInside = process.platform === 'win32'
      ? normalizedTarget.toLowerCase().startsWith(normalizedBase.toLowerCase())
      : normalizedTarget.startsWith(normalizedBase);

    if (!isInside) {
      logger.warn(`Security alert: Path traversal attempt prevented for camera ${this.cameraId}: ${this.resolvedPath}`);
      throw new AppError('Access denied: Video path outside permitted storage', 403, 'PATH_TRAVERSAL_DETECTED');
    }
  }

  public getFilePath(): string {
    return this.resolvedPath;
  }

  public async exists(): Promise<boolean> {
    try {
      await fs.promises.access(this.resolvedPath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  public async getMetadata(): Promise<CameraVideoMetadata> {
    const fileExists = await this.exists();
    if (!fileExists) {
      return {
        cameraId: this.cameraId,
        sourceType: 'file',
        fileName: path.basename(this.resolvedPath),
        mimeType: 'video/mp4',
        streamUrl: `/api/cameras/${encodeURIComponent(this.cameraId)}/video`,
        status: 'unavailable',
      };
    }

    try {
      const stats = await fs.promises.stat(this.resolvedPath);
      return {
        cameraId: this.cameraId,
        sourceType: 'file',
        fileName: path.basename(this.resolvedPath),
        fileSizeBytes: stats.size,
        mimeType: 'video/mp4',
        streamUrl: `/api/cameras/${encodeURIComponent(this.cameraId)}/video`,
        status: 'ready',
        lastModified: stats.mtime.toISOString(),
      };
    } catch (err) {
      logger.error(`Error reading video metadata for ${this.cameraId}:`, err);
      return {
        cameraId: this.cameraId,
        sourceType: 'file',
        fileName: path.basename(this.resolvedPath),
        mimeType: 'video/mp4',
        streamUrl: `/api/cameras/${encodeURIComponent(this.cameraId)}/video`,
        status: 'unavailable',
      };
    }
  }

  public async createStream(range?: VideoStreamRange): Promise<VideoStreamResult> {
    const fileExists = await this.exists();
    if (!fileExists) {
      throw new AppError(`Video file for camera ${this.cameraId} not found`, 404, 'VIDEO_FILE_NOT_FOUND');
    }

    const stats = await fs.promises.stat(this.resolvedPath);
    const totalSize = stats.size;

    if (range) {
      const { start, end } = range;

      if (start >= totalSize || start < 0 || end >= totalSize || start > end) {
        throw new AppError('Requested Range Not Satisfiable', 416, 'RANGE_NOT_SATISFIABLE', {
          totalSize,
          requestedStart: start,
          requestedEnd: end,
        });
      }

      const contentLength = end - start + 1;
      const stream = fs.createReadStream(this.resolvedPath, { start, end });

      return {
        stream,
        contentLength,
        contentType: 'video/mp4',
        statusCode: 206,
        contentRange: `bytes ${start}-${end}/${totalSize}`,
        acceptRanges: 'bytes',
        totalSize,
      };
    }

    const stream = fs.createReadStream(this.resolvedPath);
    return {
      stream,
      contentLength: totalSize,
      contentType: 'video/mp4',
      statusCode: 200,
      acceptRanges: 'bytes',
      totalSize,
    };
  }
}
