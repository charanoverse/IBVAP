import { Track, TrackSummary } from '@ibvap/shared';
import { trackRepository } from '../repositories/trackRepository.js';
import { aiDetectionService } from './aiDetectionService.js';
import { NotFoundError } from '../utils/errors.js';

export class TrackService {
  async getTracks(limit = 50, status?: string): Promise<TrackSummary[]> {
    return trackRepository.findAll(limit, status);
  }

  async getTracksByCamera(cameraId: string, limit = 50, status?: string): Promise<TrackSummary[]> {
    return trackRepository.findByCameraId(cameraId, limit, status);
  }

  async getTrackById(id: string): Promise<TrackSummary> {
    const track = await trackRepository.findById(id);
    if (!track) {
      throw new NotFoundError(`Track with id "${id}" not found`);
    }
    return track;
  }

  async getLiveTracksForCamera(cameraId: string): Promise<Track[]> {
    return aiDetectionService.getCameraTracks(cameraId);
  }

  async recordTrack(track: Track): Promise<TrackSummary> {
    return trackRepository.upsert(track);
  }
}

export const trackService = new TrackService();
