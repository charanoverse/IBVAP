import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('IBVAP Health Check API', () => {
  it('GET /api/health should return status: ok and service: ibvap-backend', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'ibvap-backend');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/nonexistent-route should return controlled 404 error envelope', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
    expect(res.body.error).toHaveProperty('message');
  });
});
