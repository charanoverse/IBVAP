import { Correlation, CorrelationFactors, Event } from '@ibvap/shared';
import { topologyService, TopologyService } from './TopologyService.js';
import { correlationRepository, CorrelationRepository } from '../repositories/correlationRepository.js';
import { eventRepository, EventRepository } from '../repositories/eventRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { logger } from '../utils/logger.js';

export type CorrelationBroadcaster = (eventType: string, data: any) => void;

export class CorrelationEngine {
  private topology: TopologyService;
  private correlationRepo: CorrelationRepository;
  private eventRepo: EventRepository;
  private broadcaster: CorrelationBroadcaster | null = null;

  constructor(
    customTopology?: TopologyService,
    customCorrelationRepo?: CorrelationRepository,
    customEventRepo?: EventRepository
  ) {
    this.topology = customTopology || topologyService;
    this.correlationRepo = customCorrelationRepo || correlationRepository;
    this.eventRepo = customEventRepo || eventRepository;
  }

  public registerBroadcaster(broadcaster: CorrelationBroadcaster): void {
    this.broadcaster = broadcaster;
  }

  /**
   * Evaluates a newly verified security event against recent events across neighboring cameras.
   * Generates candidate correlations based on topology, travel time windows, direction, and event types.
   */
  public async evaluateEvent(targetEvent: Event): Promise<Correlation[]> {
    if (!targetEvent || !targetEvent.id || !targetEvent.cameraId) {
      return [];
    }

    const targetCameraId = targetEvent.cameraId.toUpperCase();
    const incomingRelationships = this.topology.getIncomingNeighbors(targetCameraId);

    if (incomingRelationships.length === 0) {
      return [];
    }

    // Target event timestamp in seconds
    const targetTimeMs = new Date(targetEvent.timestamp).getTime();
    const targetVideoSec = targetEvent.videoTimestamp ?? targetTimeMs / 1000;

    const bufferSec = this.topology.getRecentEventBufferSeconds();
    const minTimeWindowMs = targetTimeMs - bufferSec * 1000;

    const generatedCandidates: Correlation[] = [];

    for (const rel of incomingRelationships) {
      const sourceCameraId = rel.sourceCameraId.toUpperCase();

      // Retrieve recent events for the upstream camera
      const recentSourceEvents = await this.eventRepo.findByCameraId(sourceCameraId, 20);

      for (const sourceEvent of recentSourceEvents) {
        // Guard against same-camera evaluation
        if (sourceEvent.cameraId.toUpperCase() === targetCameraId) {
          continue;
        }

        // Guard against identical event
        if (sourceEvent.id === targetEvent.id) {
          continue;
        }

        // Check if correlation already exists for this pair in either direction
        const existing = await this.correlationRepo.findByPair(sourceEvent.id, targetEvent.id);
        if (existing) {
          continue;
        }

        const sourceTimeMs = new Date(sourceEvent.timestamp).getTime();
        const sourceVideoSec = sourceEvent.videoTimestamp ?? sourceTimeMs / 1000;

        // Compute time delta in seconds
        let timeDeltaSeconds = 0;
        if (targetEvent.videoTimestamp !== undefined && sourceEvent.videoTimestamp !== undefined) {
          timeDeltaSeconds = targetVideoSec - sourceVideoSec;
        } else {
          timeDeltaSeconds = (targetTimeMs - sourceTimeMs) / 1000;
        }

        // Upstream event must precede target event (timeDelta > 0)
        if (timeDeltaSeconds < 0) {
          continue;
        }

        // Evaluate explainable factors
        const evaluation = this.calculateCorrelation(rel, sourceEvent, targetEvent, timeDeltaSeconds);

        if (evaluation.score >= this.topology.getMinScoreThreshold() && evaluation.factors.topologyMatch && evaluation.factors.temporalMatch) {
          const correlationId = `CORR-${sourceEvent.id}-${targetEvent.id}`;

          const candidate: Correlation = {
            id: correlationId,
            sourceEventId: sourceEvent.id,
            targetEventId: targetEvent.id,
            sourceCameraId: sourceEvent.cameraId,
            targetCameraId: targetEvent.cameraId,
            relationshipType: rel.relationshipType,
            timeDeltaSeconds: Math.round(timeDeltaSeconds * 10) / 10,
            score: Math.round(evaluation.score * 100) / 100,
            confidence: Math.round(evaluation.score * 100) / 100,
            factors: evaluation.factors,
            explanation: evaluation.explanation,
            state: 'candidate',
            reason: evaluation.reason,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const saved = await this.correlationRepo.create(candidate);
          generatedCandidates.push(saved);

          // Broadcast candidate event
          if (this.broadcaster) {
            this.broadcaster('correlation_created', saved);
          }

          // Audit log candidate creation
          try {
            await auditRepository.create({
              id: `AUDIT-CORR-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              actor: 'CorrelationEngine',
              action: 'CORRELATION_CANDIDATE_GENERATED',
              entity: 'Correlation',
              timestamp: new Date().toISOString(),
              metadata: {
                correlationId: saved.id,
                sourceEventId: saved.sourceEventId,
                targetEventId: saved.targetEventId,
                score: saved.score,
                relationshipType: saved.relationshipType,
                timeDeltaSeconds: saved.timeDeltaSeconds,
              },
            });
          } catch (auditErr) {
            logger.warn('Failed to write correlation audit log:', auditErr);
          }
        }
      }
    }

    // Sort by score descending and cap at maxCandidatesPerEvent
    generatedCandidates.sort((a, b) => b.score - a.score);
    return generatedCandidates.slice(0, this.topology.getMaxCandidatesPerEvent());
  }

  /**
   * Deterministically calculates explainable factors and weighted correlation score between two events.
   */
  public calculateCorrelation(
    rel: any,
    sourceEvent: Event,
    targetEvent: Event,
    timeDeltaSeconds: number
  ): {
    score: number;
    factors: CorrelationFactors;
    explanation: string;
    reason: string;
  } {
    const weights = this.topology.getScoringWeights();

    // 1. Topology match (Direct edge in configured graph)
    const topologyScore = 1.0;
    const topologyMatch = true;

    // 2. Temporal window evaluation
    const minTime = rel.minTravelTimeSeconds;
    const maxTime = rel.maxTravelTimeSeconds;
    let temporalScore = 0.0;
    let temporalMatch = false;

    if (timeDeltaSeconds >= minTime && timeDeltaSeconds <= maxTime) {
      temporalScore = 1.0;
      temporalMatch = true;
    } else if (timeDeltaSeconds >= minTime * 0.8 && timeDeltaSeconds <= maxTime * 1.2) {
      // Grace margin (20% tolerance)
      temporalScore = 0.5;
      temporalMatch = true;
    } else {
      temporalScore = 0.0;
      temporalMatch = false;
    }

    // 3. Direction Consistency
    const sourceDirection = (sourceEvent.metadata as any)?.direction || 'A_TO_B';
    const targetDirection = (targetEvent.metadata as any)?.direction || 'FORWARD';
    const allowedDirections = rel.allowedDirections || ['ANY'];

    let directionScore = 0.8;
    let directionMatch = true;

    if (allowedDirections.includes('ANY') || allowedDirections.length === 0) {
      directionScore = 1.0;
      directionMatch = true;
    } else if (allowedDirections.includes(sourceDirection) || allowedDirections.includes(targetDirection)) {
      directionScore = 1.0;
      directionMatch = true;
    } else {
      directionScore = 0.3;
      directionMatch = false;
    }

    // 4. Event Type Compatibility
    const sourceEventType = sourceEvent.eventType;
    const targetEventType = targetEvent.eventType;
    const compatibleTypes = rel.compatibleEventTypes || ['LINE_CROSSING', 'ZONE_ENTRY', 'ZONE_EXIT', 'DWELL'];

    let eventTypeScore = 0.7;
    let eventTypeMatch = true;

    if (
      compatibleTypes.includes(sourceEventType) &&
      compatibleTypes.includes(targetEventType)
    ) {
      eventTypeScore = 1.0;
      eventTypeMatch = true;
    } else if (sourceEventType === targetEventType) {
      eventTypeScore = 0.9;
      eventTypeMatch = true;
    } else {
      eventTypeScore = 0.4;
      eventTypeMatch = false;
    }

    // Composite Weighted Score
    const compositeScore =
      weights.topologyMatch * topologyScore +
      weights.temporalMatch * temporalScore +
      weights.directionMatch * directionScore +
      weights.eventTypeMatch * eventTypeScore;

    const roundedScore = Math.min(1.0, Math.max(0.0, compositeScore));

    const factors: CorrelationFactors = {
      topologyMatch,
      temporalMatch,
      directionMatch,
      eventTypeMatch,
      timeDeltaSeconds: Math.round(timeDeltaSeconds * 10) / 10,
      minAllowedTimeSeconds: minTime,
      maxAllowedTimeSeconds: maxTime,
      sourceEventType,
      targetEventType,
    };

    const deltaStr = `${Math.round(timeDeltaSeconds * 10) / 10}s`;
    const explanation = `Event ${sourceEvent.id} on ${sourceEvent.cameraId} (${sourceEventType}) precedes ${targetEvent.id} on ${targetEvent.cameraId} (${targetEventType}) by ${deltaStr}. This fits the configured travel window (${minTime}s–${maxTime}s) for path "${rel.relationshipType}". Movement direction and event types are consistent.`;

    const reason = `Topology path "${rel.relationshipType}" matched with delta ${deltaStr} in [${minTime}s, ${maxTime}s]`;

    return {
      score: roundedScore,
      factors,
      explanation,
      reason,
    };
  }
}

export const correlationEngine = new CorrelationEngine();
