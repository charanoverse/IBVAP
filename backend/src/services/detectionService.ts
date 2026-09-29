import { Detection } from '@ibvap/shared';
import { detectionRepository } from '../repositories/detectionRepository.js';
import { NotFoundError } from '../utils/errors.js';

export class DetectionService {
  async getDetections(limit?: number): Promise<Detection[]> {
    return detectionRepository.findAll(limit);
  }

  async getDetectionsByCamera(cameraId: string, limit?: number): Promise<Detection[]> {
    return detectionRepository.findByCameraId(cameraId, limit);
  }

  async getDetectionById(id: string): Promise<Detection> {
    const detection = await detectionRepository.findById(id);
    if (!detection) {
      throw new NotFoundError(`Detection with ID '${id}' not found`);
    }
    return detection;
  }

  async recordDetection(detection: Detection): Promise<Detection> {
    return detectionRepository.create(detection);
  }
}

export const detectionService = new DetectionService();
