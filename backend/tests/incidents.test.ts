import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/repositories/database.js';
import { eventRepository } from '../src/repositories/eventRepository.js';
import { incidentRepository } from '../src/repositories/incidentRepository.js';
import { evidenceRepository } from '../src/repositories/evidenceRepository.js';
import { auditRepository } from '../src/repositories/auditRepository.js';
import { incidentService } from '../src/services/incidentService.js';
import { incidentPolicyService } from '../src/incidents/IncidentPolicyService.js';
import { incidentAggregator } from '../src/incidents/IncidentAggregator.js';
import { evidenceService } from '../src/services/evidenceService.js';
import { Event, Incident } from '@ibvap/shared';

describe('Phase 6: Incident Management, Evidence Capture & Operator Review', () => {
  beforeAll(async () => {
    await db.connect();
    await db.initializeSchema();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await db.clearAllTables();

    // Seed test camera
    await db.run(
      `INSERT INTO cameras (id, name, source_reference, status, created_at, updated_at)
       VALUES ('CAM-03', 'Sterile Zone East', '/api/cameras/CAM-03/video', 'active', datetime('now'), datetime('now')),
              ('CAM-01', 'North Gate Checkpoint', '/api/cameras/CAM-01/video', 'active', datetime('now'), datetime('now'))`
    );
  });

  describe('1. Declarative Incident Policy Evaluation', () => {
    it('evaluates ZONE_ENTRY event as HIGH priority incident with explainable reason', () => {
      const event: Event = {
        id: 'EVT-TEST-001',
        eventType: 'ZONE_ENTRY',
        cameraId: 'CAM-03',
        ruleId: 'RULE-CAM03-01',
        ruleName: 'Sterile Zone Entry Breach',
        zoneId: 'ZONE-CAM03-RESTRICTED',
        trackId: 17,
        trackDisplayId: 'T017',
        objectClass: 'person',
        confidence: 0.94,
        timestamp: '2026-09-26T18:00:00Z',
        videoTimestamp: 18.4,
      };

      const policy = incidentPolicyService.evaluateEvent(event);
      expect(policy.shouldCreateIncident).toBe(true);
      expect(policy.priority).toBe('HIGH');
      expect(policy.priorityReason).toContain('Sterile / Restricted zone entry breach');
      expect(policy.title).toBe('Restricted Sterile Zone Entry');
      expect(policy.explanation).toContain('Person track T017');
    });

    it('evaluates ZONE_EXIT event as non-incident per configured policy', () => {
      const event: Event = {
        id: 'EVT-TEST-002',
        eventType: 'ZONE_EXIT',
        cameraId: 'CAM-04',
        ruleId: 'RULE-CAM04-02',
        ruleName: 'Southern Egress Zone Exit',
        trackId: 18,
        timestamp: '2026-09-26T18:01:00Z',
      };

      const policy = incidentPolicyService.evaluateEvent(event);
      expect(policy.shouldCreateIncident).toBe(false);
      expect(policy.priority).toBe('LOW');
    });

    it('evaluates LINE_CROSSING event as MEDIUM priority incident', () => {
      const event: Event = {
        id: 'EVT-TEST-003',
        eventType: 'LINE_CROSSING',
        cameraId: 'CAM-01',
        ruleId: 'RULE-CAM01-01',
        ruleName: 'North Gate Line Crossing',
        lineId: 'LINE-CAM01-GATE',
        trackId: 19,
        timestamp: '2026-09-26T18:02:00Z',
      };

      const policy = incidentPolicyService.evaluateEvent(event);
      expect(policy.shouldCreateIncident).toBe(true);
      expect(policy.priority).toBe('MEDIUM');
      expect(policy.title).toBe('Perimeter Line Crossing');
    });
  });

  describe('2. Incident Deduplication & Aggregation', () => {
    it('deduplicates identical verified event delivery (idempotency anchor)', async () => {
      const event: Event = {
        id: 'EVT-DEDUP-001',
        eventType: 'ZONE_ENTRY',
        cameraId: 'CAM-03',
        ruleName: 'Sterile Zone Entry Breach',
        trackId: 101,
        timestamp: '2026-09-26T18:10:00Z',
        videoTimestamp: 4.5,
      };

      const res1 = await incidentAggregator.processEvent(event);
      expect(res1.action).toBe('CREATED');
      expect(res1.isNew).toBe(true);
      expect(res1.incident).toBeDefined();

      // Second identical event arrival
      const res2 = await incidentAggregator.processEvent(event);
      expect(res2.action).toBe('DEDUPLICATED');
      expect(res2.isNew).toBe(false);
      expect(res2.incident?.id).toBe(res1.incident?.id);

      const allIncidents = await incidentRepository.findAll();
      expect(allIncidents.length).toBe(1);
    });

    it('aggregates same-camera + same-track compatible events (ZONE_ENTRY + DWELL) into 1 open incident', async () => {
      const event1: Event = {
        id: 'EVT-AGG-001',
        eventType: 'ZONE_ENTRY',
        cameraId: 'CAM-03',
        ruleName: 'Sterile Zone Entry Breach',
        zoneId: 'ZONE-CAM03-RESTRICTED',
        trackId: 202,
        trackDisplayId: 'T202',
        objectClass: 'person',
        timestamp: '2026-09-26T18:20:00Z',
        videoTimestamp: 18.2,
      };

      const res1 = await incidentAggregator.processEvent(event1);
      expect(res1.action).toBe('CREATED');
      const incId = res1.incident!.id;

      // Closely related DWELL event on SAME camera and SAME track
      const event2: Event = {
        id: 'EVT-AGG-002',
        eventType: 'DWELL',
        cameraId: 'CAM-03',
        ruleName: 'Sterile Zone Loitering / Dwell',
        zoneId: 'ZONE-CAM03-RESTRICTED',
        trackId: 202,
        trackDisplayId: 'T202',
        objectClass: 'person',
        timestamp: '2026-09-26T18:20:05Z',
        videoTimestamp: 21.5,
      };

      const res2 = await incidentAggregator.processEvent(event2);
      expect(res2.action).toBe('AGGREGATED');
      expect(res2.isNew).toBe(false);
      expect(res2.incident?.id).toBe(incId);
      expect(res2.incident?.linkedEventIds).toContain('EVT-AGG-001');
      expect(res2.incident?.linkedEventIds).toContain('EVT-AGG-002');
      expect(res2.incident?.title).toContain('Activity');

      const allIncidents = await incidentRepository.findAll();
      expect(allIncidents.length).toBe(1);
    });

    it('does NOT aggregate events from DIFFERENT local tracks', async () => {
      const event1: Event = {
        id: 'EVT-DIFF-TRK-1',
        eventType: 'ZONE_ENTRY',
        cameraId: 'CAM-03',
        trackId: 301,
        timestamp: '2026-09-26T18:30:00Z',
      };

      const event2: Event = {
        id: 'EVT-DIFF-TRK-2',
        eventType: 'ZONE_ENTRY',
        cameraId: 'CAM-03',
        trackId: 302, // Different track
        timestamp: '2026-09-26T18:30:02Z',
      };

      const res1 = await incidentAggregator.processEvent(event1);
      const res2 = await incidentAggregator.processEvent(event2);

      expect(res1.action).toBe('CREATED');
      expect(res2.action).toBe('CREATED');
      expect(res1.incident?.id).not.toBe(res2.incident?.id);

      const all = await incidentRepository.findAll();
      expect(all.length).toBe(2);
    });

    it('does NOT aggregate events across DIFFERENT cameras (Strict Phase 6 Boundary)', async () => {
      const eventCam1: Event = {
        id: 'EVT-CAM1-01',
        eventType: 'LINE_CROSSING',
        cameraId: 'CAM-01',
        trackId: 10,
        timestamp: '2026-09-26T18:40:00Z',
      };

      const eventCam3: Event = {
        id: 'EVT-CAM3-01',
        eventType: 'ZONE_ENTRY',
        cameraId: 'CAM-03', // Different camera
        trackId: 10,
        timestamp: '2026-09-26T18:40:05Z',
      };

      const res1 = await incidentAggregator.processEvent(eventCam1);
      const res2 = await incidentAggregator.processEvent(eventCam3);

      expect(res1.action).toBe('CREATED');
      expect(res2.action).toBe('CREATED');
      expect(res1.incident?.id).not.toBe(res2.incident?.id);
    });
  });

  describe('3. Incident Lifecycle State Transitions', () => {
    it('executes full operator lifecycle: NEW -> ACKNOWLEDGED -> UNDER_REVIEW -> ESCALATED -> CLOSED', async () => {
      const incident: Incident = {
        id: 'INC-LIFECYCLE-01',
        title: 'Sterile Zone Intrusion',
        cameraId: 'CAM-03',
        primaryEventId: 'EVT-LC-01',
        linkedEventIds: ['EVT-LC-01'],
        priority: 'HIGH',
        priorityReason: 'Sterile buffer entry',
        state: 'NEW',
        openedAt: '2026-09-26T19:00:00Z',
        evidenceIds: [],
        evidenceState: 'READY',
        createdAt: '2026-09-26T19:00:00Z',
        updatedAt: '2026-09-26T19:00:00Z',
      };

      await incidentRepository.create(incident);

      // 1. Acknowledge
      const acked = await incidentService.acknowledge(incident.id, { id: 'op-1', name: 'Officer Smith' });
      expect(acked.state).toBe('ACKNOWLEDGED');
      expect(acked.acknowledgedBy).toBe('Officer Smith');
      expect(acked.acknowledgedAt).toBeDefined();

      // 2. Start Review
      const reviewed = await incidentService.startReview(incident.id, { id: 'op-1', name: 'Officer Smith' });
      expect(reviewed.state).toBe('UNDER_REVIEW');
      expect(reviewed.reviewStartedBy).toBe('Officer Smith');
      expect(reviewed.reviewStartedAt).toBeDefined();

      // 3. Escalate
      const escalated = await incidentService.escalate(
        incident.id,
        { id: 'op-1', name: 'Officer Smith' },
        'Subject attempting perimeter fence climb'
      );
      expect(escalated.state).toBe('ESCALATED');
      expect(escalated.escalatedBy).toBe('Officer Smith');
      expect(escalated.escalatedAt).toBeDefined();

      // 4. Close
      const closed = await incidentService.close(
        incident.id,
        { id: 'sup-1', name: 'Supervisor Davis' },
        'CONFIRMED_ACTIVITY',
        'Tactical team dispatched and subject secured.'
      );
      expect(closed.state).toBe('CLOSED');
      expect(closed.closedBy).toBe('Supervisor Davis');
      expect(closed.closedAt).toBeDefined();
      expect(closed.outcome).toBe('CONFIRMED_ACTIVITY');

      // 5. Invalid transition rejected on closed incident
      await expect(incidentService.acknowledge(incident.id)).rejects.toThrow();
      await expect(incidentService.startReview(incident.id)).rejects.toThrow();
    });

    it('allows appending operator notes with audit attribution', async () => {
      const incident: Incident = {
        id: 'INC-NOTE-TEST',
        title: 'Line Crossing',
        cameraId: 'CAM-01',
        primaryEventId: 'EVT-NOTE-01',
        linkedEventIds: ['EVT-NOTE-01'],
        priority: 'MEDIUM',
        priorityReason: 'Line crossing alert',
        state: 'UNDER_REVIEW',
        openedAt: '2026-09-26T19:15:00Z',
        evidenceIds: [],
        evidenceState: 'PENDING',
        createdAt: '2026-09-26T19:15:00Z',
        updatedAt: '2026-09-26T19:15:00Z',
      };
      await incidentRepository.create(incident);

      const updated = await incidentService.addNote(incident.id, { id: 'op-2', name: 'Agent Johnson' }, 'Visual confirmation of maintenance vehicle.');
      expect(updated.notes?.length).toBe(1);
      expect(updated.notes?.[0].authorName).toBe('Agent Johnson');
      expect(updated.notes?.[0].text).toContain('Visual confirmation');
    });
  });

  describe('4. Audit Trail Verification', () => {
    it('creates immutable AuditLog records for all incident lifecycle actions', async () => {
      const incident: Incident = {
        id: 'INC-AUDIT-TEST',
        title: 'Perimeter Alert',
        cameraId: 'CAM-03',
        primaryEventId: 'EVT-AUD-01',
        linkedEventIds: ['EVT-AUD-01'],
        priority: 'HIGH',
        priorityReason: 'Perimeter violation',
        state: 'NEW',
        openedAt: '2026-09-26T19:30:00Z',
        evidenceIds: [],
        evidenceState: 'PENDING',
        createdAt: '2026-09-26T19:30:00Z',
        updatedAt: '2026-09-26T19:30:00Z',
      };
      await incidentRepository.create(incident);

      await incidentService.acknowledge(incident.id, { id: 'op-demo', name: 'Demo Operator' });
      await incidentService.startReview(incident.id, { id: 'op-demo', name: 'Demo Operator' });
      await incidentService.addNote(incident.id, { id: 'op-demo', name: 'Demo Operator' }, 'Reviewing CCTV feed.');
      await incidentService.close(incident.id, { id: 'op-demo', name: 'Demo Operator' }, 'BENIGN_ACTIVITY', 'Authorized staff member.');

      const logs = await auditRepository.findAll();
      const incLogs = logs.filter((l) => l.entity === incident.id);

      const actions = incLogs.map((l) => l.action);
      expect(actions).toContain('INCIDENT_ACKNOWLEDGED');
      expect(actions).toContain('REVIEW_STARTED');
      expect(actions).toContain('NOTE_ADDED');
      expect(actions).toContain('INCIDENT_CLOSED');

      // Verify operator identity attribution
      const ackLog = incLogs.find((l) => l.action === 'INCIDENT_ACKNOWLEDGED');
      expect(ackLog?.actor).toContain('Demo Operator');
    });
  });

  describe('5. REST Endpoints & Evidence API', () => {
    it('GET /api/incidents returns filtered list and KPI metrics', async () => {
      await incidentRepository.create({
        id: 'INC-API-01',
        title: 'Sterile Breach',
        cameraId: 'CAM-03',
        primaryEventId: 'EVT-A1',
        linkedEventIds: ['EVT-A1'],
        priority: 'HIGH',
        priorityReason: 'Sterile zone',
        state: 'NEW',
        openedAt: '2026-09-26T19:40:00Z',
        evidenceIds: [],
        evidenceState: 'PENDING',
        createdAt: '2026-09-26T19:40:00Z',
        updatedAt: '2026-09-26T19:40:00Z',
      });

      const resList = await request(app).get('/api/incidents?priority=HIGH');
      expect(resList.status).toBe(200);
      expect(resList.body.success).toBe(true);
      expect(resList.body.data.length).toBe(1);
      expect(resList.body.data[0].id).toBe('INC-API-01');

      const resMetrics = await request(app).get('/api/incidents/metrics');
      expect(resMetrics.status).toBe(200);
      expect(resMetrics.body.success).toBe(true);
      expect(resMetrics.body.data.active).toBe(1);
      expect(resMetrics.body.data.highPriority).toBe(1);
    });

    it('PATCH /api/incidents/:id/acknowledge, review, close endpoints', async () => {
      const inc: Incident = {
        id: 'INC-API-OP-01',
        title: 'Gate Crossing',
        cameraId: 'CAM-01',
        primaryEventId: 'EVT-G1',
        linkedEventIds: ['EVT-G1'],
        priority: 'MEDIUM',
        priorityReason: 'Line crossing',
        state: 'NEW',
        openedAt: '2026-09-26T19:50:00Z',
        evidenceIds: [],
        evidenceState: 'PENDING',
        createdAt: '2026-09-26T19:50:00Z',
        updatedAt: '2026-09-26T19:50:00Z',
      };
      await incidentRepository.create(inc);

      // Acknowledge via API
      const resAck = await request(app)
        .patch(`/api/incidents/${inc.id}/acknowledge`)
        .send({ actorName: 'Inspector Vance' });
      expect(resAck.status).toBe(200);
      expect(resAck.body.data.state).toBe('ACKNOWLEDGED');

      // Review via API
      const resRev = await request(app)
        .patch(`/api/incidents/${inc.id}/review`)
        .send({ actorName: 'Inspector Vance' });
      expect(resRev.status).toBe(200);
      expect(resRev.body.data.state).toBe('UNDER_REVIEW');

      // Close via API
      const resClose = await request(app)
        .patch(`/api/incidents/${inc.id}/close`)
        .send({ outcome: 'FALSE_ALERT', notes: 'Camera glare reflection.' });
      expect(resClose.status).toBe(200);
      expect(resClose.body.data.state).toBe('CLOSED');
      expect(resClose.body.data.outcome).toBe('FALSE_ALERT');
    });

    it('blocks directory traversal attacks on evidence streaming endpoints', async () => {
      const resTraversal = await request(app).get('/api/evidence/INC-001/file/..%2F..%2Fpackage.json');
      expect(resTraversal.status).toBe(400);
    });
  });
});
