import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/repositories/database.js';
import { eventRepository } from '../src/repositories/eventRepository.js';
import { correlationRepository } from '../src/repositories/correlationRepository.js';
import { auditRepository } from '../src/repositories/auditRepository.js';
import { correlationService } from '../src/services/correlationService.js';
import { topologyService } from '../src/correlations/TopologyService.js';
import { correlationEngine } from '../src/correlations/CorrelationEngine.js';
import { Event } from '@ibvap/shared';

describe('Phase 7: Cross-Camera Event Correlation & Topology Engine', () => {
  beforeAll(async () => {
    await db.connect();
    await db.initializeSchema();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await db.clearAllTables();

    // Seed test cameras
    await db.run(
      `INSERT INTO cameras (id, name, source_reference, status, created_at, updated_at)
       VALUES ('CAM-01', 'North Gate Checkpoint', '/api/cameras/CAM-01/video', 'active', datetime('now'), datetime('now')),
              ('CAM-02', 'North Corridor Approach', '/api/cameras/CAM-02/video', 'active', datetime('now'), datetime('now')),
              ('CAM-03', 'Sterile Zone East', '/api/cameras/CAM-03/video', 'active', datetime('now'), datetime('now')),
              ('CAM-04', 'South Egress Barrier', '/api/cameras/CAM-04/video', 'active', datetime('now'), datetime('now')),
              ('CAM-05', 'East Perimeter Fence', '/api/cameras/CAM-05/video', 'active', datetime('now'), datetime('now'))`
    );
  });

  describe('1. Camera Topology Graph & Travel-Time Windows', () => {
    it('loads configured camera relationships correctly', () => {
      const config = topologyService.getTopologyConfig();
      expect(config.relationships).toBeDefined();
      expect(config.relationships.length).toBeGreaterThanOrEqual(5);

      const rel01to02 = topologyService.findRelationship('CAM-01', 'CAM-02');
      expect(rel01to02).toBeDefined();
      expect(rel01to02?.relationshipType).toBe('ENTRY_TO_CORRIDOR');
      expect(rel01to02?.minTravelTimeSeconds).toBe(2);
      expect(rel01to02?.maxTravelTimeSeconds).toBe(15);
    });

    it('enforces directed adjacency: CAM-01 -> CAM-02 is valid, but reverse CAM-02 -> CAM-01 is not direct', () => {
      const directForward = topologyService.findRelationship('CAM-01', 'CAM-02');
      const directReverse = topologyService.findRelationship('CAM-02', 'CAM-01');

      expect(directForward).toBeDefined();
      expect(directReverse).toBeUndefined();
    });

    it('retrieves incoming and outgoing neighbors for a camera', () => {
      const incomingTo02 = topologyService.getIncomingNeighbors('CAM-02');
      expect(incomingTo02.some((r) => r.sourceCameraId === 'CAM-01')).toBe(true);

      const outgoingFrom02 = topologyService.getOutgoingNeighbors('CAM-02');
      expect(outgoingFrom02.some((r) => r.targetCameraId === 'CAM-03')).toBe(true);
    });
  });

  describe('2. Deterministic & Explainable Correlation Evaluation', () => {
    it('generates correlation candidate when events match topology, travel-time window, and event types', async () => {
      const baseTime = Date.now();

      // 1. Upstream event on CAM-01
      const sourceEvent: Event = {
        id: 'EVT-CAM01-100',
        eventType: 'LINE_CROSSING',
        cameraId: 'CAM-01',
        trackId: 1,
        trackDisplayId: 'T001',
        objectClass: 'person',
        timestamp: new Date(baseTime).toISOString(),
        videoTimestamp: 10.0,
      };
      await eventRepository.upsert(sourceEvent);

      // 2. Downstream event on CAM-02 4.5s later (within [2s, 15s])
      const targetEvent: Event = {
        id: 'EVT-CAM02-200',
        eventType: 'ZONE_ENTRY',
        cameraId: 'CAM-02',
        trackId: 1, // Local track ID on CAM-02 (isolated technical ID)
        trackDisplayId: 'T001',
        objectClass: 'person',
        timestamp: new Date(baseTime + 4500).toISOString(),
        videoTimestamp: 14.5,
      };
      await eventRepository.upsert(targetEvent);

      const candidates = await correlationEngine.evaluateEvent(targetEvent);

      expect(candidates.length).toBe(1);
      const corr = candidates[0];
      expect(corr.sourceEventId).toBe('EVT-CAM01-100');
      expect(corr.targetEventId).toBe('EVT-CAM02-200');
      expect(corr.sourceCameraId).toBe('CAM-01');
      expect(corr.targetCameraId).toBe('CAM-02');
      expect(corr.relationshipType).toBe('ENTRY_TO_CORRIDOR');
      expect(corr.timeDeltaSeconds).toBe(4.5);
      expect(corr.score).toBeGreaterThanOrEqual(0.65);
      expect(corr.state).toBe('candidate');
      expect(corr.factors.topologyMatch).toBe(true);
      expect(corr.factors.temporalMatch).toBe(true);
      expect(corr.factors.eventTypeMatch).toBe(true);
      expect(corr.explanation).toContain('precedes EVT-CAM02-200 on CAM-02');
      expect(corr.explanation).toContain('fits the configured travel window');
    });

    it('rejects candidate generation when time delta exceeds configured maximum travel window', async () => {
      const baseTime = Date.now();

      // Upstream event on CAM-01
      const sourceEvent: Event = {
        id: 'EVT-CAM01-TOO-OLD',
        eventType: 'LINE_CROSSING',
        cameraId: 'CAM-01',
        timestamp: new Date(baseTime).toISOString(),
        videoTimestamp: 10.0,
      };
      await eventRepository.upsert(sourceEvent);

      // Downstream event on CAM-02 45.0s later (max is 15s)
      const targetEvent: Event = {
        id: 'EVT-CAM02-LATE',
        eventType: 'ZONE_ENTRY',
        cameraId: 'CAM-02',
        timestamp: new Date(baseTime + 45000).toISOString(),
        videoTimestamp: 55.0,
      };
      await eventRepository.upsert(targetEvent);

      const candidates = await correlationEngine.evaluateEvent(targetEvent);
      expect(candidates.length).toBe(0);
    });

    it('rejects candidate generation when downstream event occurs BEFORE upstream event', async () => {
      const baseTime = Date.now();

      // Upstream event on CAM-01 occurs AT 50.0s
      const sourceEvent: Event = {
        id: 'EVT-CAM01-FUTURE',
        eventType: 'LINE_CROSSING',
        cameraId: 'CAM-01',
        timestamp: new Date(baseTime + 50000).toISOString(),
        videoTimestamp: 50.0,
      };
      await eventRepository.upsert(sourceEvent);

      // Downstream event on CAM-02 occurs AT 10.0s
      const targetEvent: Event = {
        id: 'EVT-CAM02-EARLIER',
        eventType: 'ZONE_ENTRY',
        cameraId: 'CAM-02',
        timestamp: new Date(baseTime + 10000).toISOString(),
        videoTimestamp: 10.0,
      };
      await eventRepository.upsert(targetEvent);

      const candidates = await correlationEngine.evaluateEvent(targetEvent);
      expect(candidates.length).toBe(0);
    });

    it('strictly isolates local track IDs and NEVER claims same-person biometric identity', async () => {
      const baseTime = Date.now();

      const sourceEvent: Event = {
        id: 'EVT-CAM01-T007',
        eventType: 'LINE_CROSSING',
        cameraId: 'CAM-01',
        trackId: 7,
        trackDisplayId: 'T007',
        objectClass: 'person',
        timestamp: new Date(baseTime).toISOString(),
        videoTimestamp: 20.0,
      };
      await eventRepository.upsert(sourceEvent);

      const targetEvent: Event = {
        id: 'EVT-CAM02-T007',
        eventType: 'ZONE_ENTRY',
        cameraId: 'CAM-02',
        trackId: 7, // Identical track ID 7 on a different camera is purely a local technical index
        trackDisplayId: 'T007',
        objectClass: 'person',
        timestamp: new Date(baseTime + 4000).toISOString(),
        videoTimestamp: 24.0,
      };
      await eventRepository.upsert(targetEvent);

      const candidates = await correlationEngine.evaluateEvent(targetEvent);
      expect(candidates.length).toBe(1);
      const corr = candidates[0];

      // Verify explanation and reason DO NOT claim identity or same person
      const text = `${corr.explanation} ${corr.reason} ${JSON.stringify(corr.factors)}`.toLowerCase();
      expect(text).not.toContain('same person');
      expect(text).not.toContain('same individual');
      expect(text).not.toContain('reid');
      expect(text).not.toContain('biometric');
      expect(text).not.toContain('confirmed identity');
    });

    it('deduplicates correlation candidate creation for already evaluated event pairs', async () => {
      const baseTime = Date.now();

      const sourceEvent: Event = {
        id: 'EVT-CAM05-500',
        eventType: 'LINE_CROSSING',
        cameraId: 'CAM-05',
        timestamp: new Date(baseTime).toISOString(),
        videoTimestamp: 30.0,
      };
      await eventRepository.upsert(sourceEvent);

      const targetEvent: Event = {
        id: 'EVT-CAM03-300',
        eventType: 'ZONE_ENTRY',
        cameraId: 'CAM-03',
        timestamp: new Date(baseTime + 5000).toISOString(),
        videoTimestamp: 35.0,
      };
      await eventRepository.upsert(targetEvent);

      // First evaluation
      const firstRun = await correlationEngine.evaluateEvent(targetEvent);
      expect(firstRun.length).toBe(1);

      // Second evaluation on the same event
      const secondRun = await correlationEngine.evaluateEvent(targetEvent);
      expect(secondRun.length).toBe(0); // Duplicate prevented

      // Verify only 1 record exists in repository
      const allCorrs = await correlationRepository.findByEventId('EVT-CAM03-300');
      expect(allCorrs.length).toBe(1);
    });
  });

  describe('3. Operator Review State Transitions & Audit Trails', () => {
    let testCorrId: string;

    beforeEach(async () => {
      // Seed parent events to satisfy FK constraints
      await eventRepository.upsert({
        id: 'EVT-CAM01-A',
        eventType: 'LINE_CROSSING',
        cameraId: 'CAM-01',
        timestamp: new Date().toISOString(),
      });
      await eventRepository.upsert({
        id: 'EVT-CAM02-B',
        eventType: 'ZONE_ENTRY',
        cameraId: 'CAM-02',
        timestamp: new Date().toISOString(),
      });

      const corr = await correlationRepository.create({
        id: 'CORR-TEST-001-002',
        sourceEventId: 'EVT-CAM01-A',
        targetEventId: 'EVT-CAM02-B',
        sourceCameraId: 'CAM-01',
        targetCameraId: 'CAM-02',
        relationshipType: 'ENTRY_TO_CORRIDOR',
        timeDeltaSeconds: 4.2,
        score: 0.88,
        factors: {
          topologyMatch: true,
          temporalMatch: true,
          directionMatch: true,
          eventTypeMatch: true,
          timeDeltaSeconds: 4.2,
          minAllowedTimeSeconds: 2,
          maxAllowedTimeSeconds: 15,
        },
        explanation: 'Event EVT-CAM01-A on CAM-01 precedes EVT-CAM02-B on CAM-02 by 4.2s within configured travel window.',
        state: 'candidate',
        reason: 'Topology path matched',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      testCorrId = corr.id;
    });

    it('allows operator to ACCEPT a correlation candidate', async () => {
      const updated = await correlationService.accept(
        testCorrId,
        'Watch Commander Alpha',
        'Temporal sequence corroborated across northern gates.'
      );

      expect(updated.state).toBe('accepted');
      expect(updated.reviewedBy).toBe('Watch Commander Alpha');
      expect(updated.reviewNote).toContain('Temporal sequence corroborated');
      expect(updated.reviewedAt).toBeDefined();

      // Check audit log
      const auditLogs = await auditRepository.findAll(10);
      const acceptLog = auditLogs.find((a) => a.action === 'CORRELATION_ACCEPTED');
      expect(acceptLog).toBeDefined();
      expect(acceptLog?.actor).toBe('Watch Commander Alpha');
    });

    it('allows operator to REJECT a correlation candidate', async () => {
      const updated = await correlationService.reject(
        testCorrId,
        'Duty Officer Bravo',
        'Observation timestamps do not correspond to continuous activity.'
      );

      expect(updated.state).toBe('rejected');
      expect(updated.reviewedBy).toBe('Duty Officer Bravo');
      expect(updated.reviewNote).toContain('timestamps do not correspond');

      // Check audit log
      const auditLogs = await auditRepository.findAll(10);
      const rejectLog = auditLogs.find((a) => a.action === 'CORRELATION_REJECTED');
      expect(rejectLog).toBeDefined();
    });

    it('allows operator to append review notes to a correlation record', async () => {
      const updated = await correlationService.addNote(
        testCorrId,
        'Second operator cross-checked vehicle size.',
        'Officer Charlie'
      );

      expect(updated.reviewNote).toContain('Second operator cross-checked');
      expect(updated.reviewedBy).toBe('Officer Charlie');

      const auditLogs = await auditRepository.findAll(10);
      const noteLog = auditLogs.find((a) => a.action === 'CORRELATION_NOTE_ADDED');
      expect(noteLog).toBeDefined();
    });
  });

  describe('4. REST API Endpoints for Cross-Camera Correlation', () => {
    beforeEach(async () => {
      // Seed parent events to satisfy FK constraints
      await eventRepository.upsert({
        id: 'EVT-API-01',
        eventType: 'LINE_CROSSING',
        cameraId: 'CAM-01',
        timestamp: new Date().toISOString(),
      });
      await eventRepository.upsert({
        id: 'EVT-API-02',
        eventType: 'ZONE_ENTRY',
        cameraId: 'CAM-02',
        timestamp: new Date().toISOString(),
      });

      await correlationRepository.create({
        id: 'CORR-API-01',
        sourceEventId: 'EVT-API-01',
        targetEventId: 'EVT-API-02',
        sourceCameraId: 'CAM-01',
        targetCameraId: 'CAM-02',
        relationshipType: 'ENTRY_TO_CORRIDOR',
        timeDeltaSeconds: 3.5,
        score: 0.85,
        factors: {
          topologyMatch: true,
          temporalMatch: true,
          directionMatch: true,
          eventTypeMatch: true,
          timeDeltaSeconds: 3.5,
          minAllowedTimeSeconds: 2,
          maxAllowedTimeSeconds: 15,
        },
        explanation: 'Event EVT-API-01 on CAM-01 precedes EVT-API-02 on CAM-02 by 3.5s.',
        state: 'candidate',
        reason: 'Path verified',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    it('GET /api/correlations/topology returns declarative topology configuration', async () => {
      const res = await request(app).get('/api/correlations/topology');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.relationships).toBeDefined();
      expect(Array.isArray(res.body.data.relationships)).toBe(true);
      expect(res.body.data.scoringWeights).toBeDefined();
    });

    it('GET /api/correlations returns list of correlations with filtering', async () => {
      const res = await request(app).get('/api/correlations?state=candidate&cameraId=CAM-01');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/correlations/:id returns single correlation', async () => {
      const res = await request(app).get('/api/correlations/CORR-API-01');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('CORR-API-01');
      expect(res.body.data.score).toBe(0.85);
    });

    it('PATCH /api/correlations/:id/accept updates state to accepted', async () => {
      const res = await request(app)
        .patch('/api/correlations/CORR-API-01/accept')
        .send({ reviewedBy: 'Test Operator', reviewNote: 'Accepted via REST test' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.state).toBe('accepted');
      expect(res.body.data.reviewedBy).toBe('Test Operator');
    });

    it('PATCH /api/correlations/:id/reject updates state to rejected', async () => {
      const res = await request(app)
        .patch('/api/correlations/CORR-API-01/reject')
        .send({ reviewedBy: 'Test Operator', reviewNote: 'Rejected via REST test' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.state).toBe('rejected');
    });

    it('POST /api/correlations/:id/notes appends operator review note', async () => {
      const res = await request(app)
        .post('/api/correlations/CORR-API-01/notes')
        .send({ note: 'Appended note from API', reviewedBy: 'Shift Supervisor' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reviewNote).toContain('Appended note from API');
    });
  });
});
