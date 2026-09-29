import { Camera } from '@ibvap/shared';
import { cameraRepository } from '../repositories/cameraRepository.js';
import { NotFoundError } from '../utils/errors.js';

export class CameraService {
  async getAllCameras(): Promise<Camera[]> {
    return cameraRepository.findAll();
  }

  async getCameraById(id: string): Promise<Camera> {
    const camera = await cameraRepository.findById(id);
    if (!camera) {
      throw new NotFoundError(`Camera with ID '${id}' not found`);
    }
    return camera;
  }

  async registerCamera(camera: Camera): Promise<Camera> {
    return cameraRepository.create(camera);
  }

  async updateCamera(id: string, updates: Partial<Camera>): Promise<Camera> {
    const updated = await cameraRepository.update(id, updates);
    if (!updated) {
      throw new NotFoundError(`Camera with ID '${id}' not found`);
    }
    return updated;
  }
}

export const cameraService = new CameraService();
