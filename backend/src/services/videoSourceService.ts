import fs from 'fs';
import path from 'path';
import { CameraVideoMetadata } from '@ibvap/shared';
import { config } from '../config/index.js';
import { VideoSource, VideoStreamRange, VideoStreamResult } from '../video/VideoSource.js';
import { FileVideoSource } from '../video/FileVideoSource.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export class VideoSourceService {
  private readonly baseVideosDir: string;

  constructor(baseVideosDir?: string) {
    this.baseVideosDir = baseVideosDir ? path.resolve(baseVideosDir) : path.resolve(config.storage.videosPath);
  }

  /**
   * Validates that an incoming camera ID does not contain path traversal tokens.
   */
  private sanitizeCameraId(id: string): string {
    if (!id || typeof id !== 'string') {
      throw new AppError('Invalid camera ID', 400, 'INVALID_CAMERA_ID');
    }
    const trimmed = id.trim();
    if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0')) {
      logger.warn(`Security alert: Suspicious camera ID parameter rejected: "${id}"`);
      throw new AppError('Invalid camera ID format: illegal characters', 400, 'INVALID_CAMERA_ID');
    }
    return trimmed;
  }

  /**
   * Resolves the candidate video file paths for a given camera ID.
   */
  private resolveVideoFilePath(cameraId: string): string | null {
    const sanitizedId = this.sanitizeCameraId(cameraId);
    const normalizedUpper = sanitizedId.toUpperCase();
    const normalizedLower = sanitizedId.toLowerCase();

    // Mapping patterns for standard demo cameras
    const candidateFolders = [
      sanitizedId,
      normalizedLower,
      normalizedUpper,
      sanitizedId.replace('CAM-0', 'CAM-'),
      sanitizedId.replace('CAM-', 'cam-0'),
      sanitizedId.replace('cam-0', 'cam-'),
      sanitizedId.replace('cam-', 'CAM-'),
      sanitizedId.replace('CAM-0', 'cam-'),
      sanitizedId.replace('cam-0', 'CAM-'),
    ];

    // Specific known mappings
    const knownFileNames: Record<string, string[]> = {
      'CAM-01': ['gate.mp4', 'demo_north_gate.mp4'],
      'CAM-1': ['gate.mp4', 'demo_north_gate.mp4'],
      'CAM-NORTH-GATE-01': ['gate.mp4', 'demo_north_gate.mp4'],
      'CAM-02': ['corridor.mp4', 'demo_approach_lane.mp4'],
      'CAM-2': ['corridor.mp4', 'demo_approach_lane.mp4'],
      'CAM-NORTH-GATE-02': ['corridor.mp4', 'demo_approach_lane.mp4'],
      'CAM-03': ['restricted.mp4', 'sterile_zone.mp4'],
      'CAM-3': ['restricted.mp4', 'sterile_zone.mp4'],
      'CAM-EAST-FENCE-01': ['restricted.mp4', 'demo_east_fence.mp4'],
      'CAM-04': ['vehicles.mp4', 'vehicle.mp4', 'exit_lane.mp4'],
      'CAM-4': ['vehicles.mp4', 'vehicle.mp4', 'exit_lane.mp4'],
      'CAM-05': ['perimeter.mp4', 'east_perimeter.mp4'],
      'CAM-5': ['perimeter.mp4', 'east_perimeter.mp4'],
      'CAM-06': ['night.mp4', 'service_yard.mp4'],
      'CAM-6': ['night.mp4', 'service_yard.mp4'],
    };

    const targetFileNames = knownFileNames[normalizedUpper] || [];

    // Check candidate folders
    for (const folder of candidateFolders) {
      const folderPath = path.resolve(this.baseVideosDir, folder);
      if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
        // Try specific known file names first
        for (const fileName of targetFileNames) {
          const filePath = path.resolve(folderPath, fileName);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            return filePath;
          }
        }

        // Fallback: check any .mp4 file in this directory
        try {
          const files = fs.readdirSync(folderPath);
          const mp4 = files.find((f) => f.toLowerCase().endsWith('.mp4'));
          if (mp4) {
            return path.resolve(folderPath, mp4);
          }
        } catch {
          // Ignore read errors
        }
      }
    }

    // Also check root video directory for direct files
    for (const fileName of targetFileNames) {
      const filePath = path.resolve(this.baseVideosDir, fileName);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return filePath;
      }
    }

    return null;
  }

  /**
   * Returns a VideoSource instance for the requested camera ID.
   */
  public getVideoSource(cameraId: string): VideoSource {
    const filePath = this.resolveVideoFilePath(cameraId);
    if (!filePath) {
      throw new AppError(`No video stream available for camera "${cameraId}"`, 404, 'VIDEO_SOURCE_NOT_FOUND');
    }

    return new FileVideoSource(cameraId, filePath, this.baseVideosDir);
  }

  /**
   * Retrieves video stream metadata for a camera.
   */
  public async getVideoMetadata(cameraId: string): Promise<CameraVideoMetadata> {
    const source = this.getVideoSource(cameraId);
    return source.getMetadata();
  }

  /**
   * Parses an HTTP Range header string (e.g. "bytes=0-1024" or "bytes=1024-")
   */
  public parseRangeHeader(rangeHeader: string | undefined, totalSize: number): VideoStreamRange | undefined {
    if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
      return undefined;
    }

    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const startStr = parts[0].trim();
    const endStr = parts[1]?.trim();

    let start = parseInt(startStr, 10);
    let end = endStr ? parseInt(endStr, 10) : totalSize - 1;

    if (isNaN(start)) {
      start = 0;
    }
    if (isNaN(end) || end >= totalSize) {
      end = totalSize - 1;
    }

    return { start, end };
  }

  /**
   * Creates a streaming response for the given camera and optional range header.
   */
  public async streamVideo(cameraId: string, rangeHeader?: string): Promise<VideoStreamResult> {
    const source = this.getVideoSource(cameraId);
    const exists = await source.exists();
    if (!exists) {
      throw new AppError(`Video file for camera ${cameraId} does not exist`, 404, 'VIDEO_FILE_NOT_FOUND');
    }

    // If range header requested, get file size first to compute range
    if (rangeHeader) {
      const meta = await source.getMetadata();
      const totalSize = meta.fileSizeBytes || 0;
      if (totalSize === 0) {
        return source.createStream();
      }

      const range = this.parseRangeHeader(rangeHeader, totalSize);
      return source.createStream(range);
    }

    return source.createStream();
  }

  /**
   * Scans and returns metadata for all available camera video streams.
   */
  public async listAllVideoStreams(): Promise<CameraVideoMetadata[]> {
    const cameraIds = ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'CAM-05', 'CAM-06'];
    const results: CameraVideoMetadata[] = [];

    for (const camId of cameraIds) {
      try {
        const source = this.getVideoSource(camId);
        const meta = await source.getMetadata();
        results.push(meta);
      } catch {
        results.push({
          cameraId: camId,
          sourceType: 'file',
          mimeType: 'video/mp4',
          streamUrl: `/api/cameras/${encodeURIComponent(camId)}/video`,
          status: 'unavailable',
        });
      }
    }

    return results;
  }
}

export const videoSourceService = new VideoSourceService();
