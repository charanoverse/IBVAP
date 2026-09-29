import { CameraVideoMetadata, VideoSourceType } from '@ibvap/shared';
import { Readable } from 'stream';

export interface VideoStreamResult {
  stream: Readable;
  contentLength: number;
  contentType: string;
  statusCode: 200 | 206;
  contentRange?: string;
  acceptRanges: string;
  totalSize: number;
}

export interface VideoStreamRange {
  start: number;
  end: number;
}

export interface VideoSource {
  readonly cameraId: string;
  readonly sourceType: VideoSourceType;
  
  /**
   * Returns whether the backing media resource exists and is accessible.
   */
  exists(): Promise<boolean> | boolean;

  /**
   * Retrieves metadata regarding the video source.
   */
  getMetadata(): Promise<CameraVideoMetadata>;

  /**
   * Creates a readable stream for playback with optional byte range support.
   */
  createStream(range?: VideoStreamRange): Promise<VideoStreamResult>;
}
