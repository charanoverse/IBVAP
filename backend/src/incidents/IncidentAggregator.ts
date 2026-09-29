import { Event, Incident, IncidentPriority } from '@ibvap/shared';
import { incidentRepository } from '../repositories/incidentRepository.js';
import { cameraRepository } from '../repositories/cameraRepository.js';
import { EvaluatedIncidentPolicy, incidentPolicyService } from './IncidentPolicyService.js';
import { logger } from '../utils/logger.js';

export interface AggregationResult {
  action: 'CREATED' | 'AGGREGATED' | 'DEDUPLICATED' | 'IGNORED_BY_POLICY';
  incident?: Incident;
  isNew: boolean;
}

let incidentCounter = 100;

export class IncidentAggregator {
  /**
   * Processes a verified security event:
   * 1. Checks for exact deduplication (idempotency by eventId).
   * 2. Checks for compatible same-camera & same-track aggregation within window.
   * 3. Creates a new Incident if policy permits.
   */
  async processEvent(event: Event): Promise<AggregationResult> {
    // 1. Idempotency / Deduplication Check
    const existingForEvent = await incidentRepository.findByPrimaryEventId(event.id);
    if (existingForEvent) {
      logger.debug(`Event ${event.id} already associated with incident ${existingForEvent.id} — deduplicated.`);
      return {
        action: 'DEDUPLICATED',
        incident: existingForEvent,
        isNew: false,
      };
    }

    // 2. Evaluate Event Policy
    const policy = incidentPolicyService.evaluateEvent(event);

    // 3. Conservative Same-Camera + Same-Track Aggregation Check
    if (event.trackId !== undefined && event.cameraId) {
      const openIncident = await incidentRepository.findOpenIncidentForTrack(
        event.cameraId,
        event.trackId,
        policy.aggregationWindowSeconds
      );

      if (openIncident && openIncident.state !== 'CLOSED') {
        // Verify event compatibility on same camera & track
        logger.info(
          `Aggregating event ${event.id} (${event.eventType}) into open incident ${openIncident.id} on ${event.cameraId} track ${event.trackDisplayId || event.trackId}`
        );

          // Update title if combining ZONE_ENTRY and DWELL
          let title = openIncident.title;
          if (
            (openIncident.title.includes('Entry') && event.eventType === 'DWELL') ||
            (openIncident.title.includes('Dwell') && event.eventType === 'ZONE_ENTRY')
          ) {
            title = openIncident.title.replace(/Entry|Dwell/g, 'Activity');
          }

          // Upgrade priority if new event priority is higher
          const priorityOrder: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          let priority = openIncident.priority;
          if (priorityOrder[policy.priority.toUpperCase()] > priorityOrder[openIncident.priority.toUpperCase()]) {
            priority = policy.priority;
          }

          const updatedExplanation = openIncident.explanation
            ? `${openIncident.explanation} Aggregated ${event.eventType} event at offset ${event.videoTimestamp?.toFixed(1) || 0}s.`
            : policy.explanation;

          const updated = await incidentRepository.addLinkedEvent(openIncident.id, event.id, priority);
          if (updated) {
            const finalUpdated = await incidentRepository.update({
              ...updated,
              title,
              explanation: updatedExplanation,
            });

            return {
              action: 'AGGREGATED',
              incident: finalUpdated,
              isNew: false,
            };
          }
        }
      }

    // 4. Check if event should create an incident per policy
    if (!policy.shouldCreateIncident) {
      logger.debug(`Event ${event.id} (${event.eventType}) ignored by policy (createIncident = false)`);
      return {
        action: 'IGNORED_BY_POLICY',
        isNew: false,
      };
    }

    // 5. Create New Incident Record
    const incidentSeq = ++incidentCounter;
    const padSeq = incidentSeq.toString().padStart(6, '0');
    const incidentId = `INC-${padSeq}`;

    let cameraName: string | undefined;
    try {
      const cam = await cameraRepository.findById(event.cameraId);
      if (cam) cameraName = cam.name;
    } catch {}

    const now = new Date().toISOString();
    const newIncident: Incident = {
      id: incidentId,
      title: policy.title,
      cameraId: event.cameraId,
      cameraName,
      zoneId: event.zoneId,
      zoneName: event.zoneId ? event.zoneId.replace('ZONE-', '').replace(/_/g, ' ') : undefined,
      lineId: event.lineId,
      lineName: event.lineId ? event.lineId.replace('LINE-', '').replace(/_/g, ' ') : undefined,
      primaryEventId: event.id,
      linkedEventIds: [event.id],
      linkedEvents: [event.id],
      priority: policy.priority,
      priorityReason: policy.priorityReason,
      state: 'NEW',
      reviewState: 'NEW',
      openedAt: event.timestamp || now,
      evidenceIds: [],
      evidence: [],
      evidenceState: 'PENDING',
      evidenceAvailable: false,
      explanation: policy.explanation,
      trackId: event.trackId,
      trackDisplayId: event.trackDisplayId,
      objectClass: event.objectClass,
      observationQuality: 'GOOD',
      relatedObservations: [],
      recommendedViews: [event.cameraId],
      createdAt: now,
      updatedAt: now,
    };

    const created = await incidentRepository.create(newIncident);
    logger.info(`Opened new incident ${created.id} (${created.priority}) on ${created.cameraId} for event ${event.id}`);

    return {
      action: 'CREATED',
      incident: created,
      isNew: true,
    };
  }
}

export const incidentAggregator = new IncidentAggregator();
