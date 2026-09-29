import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/repositories/database.js';
import { initializeDatabase } from '../src/repositories/initDb.js';

describe('IBVAP CCTV Video Streaming & Replay Pipeline (Phase 2)', () => {
  beforeAll(async () => {
    await db.connect();
    await initializeDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  it('GET /api/cameras/video/manifest should list available camera video streams', async () => {
    const res = await request(app).get('/api/cameras/video/manifest');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(6);

    const cam1Meta = res.body.data.find((c: any) => c.cameraId === 'CAM-01');
    expect(cam1Meta).toBeDefined();
    expect(cam1Meta.status).toBe('ready');
    expect(cam1Meta.mimeType).toBe('video/mp4');
  });

  it('GET /api/cameras/CAM-01/video/metadata should return valid video metadata', async () => {
    const res = await request(app).get('/api/cameras/CAM-01/video/metadata');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('cameraId', 'CAM-01');
    expect(res.body.data).toHaveProperty('sourceType', 'file');
    expect(res.body.data).toHaveProperty('mimeType', 'video/mp4');
    expect(res.body.data.fileSizeBytes).toBeGreaterThan(0);
    expect(res.body.data.status).toBe('ready');
  });

  it('GET /api/cameras/CAM-01/video should return 200 OK with full MP4 stream', async () => {
    const res = await request(app).get('/api/cameras/CAM-01/video');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('video/mp4');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(parseInt(res.headers['content-length'], 10)).toBeGreaterThan(0);
  });

  it('GET /api/cameras/CAM-01/video with Range header should return 206 Partial Content', async () => {
    const res = await request(app)
      .get('/api/cameras/CAM-01/video')
      .set('Range', 'bytes=0-1023');

    expect(res.status).toBe(206);
    expect(res.headers['content-type']).toBe('video/mp4');
    expect(res.headers['content-range']).toMatch(/^bytes 0-1023\/\d+$/);
    expect(res.headers['content-length']).toBe('1024');
    expect(res.headers['accept-ranges']).toBe('bytes');
  });

  it('GET /api/cameras/CAM-01/video with open-ended Range header should return 206', async () => {
    const res = await request(app)
      .get('/api/cameras/CAM-01/video')
      .set('Range', 'bytes=5000-');

    expect(res.status).toBe(206);
    expect(res.headers['content-type']).toBe('video/mp4');
    expect(res.headers['content-range']).toMatch(/^bytes 5000-\d+\/\d+$/);
  });

  it('GET /api/cameras/CAM-UNKNOWN/video should return 404 Not Found', async () => {
    const res = await request(app).get('/api/cameras/CAM-NONEXISTENT-999/video');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/cameras/:id/video should block path traversal attacks', async () => {
    const res = await request(app).get('/api/cameras/..%2F..%2Fpackage.json/video');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CAMERA_ID');
  });

  it('All 6 camera feeds (CAM-01 through CAM-06) should return 200 or 206', async () => {
    const cameraIds = ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'CAM-05', 'CAM-06'];

    for (const id of cameraIds) {
      const res = await request(app)
        .get(`/api/cameras/${id}/video`)
        .set('Range', 'bytes=0-100');

      expect(res.status).toBe(206);
      expect(res.headers['content-type']).toBe('video/mp4');
    }
  });
});
