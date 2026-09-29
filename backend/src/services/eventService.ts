import { Event, EventStatus, EventVerificationState } from '@ibvap/shared';
import { eventRepository, EventFilterOptions } from '../repositories/eventRepository.js';
import { NotFoundError } from '../utils/errors.js';

export class EventService {
  async getEvents(options: EventFilterOptions = {}): Promise<Event[]> {
    return eventRepository.findAll(options);
  }

  async getEventsByCamera(cameraId: string, limit?: number): Promise<Event[]> {
    return eventRepository.findByCameraId(cameraId, limit);
  }

  async getEventById(id: string): Promise<Event> {
    const event = await eventRepository.findById(id);
    if (!event) {
      throw new NotFoundError(`Event with ID '${id}' not found`);
    }
    return event;
  }

  async recordEvent(event: Event): Promise<Event> {
    return eventRepository.upsert(event);
  }

  async updateVerification(id: string, state: EventVerificationState): Promise<Event> {
    const updated = await eventRepository.updateVerificationState(id, state);
    if (!updated) {
      throw new NotFoundError(`Event with ID '${id}' not found`);
    }
    return updated;
  }
}

export const eventService = new EventService();
