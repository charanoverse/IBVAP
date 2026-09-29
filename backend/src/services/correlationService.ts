import {
  CameraRelationship,
  CameraTopologyConfig,
  Correlation,
  CorrelationFilterOptions,
  CorrelationState,
  Event,
} from '@ibvap/shared';
import { correlationRepository, CorrelationRepository } from '../repositories/correlationRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { correlationEngine, CorrelationEngine, CorrelationBroadcaster } from '../correlations/CorrelationEngine.js';
import { topologyService, TopologyService } from '../correlations/TopologyService.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export class CorrelationService {
  private repo: CorrelationRepository;
  private engine: CorrelationEngine;
  private topology: TopologyService;
  private broadcaster: CorrelationBroadcaster | null = null;

  constructor(
    customRepo?: CorrelationRepository,
    customEngine?: CorrelationEngine,
    customTopology?: TopologyService
  ) {
    this.repo = customRepo || correlationRepository;
    this.engine = customEngine || correlationEngine;
    this.topology = customTopology || topologyService;
  }

  public registerSSEBroadcaster(broadcaster: CorrelationBroadcaster): void {
    this.broadcaster = broadcaster;
    this.engine.registerBroadcaster(broadcaster);
  }

  public getTopology(): CameraTopologyConfig {
    return this.topology.getTopologyConfig();
  }

  public getRelationshipsForCamera(cameraId: string): CameraRelationship[] {
    return this.topology.getRelationshipsForCamera(cameraId);
  }

  async getCorrelations(options: CorrelationFilterOptions = {}): Promise<Correlation[]> {
    return this.repo.findAll(options);
  }

  async getCorrelationById(id: string): Promise<Correlation> {
    const correlation = await this.repo.findById(id);
    if (!correlation) {
      throw new NotFoundError(`Correlation with ID '${id}' not found`);
    }
    return correlation;
  }

  async getCorrelationsByEvent(eventId: string): Promise<Correlation[]> {
    return this.repo.findByEventId(eventId);
  }

  async evaluateEvent(event: Event): Promise<Correlation[]> {
    return this.engine.evaluateEvent(event);
  }

  async proposeCorrelation(correlation: Correlation): Promise<Correlation> {
    const created = await this.repo.create(correlation);
    if (this.broadcaster) {
      this.broadcaster('correlation_created', created);
    }
    return created;
  }

  async updateState(
    id: string,
    state: CorrelationState,
    reviewerInfo?: { reviewedBy?: string; reviewNote?: string }
  ): Promise<Correlation> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError(`Correlation with ID '${id}' not found`);
    }

    const updated = await this.repo.updateState(id, state, reviewerInfo);
    if (!updated) {
      throw new NotFoundError(`Correlation with ID '${id}' not found`);
    }

    // Broadcast update
    if (this.broadcaster) {
      this.broadcaster('correlation_updated', updated);
    }

    // Log Audit
    try {
      const action = state === 'accepted' ? 'CORRELATION_ACCEPTED' : state === 'rejected' ? 'CORRELATION_REJECTED' : 'CORRELATION_STATE_CHANGED';
      await auditRepository.create({
        id: `AUDIT-CORR-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        actor: reviewerInfo?.reviewedBy || 'Operator',
        action,
        entity: 'Correlation',
        timestamp: new Date().toISOString(),
        metadata: {
          correlationId: id,
          previousState: existing.state,
          newState: state,
          reviewNote: reviewerInfo?.reviewNote,
        },
      });
    } catch (auditErr) {
      logger.warn('Failed to record correlation audit log:', auditErr);
    }

    return updated;
  }

  async accept(id: string, reviewedBy = 'Operator', reviewNote?: string): Promise<Correlation> {
    return this.updateState(id, 'accepted', { reviewedBy, reviewNote });
  }

  async reject(id: string, reviewedBy = 'Operator', reviewNote?: string): Promise<Correlation> {
    return this.updateState(id, 'rejected', { reviewedBy, reviewNote });
  }

  async addNote(id: string, reviewNote: string, reviewedBy = 'Operator'): Promise<Correlation> {
    if (!reviewNote || !reviewNote.trim()) {
      throw new ValidationError('Review note cannot be empty');
    }

    const updated = await this.repo.addNote(id, reviewNote.trim(), reviewedBy);
    if (!updated) {
      throw new NotFoundError(`Correlation with ID '${id}' not found`);
    }

    if (this.broadcaster) {
      this.broadcaster('correlation_updated', updated);
    }

    try {
      await auditRepository.create({
        id: `AUDIT-CORR-NOTE-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        actor: reviewedBy,
        action: 'CORRELATION_NOTE_ADDED',
        entity: 'Correlation',
        timestamp: new Date().toISOString(),
        metadata: {
          correlationId: id,
          noteSnippet: reviewNote.substring(0, 100),
        },
      });
    } catch (auditErr) {
      logger.warn('Failed to record correlation note audit log:', auditErr);
    }

    return updated;
  }
}

export const correlationService = new CorrelationService();
