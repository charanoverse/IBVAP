import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/repositories/database.js';
import { initializeDatabase } from '../src/repositories/initDb.js';
import { Track } from '@ibvap/shared';

describe('IBVAP Multi-Object Tracking & Track Identity API (Phase 4)', () => {
  beforeAll(async () => {
    await db.connect();
    await initializeDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  const mockTrack: Track = {
    id: 'trk-cam-01-17',
    trackId: 17,
    displayId: 'T017',
    cameraId: 'CAM-01',
    classId: 0,
    className: 'person',
    confidence: 0.92,
    boundingBox: { x: 0.25, y: 0.35, width: 0.12, height: 0.28 },
    firstSeen: '2026-09-26T12:00:00Z',
    lastSeen: '2026-09-26T12:00:04Z',
    firstSeenTimestamp: 0.0,
    lastSeenTimestamp: 4.2,
    ageFrames: 21,
    ageSeconds: 4.2,
    missedFrames: 0,
    status: 'ACTIVE',
    trajectory: [
      { x: 0.25, y: 0.35, timestamp: 0.0 },
      { x: 0.27, y: 0.35, timestamp: 2.0 },
      { x: 0.31, y: 0.35, timestamp: 4.2 },
    ],
  };

  it('1. POST /api/tracks should ingest and persist track summary', async () => {
    const res = await request(app).post('/api/tracks').send(mockTrack);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('trk-cam-01-17');
    expect(res.body.data.trackId).toBe(17);
    expect(res.body.data.className).toBe('person');
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('2. GET /api/tracks should retrieve list of persisted track summaries', async () => {
    const res = await request(app).get('/api/tracks');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    const found = res.body.data.find((t: any) => t.id === 'trk-cam-01-17');
    expect(found).toBeDefined();
    expect(found.trackId).toBe(17);
  });

  it('3. GET /api/tracks?cameraId=CAM-01 should filter tracks by camera', async () => {
    const res = await request(app).get('/api/tracks?cameraId=CAM-01');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    res.body.data.forEach((t: any) => {
      expect(t.cameraId).toBe('CAM-01');
    });
  });

  it('4. GET /api/tracks/:id should retrieve single track by ID', async () => {
    const res = await request(app).get('/api/tracks/trk-cam-01-17');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('trk-cam-01-17');
    expect(res.body.data.confidence).toBe(0.92);
  });

  it('5. GET /api/tracks/nonexistent-trk-999 should return 404', async () => {
    const res = await request(app).get('/api/tracks/nonexistent-trk-999');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('6. GET /api/tracks/live/:cameraId should return live tracks array from AI engine', async () => {
    const res = await request(app).get('/api/tracks/live/CAM-01');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('7. GET /api/detections/ai/status should report ByteTrack tracker in telemetry', async () => {
    const res = await request(app).get('/api/detections/ai/status');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trackerName).toBe('ByteTrack');
  });

  it('8. POST /api/detections/control/CAM-01 should accept reset_tracker action', async () => {
    const res = await request(app)
      .post('/api/detections/control/CAM-01')
      .send({ action: 'reset_tracker' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
