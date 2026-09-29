import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/repositories/database.js';
import { initializeDatabase } from '../src/repositories/initDb.js';
import { Event } from '@ibvap/shared';

describe('IBVAP Phase 5 — Rule Engine, Virtual Zones & Verified Security Events API', () => {
  beforeAll(async () => {
    await db.connect();
    await initializeDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  const testEvent1: Event = {
    id: 'EVT-TEST-CAM03-001',
    eventType: 'ZONE_ENTRY',
    cameraId: 'CAM-03',
    ruleId: 'RULE-CAM03-01',
    ruleName: 'Sterile Zone Entry Breach',
    zoneId: 'ZONE-CAM03-RESTRICTED',
    trackId: 17,
    trackDisplayId: 'T017',
    objectClass: 'person',
    confidence: 0.91,
    timestamp: '2026-09-26T12:00:04Z',
    startedAt: '2026-09-26T12:00:03Z',
    verifiedAt: '2026-09-26T12:00:04Z',
    videoTimestamp: 4.2,
    status: 'VERIFIED',
    verificationState: 'verified',
    explanation: 'Person track T017 entered Restricted Sterile Buffer Zone and remained inside for 0.40s.',
    metadata: {
      anchor: { x: 0.35, y: 0.50 },
      framesInside: 3,
    },
  };

  const testEvent2: Event = {
    id: 'EVT-TEST-CAM01-002',
    eventType: 'LINE_CROSSING',
    cameraId: 'CAM-01',
    ruleId: 'RULE-CAM01-01',
    ruleName: 'North Gate Line Crossing',
    lineId: 'LINE-CAM01-GATE',
    trackId: 8,
    trackDisplayId: 'T008',
    objectClass: 'car',
    confidence: 0.86,
    timestamp: '2026-09-26T12:01:10Z',
    videoTimestamp: 10.5,
    status: 'VERIFIED',
    verificationState: 'verified',
    explanation: 'Car track T008 crossed North Gate Entry Threshold.',
    metadata: {
      direction: 'A_TO_B',
    },
  };

  it('1. POST /api/events should persist verified security events with full metadata', async () => {
    const res1 = await request(app).post('/api/events').send(testEvent1);
    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);
    expect(res1.body.data.id).toBe(testEvent1.id);
    expect(res1.body.data.explanation).toBe(testEvent1.explanation);
    expect(res1.body.data.status).toBe('VERIFIED');

    const res2 = await request(app).post('/api/events').send(testEvent2);
    expect(res2.status).toBe(201);
    expect(res2.body.data.id).toBe(testEvent2.id);
  });

  it('2. GET /api/events should return list of verified security events', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);

    const found = res.body.data.find((e: Event) => e.id === testEvent1.id);
    expect(found).toBeDefined();
    expect(found.trackDisplayId).toBe('T017');
    expect(found.metadata.anchor.x).toBe(0.35);
  });

  it('3. GET /api/events?cameraId=CAM-03 should filter by camera ID', async () => {
    const res = await request(app).get('/api/events?cameraId=CAM-03');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    for (const evt of res.body.data) {
      expect(evt.cameraId).toBe('CAM-03');
    }
  });

  it('4. GET /api/events?eventType=LINE_CROSSING should filter by event type', async () => {
    const res = await request(app).get('/api/events?eventType=LINE_CROSSING');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    for (const evt of res.body.data) {
      expect(evt.eventType).toBe('LINE_CROSSING');
    }
  });

  it('5. GET /api/events/:id should return single event by technical ID', async () => {
    const res = await request(app).get(`/api/events/${testEvent1.id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(testEvent1.id);
    expect(res.body.data.ruleName).toBe('Sterile Zone Entry Breach');
  });

  it('6. GET /api/events/nonexistent-evt-999 should return 404', async () => {
    const res = await request(app).get('/api/events/nonexistent-evt-999');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('7. GET /api/rules should return configured declarative rules', async () => {
    const res = await request(app).get('/api/rules');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(5);

    const resCam1 = await request(app).get('/api/rules?cameraId=CAM-01');
    expect(resCam1.status).toBe(200);
    for (const r of resCam1.body.data) {
      expect(r.cameraId).toBe('CAM-01');
    }
  });

  it('8. GET /api/rules/zones and GET /api/rules/lines should return virtual zones and tripwires', async () => {
    const resZones = await request(app).get('/api/rules/zones');
    expect(resZones.status).toBe(200);
    expect(resZones.body.success).toBe(true);
    expect(Array.isArray(resZones.body.data)).toBe(true);
    expect(resZones.body.data.length).toBeGreaterThanOrEqual(3);

    const resLines = await request(app).get('/api/rules/lines');
    expect(resLines.status).toBe(200);
    expect(resLines.body.success).toBe(true);
    expect(Array.isArray(resLines.body.data)).toBe(true);
    expect(resLines.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('9. POST /api/rules/toggle should reject invalid requests without ruleId', async () => {
    const res = await request(app).post('/api/rules/toggle').send({ enabled: true });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
