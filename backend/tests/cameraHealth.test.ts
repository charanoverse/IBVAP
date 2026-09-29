import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/repositories/database.js';
import { cameraHealthService } from '../src/health/CameraHealthService.js';
import { coverageService } from '../src/coverage/CoverageService.js';

describe('Phase 8: Camera Health, Visibility Assessment & Blind-Spot Intelligence', () => {
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
              ('CAM-05', 'East Perimeter Fence', '/api/cameras/CAM-05/video', 'active', datetime('now'), datetime('now')),
              ('CAM-06', 'West Yard Night Sensor', '/api/cameras/CAM-06/video', 'active', datetime('now'), datetime('now'))`
    );

    // Ensure all cameras are restored from simulations
    for (const id of ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'CAM-05', 'CAM-06']) {
      await cameraHealthService.restoreCamera(id);
    }
  });

  describe('1. Baseline Health & Visibility Assessment', () => {
    it('evaluates nominal daytime camera CAM-01 as HEALTHY with GOOD visibility', async () => {
      const health = await cameraHealthService.getCameraHealth('CAM-01');

      expect(health.cameraId).toBe('CAM-01');
      expect(health.streamStatus).toBe('AVAILABLE');
      expect(health.healthState).toBe('HEALTHY');
      expect(health.visibilityState).toBe('GOOD');
      expect(health.isOnline).toBe(true);
      expect(health.effectiveFps).toBeGreaterThanOrEqual(20);
      expect(health.metrics).toBeDefined();
      expect(health.metrics?.brightness).toBeGreaterThanOrEqual(100);
      expect(health.metrics?.contrast).toBeGreaterThanOrEqual(30);
      expect(health.metrics?.blurScore).toBeGreaterThanOrEqual(100);
      expect(health.frozenFrameDetected).toBe(false);
      expect(health.isSimulated).toBe(false);
      expect(health.reasons && health.reasons.length).toBeGreaterThan(0);
    });

    it('evaluates night camera CAM-06 using calibrated night profile without false degradation', async () => {
      const health = await cameraHealthService.getCameraHealth('CAM-06');

      expect(health.cameraId).toBe('CAM-06');
      expect(health.healthState).toBe('HEALTHY');
      expect(health.visibilityState).toBe('GOOD');
      // Night camera naturally has lower brightness (~42.8) and lower blur (~91.7)
      expect(health.metrics?.brightness).toBeLessThan(60);
      expect(health.metrics?.brightness).toBeGreaterThan(20);
      expect(health.metrics?.blurScore).toBeLessThan(120);
    });

    it('evaluates sterile zone CAM-03 with calibrated focal blur baseline', async () => {
      const health = await cameraHealthService.getCameraHealth('CAM-03');

      expect(health.cameraId).toBe('CAM-03');
      expect(health.healthState).toBe('HEALTHY');
      expect(health.visibilityState).toBe('GOOD');
      expect(health.metrics?.blurScore).toBeGreaterThanOrEqual(75);
    });
  });

  describe('2. Development / Demo Simulation Controls', () => {
    it('simulates OFFLINE degradation with [SIMULATION] tagging', async () => {
      const simulated = await cameraHealthService.simulateDegradation(
        'CAM-01',
        'OFFLINE',
        'Testing signal drop simulation'
      );

      expect(simulated.isSimulated).toBe(true);
      expect(simulated.streamStatus).toBe('UNAVAILABLE');
      expect(simulated.healthState).toBe('OFFLINE');
      expect(simulated.visibilityState).toBe('UNKNOWN');
      expect(simulated.simulatedReason).toContain('Testing signal drop simulation');

      // Restoration
      const restored = await cameraHealthService.restoreCamera('CAM-01');
      expect(restored.isSimulated).toBe(false);
      expect(restored.healthState).toBe('HEALTHY');
      expect(restored.streamStatus).toBe('AVAILABLE');
    });

    it('simulates FROZEN frame and marks frozenFrameDetected and DEGRADED', async () => {
      const simulated = await cameraHealthService.simulateDegradation('CAM-02', 'FREEZE');

      expect(simulated.isSimulated).toBe(true);
      expect(simulated.frozenFrameDetected).toBe(true);
      expect(simulated.streamStatus).toBe('STALLED');
      expect(simulated.healthState).toBe('DEGRADED');

      await cameraHealthService.restoreCamera('CAM-02');
    });

    it('simulates optical BLUR and marks visibility POOR and health DEGRADED', async () => {
      const simulated = await cameraHealthService.simulateDegradation('CAM-03', 'BLUR');

      expect(simulated.isSimulated).toBe(true);
      expect(simulated.visibilityState).toBe('POOR');
      expect(simulated.healthState).toBe('DEGRADED');
      expect(simulated.metrics?.blurScore).toBeLessThan(30);

      await cameraHealthService.restoreCamera('CAM-03');
    });

    it('simulates LOW_LIGHT and GLARE states correctly', async () => {
      const dark = await cameraHealthService.simulateDegradation('CAM-04', 'LOW_LIGHT');
      expect(dark.visibilityState).toBe('DEGRADED');
      expect(dark.metrics?.brightness).toBeLessThan(15);

      const glare = await cameraHealthService.simulateDegradation('CAM-04', 'GLARE');
      expect(glare.visibilityState).toBe('POOR');
      expect(glare.metrics?.brightness).toBeGreaterThan(250);

      await cameraHealthService.restoreCamera('CAM-04');
    });

    it('records health transitions in the database audit log', async () => {
      await cameraHealthService.simulateDegradation('CAM-05', 'OFFLINE');
      const transitions = await cameraHealthService.getHealthTransitions('CAM-05', 5);

      expect(transitions.length).toBeGreaterThan(0);
      expect(transitions[0].camera_id).toBe('CAM-05');
      expect(transitions[0].new_state).toBe('OFFLINE');
      expect(transitions[0].is_simulated).toBe(1);

      await cameraHealthService.restoreCamera('CAM-05');
    });
  });

  describe('3. Declarative Coverage & Blind-Spot Gap Intelligence', () => {
    it('evaluates zone coverage as HEALTHY when primary camera is nominal', async () => {
      const zoneCoverage = await coverageService.getZoneCoverage('ZONE-CAM03-RESTRICTED');

      expect(zoneCoverage).toBeDefined();
      expect(zoneCoverage?.zoneId).toBe('ZONE-CAM03-RESTRICTED');
      expect(zoneCoverage?.coverageState).toBe('HEALTHY');
      expect(zoneCoverage?.primaryCameras).toContain('CAM-03');
      expect(zoneCoverage?.supportingCameras).toContain('CAM-04');
      expect(zoneCoverage?.supportingCameras).toContain('CAM-05');
      expect(zoneCoverage?.activePrimaryCount).toBe(1);
    });

    it('transitions zone to DEGRADED and produces ranked recommendations when primary is degraded', async () => {
      // Degrade primary camera CAM-03
      await cameraHealthService.simulateDegradation('CAM-03', 'BLUR');

      const zoneCoverage = await coverageService.getZoneCoverage('ZONE-CAM03-RESTRICTED');
      expect(zoneCoverage?.coverageState).toBe('DEGRADED');
      expect(zoneCoverage?.recommendations.length).toBeGreaterThan(0);

      const recs = await coverageService.getAlternativeRecommendations('CAM-03', 'ZONE-CAM03-RESTRICTED');
      expect(recs.length).toBeGreaterThanOrEqual(2);

      // CAM-04 (0.85 quality) should rank higher than CAM-05 (0.75 quality)
      const firstRec = recs[0];
      expect(firstRec.recommendedCameraId).toBe('CAM-04');
      expect(firstRec.status).toBe('AVAILABLE');
      expect(firstRec.factors.sameZoneCoverage).toBe(true);
      expect(firstRec.factors.configuredCoverageQuality).toBe(0.85);
      expect(firstRec.reason).toContain('covers');

      // Verify second recommendation
      const secondRec = recs[1];
      expect(secondRec.recommendedCameraId).toBe('CAM-05');
      expect(secondRec.factors.configuredCoverageQuality).toBe(0.75);

      await cameraHealthService.restoreCamera('CAM-03');
    });

    it('detects BLIND_SPOT_RISK when both primary and supporting cameras are unavailable', async () => {
      // Degrade CAM-03, CAM-04, and CAM-05 in ZONE-CAM03-RESTRICTED
      await cameraHealthService.simulateDegradation('CAM-03', 'OFFLINE');
      await cameraHealthService.simulateDegradation('CAM-04', 'OFFLINE');
      await cameraHealthService.simulateDegradation('CAM-05', 'OFFLINE');

      const zoneCoverage = await coverageService.getZoneCoverage('ZONE-CAM03-RESTRICTED');
      expect(zoneCoverage?.coverageState).toBe('BLIND_SPOT_RISK');
      expect(zoneCoverage?.activePrimaryCount).toBe(0);
      expect(zoneCoverage?.usableAlternativeCount).toBe(0);

      // Clean up
      await cameraHealthService.restoreCamera('CAM-03');
      await cameraHealthService.restoreCamera('CAM-04');
      await cameraHealthService.restoreCamera('CAM-05');
    });
  });

  describe('4. Strict Boundary & Non-Biometric Safety Guarantee', () => {
    it('ensures recommendations NEVER include person IDs, biometric data, or ReID attributes', async () => {
      await cameraHealthService.simulateDegradation('CAM-01', 'OFFLINE');

      const recs = await coverageService.getAlternativeRecommendations('CAM-01');
      expect(recs.length).toBeGreaterThan(0);

      for (const rec of recs) {
        const rawJson = JSON.stringify(rec);
        // Strict boundary assertions: no ReID, no person continuity, no biometric matches
        expect((rec as any).personId).toBeUndefined();
        expect((rec as any).reidVector).toBeUndefined();
        expect((rec as any).faceEmbedding).toBeUndefined();
        expect((rec as any).globalTrackId).toBeUndefined();
        expect(rawJson).not.toContain('person_id');
        expect(rawJson).not.toContain('reid_features');
        expect(rawJson).not.toContain('same_person');
        expect(rec.reason).toContain('Coverage-based view recommendation; does not imply biometric identity continuity');
      }

      await cameraHealthService.restoreCamera('CAM-01');
    });
  });

  describe('5. REST API Endpoints', () => {
    it('GET /api/cameras/health returns health status of all cameras', async () => {
      const res = await request(app).get('/api/cameras/health').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data['CAM-01']).toBeDefined();
      expect(res.body.data['CAM-01'].healthState).toBe('HEALTHY');
      expect(res.body.data['CAM-06'].healthState).toBe('HEALTHY');
    });

    it('GET /api/cameras/:id/health returns telemetry and recent transitions', async () => {
      const res = await request(app).get('/api/cameras/CAM-02/health').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.cameraId).toBe('CAM-02');
      expect(res.body.data.metrics).toBeDefined();
      expect(res.body.data.recentTransitions).toBeDefined();
    });

    it('POST /api/cameras/:id/simulate-degradation and POST /api/cameras/:id/restore', async () => {
      // Simulate
      const simRes = await request(app)
        .post('/api/cameras/CAM-03/simulate-degradation')
        .send({ type: 'FREEZE', reason: 'Operator freeze test' })
        .expect(200);

      expect(simRes.body.success).toBe(true);
      expect(simRes.body.data.frozenFrameDetected).toBe(true);
      expect(simRes.body.data.isSimulated).toBe(true);

      // Restore
      const resRes = await request(app)
        .post('/api/cameras/CAM-03/restore')
        .send({})
        .expect(200);

      expect(resRes.body.success).toBe(true);
      expect(resRes.body.data.isSimulated).toBe(false);
      expect(resRes.body.data.frozenFrameDetected).toBe(false);
    });

    it('GET /api/coverage/health returns overall zone coverage list', async () => {
      const res = await request(app).get('/api/coverage/health').expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(6);
    });

    it('GET /api/coverage/zones/:zoneId returns single zone status', async () => {
      const res = await request(app).get('/api/coverage/zones/ZONE-CAM01-GATEWAY').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.zoneId).toBe('ZONE-CAM01-GATEWAY');
      expect(res.body.data.primaryCameras).toContain('CAM-01');
    });

    it('GET /api/coverage/alternatives/:cameraId returns alternative view recommendations', async () => {
      await cameraHealthService.simulateDegradation('CAM-03', 'BLUR');

      const res = await request(app).get('/api/coverage/alternatives/CAM-03').expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].recommendedCameraId).toBe('CAM-04');

      await cameraHealthService.restoreCamera('CAM-03');
    });
  });
});
