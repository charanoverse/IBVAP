import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/repositories/database.js';

describe('IBVAP Backend API Endpoints (Phase 0 Foundation)', () => {
  beforeAll(async () => {
    await db.connect();
    await db.initializeSchema();
  });

  afterAll(async () => {
    await db.close();
  });

  it('GET /api/cameras should return list of cameras', async () => {
    const res = await request(app).get('/api/cameras');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/observations should return observations list', async () => {
    const res = await request(app).get('/api/observations');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/detections should return detections list', async () => {
    const res = await request(app).get('/api/detections');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/events should return events list', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/incidents should return incidents list', async () => {
    const res = await request(app).get('/api/incidents');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/correlations should return correlations list', async () => {
    const res = await request(app).get('/api/correlations');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/evidence should return evidence list', async () => {
    const res = await request(app).get('/api/evidence');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sync should return sync records list', async () => {
    const res = await request(app).get('/api/sync');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/audit should return audit logs list', async () => {
    const res = await request(app).get('/api/audit');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
