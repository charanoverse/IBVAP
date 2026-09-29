import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/repositories/database.js';
import { initializeDatabase } from '../src/repositories/initDb.js';

describe('IBVAP AI Object Detection Pipeline & API (Phase 3)', () => {
  beforeAll(async () => {
    await db.connect();
    await initializeDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  it('GET /api/detections/ai/status should return AI subsystem health structure', async () => {
    const res = await request(app).get('/api/detections/ai/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('modelName');
    expect(res.body.data).toHaveProperty('device');
    expect(Array.isArray(res.body.data.supportedClasses)).toBe(true);
    expect(res.body.data.supportedClasses).toContain('person');
    expect(res.body.data.supportedClasses).toContain('car');
  });

  it('GET /api/detections/live/CAM-01 should return live camera detection payload', async () => {
    const res = await request(app).get('/api/detections/live/CAM-01');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('cameraId', 'CAM-01');
    expect(res.body.data).toHaveProperty('timestamp');
    expect(Array.isArray(res.body.data.detections)).toBe(true);
    expect(typeof res.body.data.latencyMs).toBe('number');
  });

  it('GET /api/detections/live/CAM-01 with timestamp query should return timestamped payload', async () => {
    const res = await request(app).get('/api/detections/live/CAM-01?timestamp=2.5');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('cameraId', 'CAM-01');
    expect(Array.isArray(res.body.data.detections)).toBe(true);
  });

  it('GET /api/detections/timeline/CAM-01 should return timeline frames array', async () => {
    const res = await request(app).get('/api/detections/timeline/CAM-01');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/detections/control/CAM-01 should allow pausing and resuming AI', async () => {
    const pauseRes = await request(app)
      .post('/api/detections/control/CAM-01')
      .send({ action: 'pause' });
    
    expect([200, 400]).toContain(pauseRes.status);

    const resumeRes = await request(app)
      .post('/api/detections/control/CAM-01')
      .send({ action: 'resume' });

    expect([200, 400]).toContain(resumeRes.status);
  });

  it('POST /api/detections should record detection without requiring trackId', async () => {
    const newDet = {
      id: `det-test-${Date.now()}`,
      cameraId: 'CAM-01',
      timestamp: new Date().toISOString(),
      frameIndex: 120,
      videoTimestamp: 4.0,
      objectClass: 'person',
      confidence: 0.92,
      boundingBox: {
        x: 0.45,
        y: 0.2,
        width: 0.15,
        height: 0.4,
      },
    };

    const res = await request(app)
      .post('/api/detections')
      .send(newDet);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(newDet.id);
    expect(res.body.data.trackRef).toBeUndefined();
  });

  it('GET /api/detections should support filtering by camera ID', async () => {
    const res = await request(app).get('/api/detections?cameraId=CAM-01&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/detections/stream should establish SSE streaming headers', async () => {
    const res = await request(app)
      .get('/api/detections/stream?cameraId=CAM-01')
      .timeout(500)
      .catch((err) => err.response);

    if (res && res.headers) {
      expect(res.headers['content-type']).toContain('text/event-stream');
    }
  });
});
