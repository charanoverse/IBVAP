import { Observation } from '@ibvap/shared';
import { observationRepository } from '../repositories/observationRepository.js';
import { NotFoundError } from '../utils/errors.js';

export class ObservationService {
  async getObservations(limit?: number): Promise<Observation[]> {
    return observationRepository.findAll(limit);
  }

  async getObservationsByCamera(cameraId: string, limit?: number): Promise<Observation[]> {
    return observationRepository.findByCameraId(cameraId, limit);
  }

  async getObservationById(id: string): Promise<Observation> {
    const obs = await observationRepository.findById(id);
    if (!obs) {
      throw new NotFoundError(`Observation with ID '${id}' not found`);
    }
    return obs;
  }

  async recordObservation(obs: Observation): Promise<Observation> {
    return observationRepository.create(obs);
  }
}

export const observationService = new ObservationService();
