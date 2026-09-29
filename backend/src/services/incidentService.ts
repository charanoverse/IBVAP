import {
  AuditLog,
  Event,
  Incident,
  IncidentEvidenceState,
  IncidentFilterOptions,
  IncidentNote,
  IncidentOutcomeType,
  IncidentPriority,
  IncidentReviewState,
  IncidentState,
  IncidentTimelineEvent,
  OperatorOutcome,
} from '@ibvap/shared';
import { incidentRepository } from '../repositories/incidentRepository.js';
import { eventRepository } from '../repositories/eventRepository.js';
import { trackRepository } from '../repositories/trackRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { incidentAggregator } from '../incidents/IncidentAggregator.js';
import { evidenceService } from './evidenceService.js';
import { BadRequestError, NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface OperatorActor {
  id: string;
  name: string;
  role?: string;
}

const DEFAULT_ACTOR: OperatorActor = {
  id: 'demo-operator',
  name: 'Demo Operator',
  role: 'Watch Commander',
};

export class IncidentService {
  private sseCallbacks: Array<(eventType: string, data: any) => void> = [];

  public registerSSEBroadcaster(cb: (eventType: string, data: any) => void): void {
    this.sseCallbacks.push(cb);
  }

  private broadcast(eventType: string, data: any): void {
    for (const cb of this.sseCallbacks) {
      try {
        cb(eventType, data);
      } catch {}
    }
  }

  async getIncidents(options: IncidentFilterOptions = {}): Promise<Incident[]> {
    return incidentRepository.findAll(options);
  }

  async getIncidentById(id: string): Promise<Incident> {
    const incident = await incidentRepository.findById(id);
    if (!incident) {
      throw new NotFoundError(`Incident with ID '${id}' not found`);
    }

    // Attach timeline
    const timeline = await this.buildTimeline(incident);
    return {
      ...incident,
      timeline,
    };
  }

  async createIncident(incident: Incident): Promise<Incident> {
    return incidentRepository.create(incident);
  }

  /**
   * Main entry point when a verified security event is received
   */
  async processVerifiedEvent(event: Event): Promise<{ incident?: Incident; action: string }> {
    const result = await incidentAggregator.processEvent(event);

    if (result.isNew && result.incident) {
      // 1. Audit Log: Incident Created
      await auditRepository.create({
        id: `AUD-INC-CREATE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        actor: 'SYSTEM',
        action: 'INCIDENT_CREATED',
        entity: result.incident.id,
        timestamp: new Date().toISOString(),
        metadata: {
          cameraId: result.incident.cameraId,
          primaryEventId: result.incident.primaryEventId,
          priority: result.incident.priority,
          priorityReason: result.incident.priorityReason,
        },
      });

      // 2. Queue automated evidence extraction
      evidenceService.queueEvidenceExtraction(result.incident, event).catch((err) => {
        logger.error(`Evidence extraction failed for ${result.incident?.id}:`, err);
      });

      // 3. Broadcast real-time SSE
      this.broadcast('incident_created', result.incident);
    } else if (result.action === 'AGGREGATED' && result.incident) {
      this.broadcast('incident_updated', result.incident);
    }

    return {
      incident: result.incident,
      action: result.action,
    };
  }

  /**
   * Operator Action: Acknowledge Incident (NEW -> ACKNOWLEDGED)
   */
  async acknowledge(id: string, actor: OperatorActor = DEFAULT_ACTOR): Promise<Incident> {
    const incident = await this.getIncidentById(id);

    if (incident.state === 'CLOSED') {
      throw new BadRequestError(`Cannot acknowledge closed incident '${id}'.`);
    }

    const now = new Date().toISOString();
    const updated: Incident = {
      ...incident,
      state: 'ACKNOWLEDGED',
      reviewState: 'ACKNOWLEDGED',
      acknowledgedAt: now,
      acknowledgedBy: actor.name,
    };

    const saved = await incidentRepository.update(updated);

    await auditRepository.create({
      id: `AUD-ACK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actor: `${actor.name} (${actor.id})`,
      action: 'INCIDENT_ACKNOWLEDGED',
      entity: id,
      timestamp: now,
      metadata: { actorRole: actor.role },
    });

    this.broadcast('incident_updated', saved);
    return saved;
  }

  /**
   * Operator Action: Start Review (ACKNOWLEDGED or NEW -> UNDER_REVIEW)
   */
  async startReview(id: string, actor: OperatorActor = DEFAULT_ACTOR): Promise<Incident> {
    const incident = await this.getIncidentById(id);

    if (incident.state === 'CLOSED') {
      throw new BadRequestError(`Cannot start review on closed incident '${id}'.`);
    }

    const now = new Date().toISOString();
    const updated: Incident = {
      ...incident,
      state: 'UNDER_REVIEW',
      reviewState: 'UNDER_REVIEW',
      acknowledgedAt: incident.acknowledgedAt || now,
      acknowledgedBy: incident.acknowledgedBy || actor.name,
      reviewStartedAt: now,
      reviewStartedBy: actor.name,
    };

    const saved = await incidentRepository.update(updated);

    await auditRepository.create({
      id: `AUD-REV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actor: `${actor.name} (${actor.id})`,
      action: 'REVIEW_STARTED',
      entity: id,
      timestamp: now,
      metadata: { actorRole: actor.role },
    });

    this.broadcast('incident_updated', saved);
    return saved;
  }

  /**
   * Operator Action: Escalate Incident (UNDER_REVIEW / ACKNOWLEDGED / NEW -> ESCALATED)
   */
  async escalate(
    id: string,
    actor: OperatorActor = DEFAULT_ACTOR,
    reason?: string
  ): Promise<Incident> {
    const incident = await this.getIncidentById(id);

    if (incident.state === 'CLOSED') {
      throw new BadRequestError(`Cannot escalate closed incident '${id}'.`);
    }

    const now = new Date().toISOString();
    let notes = incident.notes || [];

    if (reason && reason.trim()) {
      notes = [
        ...notes,
        {
          id: `note-${Date.now()}`,
          authorId: actor.id,
          authorName: actor.name,
          text: `[ESCALATION REASON]: ${reason.trim()}`,
          createdAt: now,
        },
      ];
    }

    const updated: Incident = {
      ...incident,
      state: 'ESCALATED',
      reviewState: 'ESCALATED',
      escalatedAt: now,
      escalatedBy: actor.name,
      notes,
    };

    const saved = await incidentRepository.update(updated);

    await auditRepository.create({
      id: `AUD-ESC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actor: `${actor.name} (${actor.id})`,
      action: 'INCIDENT_ESCALATED',
      entity: id,
      timestamp: now,
      metadata: { reason, actorRole: actor.role },
    });

    this.broadcast('incident_updated', saved);
    return saved;
  }

  /**
   * Operator Action: Close Incident (Active States -> CLOSED)
   */
  async close(
    id: string,
    actor: OperatorActor = DEFAULT_ACTOR,
    outcome: IncidentOutcomeType | string = 'CONFIRMED_ACTIVITY',
    notes?: string
  ): Promise<Incident> {
    const incident = await this.getIncidentById(id);

    if (incident.state === 'CLOSED') {
      throw new BadRequestError(`Incident '${id}' is already closed.`);
    }

    const now = new Date().toISOString();
    let currentNotes = incident.notes || [];

    if (notes && notes.trim()) {
      currentNotes = [
        ...currentNotes,
        {
          id: `note-${Date.now()}`,
          authorId: actor.id,
          authorName: actor.name,
          text: `[CLOSURE NOTE - ${outcome}]: ${notes.trim()}`,
          createdAt: now,
        },
      ];
    }

    const operatorOutcome: OperatorOutcome = {
      operatorId: actor.id,
      action: `Incident closed with disposition: ${outcome}`,
      notes: notes || 'Per standard operating procedures.',
      disposition: outcome,
      timestamp: now,
    };

    const updated: Incident = {
      ...incident,
      state: 'CLOSED',
      reviewState: 'CLOSED',
      closedAt: now,
      closedBy: actor.name,
      outcome,
      operatorNotes: notes || incident.operatorNotes,
      operatorOutcome,
      notes: currentNotes,
    };

    const saved = await incidentRepository.update(updated);

    await auditRepository.create({
      id: `AUD-CLOSE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actor: `${actor.name} (${actor.id})`,
      action: 'INCIDENT_CLOSED',
      entity: id,
      timestamp: now,
      metadata: { outcome, notes, actorRole: actor.role },
    });

    this.broadcast('incident_updated', saved);
    return saved;
  }

  /**
   * Operator Action: Add Note
   */
  async addNote(id: string, actor: OperatorActor = DEFAULT_ACTOR, text: string): Promise<Incident> {
    if (!text || !text.trim()) {
      throw new ValidationError('Note text cannot be empty');
    }

    const note: IncidentNote = {
      id: `note-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      authorId: actor.id,
      authorName: actor.name,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    const updated = await incidentRepository.addNote(id, note);
    if (!updated) {
      throw new NotFoundError(`Incident with ID '${id}' not found`);
    }

    await auditRepository.create({
      id: `AUD-NOTE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actor: `${actor.name} (${actor.id})`,
      action: 'NOTE_ADDED',
      entity: id,
      timestamp: note.createdAt,
      metadata: { noteId: note.id, textLength: text.length },
    });

    this.broadcast('incident_updated', updated);
    return updated;
  }

  /**
   * Constructs a chronological timeline combining track lifecycle, verified security events, evidence milestones, and operator actions
   */
  public async buildTimeline(incident: Incident): Promise<IncidentTimelineEvent[]> {
    const timeline: IncidentTimelineEvent[] = [];

    // 1. Initial track observation & trajectory if track exists
    if (incident.trackId !== undefined && incident.cameraId) {
      try {
        const track = await trackRepository.findById(`trk-${incident.cameraId.toLowerCase()}-${incident.trackId}`);
        if (track) {
          timeline.push({
            id: `tl-trk-${track.id}`,
            timestamp: track.firstSeen,
            videoTimestamp: track.firstSeenTimestamp,
            title: `Track ${incident.trackDisplayId || track.trackId} Detected`,
            description: `Target ${track.className} first acquired by local tracking algorithm on ${incident.cameraId}.`,
            type: 'TRACK_CREATED',
          });
        }
      } catch {}
    }

    // 2. Verified security events
    for (const eventId of incident.linkedEventIds) {
      try {
        const ev = await eventRepository.findById(eventId);
        if (ev) {
          timeline.push({
            id: `tl-ev-${ev.id}`,
            timestamp: ev.timestamp || ev.verifiedAt || incident.openedAt,
            videoTimestamp: ev.videoTimestamp,
            title: `${ev.eventType.replace(/_/g, ' ')} Event Verified`,
            description: ev.explanation || `Rule "${ev.ruleName || ev.ruleId}" satisfied on ${ev.cameraId}.`,
            type: 'EVENT_VERIFIED',
          });
        }
      } catch {}
    }

    // 3. Incident Opened
    timeline.push({
      id: `tl-inc-open-${incident.id}`,
      timestamp: incident.openedAt,
      title: 'Security Incident Opened',
      description: `Incident #${incident.id} opened with priority ${incident.priority}. Policy: ${incident.priorityReason}`,
      type: 'INCIDENT_OPENED',
    });

    // 4. Evidence Milestones from Audit Logs
    try {
      const logs = await auditRepository.findAll(100);
      const incLogs = logs.filter((l) => l.entity === incident.id);

      for (const l of incLogs) {
        if (l.action === 'EVIDENCE_STARTED') {
          timeline.push({
            id: `tl-aud-${l.id}`,
            timestamp: l.timestamp,
            title: 'Forensic Video Extraction Started',
            description: 'Extracting pre-event, event, post-event clips and snapshot from CCTV buffer.',
            type: 'EVIDENCE_STARTED',
            actor: l.actor,
          });
        } else if (l.action === 'EVIDENCE_READY') {
          timeline.push({
            id: `tl-aud-${l.id}`,
            timestamp: l.timestamp,
            title: 'Evidence Package Ready & SHA-256 Hashed',
            description: 'Derived evidence clips and frame snapshot secured with cryptographic hash manifest.',
            type: 'EVIDENCE_READY',
            actor: l.actor,
          });
        } else if (l.action === 'INCIDENT_ACKNOWLEDGED') {
          timeline.push({
            id: `tl-aud-${l.id}`,
            timestamp: l.timestamp,
            title: 'Incident Acknowledged by Operator',
            description: `Operator acknowledged alert and queued for inspection.`,
            type: 'OPERATOR_ACTION',
            actor: l.actor,
          });
        } else if (l.action === 'REVIEW_STARTED') {
          timeline.push({
            id: `tl-aud-${l.id}`,
            timestamp: l.timestamp,
            title: 'Operator Triage & Review Started',
            description: 'Operator initiated active video evidence analysis and rule verification.',
            type: 'OPERATOR_ACTION',
            actor: l.actor,
          });
        } else if (l.action === 'INCIDENT_ESCALATED') {
          timeline.push({
            id: `tl-aud-${l.id}`,
            timestamp: l.timestamp,
            title: 'Incident Escalated by Operator',
            description: `Escalated for supervisor attention. ${l.metadata?.reason ? `Reason: ${l.metadata.reason}` : ''}`,
            type: 'OPERATOR_ACTION',
            actor: l.actor,
          });
        } else if (l.action === 'INCIDENT_CLOSED') {
          timeline.push({
            id: `tl-aud-${l.id}`,
            timestamp: l.timestamp,
            title: `Incident Closed [${l.metadata?.outcome || incident.outcome || 'RESOLVED'}]`,
            description: `Incident closed by operator. ${l.metadata?.notes ? `Notes: ${l.metadata.notes}` : ''}`,
            type: 'OPERATOR_ACTION',
            actor: l.actor,
          });
        } else if (l.action === 'NOTE_ADDED') {
          timeline.push({
            id: `tl-aud-${l.id}`,
            timestamp: l.timestamp,
            title: 'Operator Note Appended',
            description: 'Additional operational note attached to incident file.',
            type: 'NOTE_ADDED',
            actor: l.actor,
          });
        }
      }
    } catch {}

    // Sort chronologically
    return timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async getMetrics(): Promise<{
    total: number;
    active: number;
    highPriority: number;
    acknowledged: number;
    closedToday: number;
  }> {
    return incidentRepository.countMetrics();
  }

  // Backward compatibility method
  async updateReviewState(id: string, state: IncidentReviewState, outcome?: OperatorOutcome): Promise<Incident> {
    const updated = await incidentRepository.updateReviewState(id, state, outcome);
    if (!updated) {
      throw new NotFoundError(`Incident with ID '${id}' not found`);
    }
    return updated;
  }
}

export const incidentService = new IncidentService();
