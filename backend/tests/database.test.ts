import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../src/repositories/database.js';
import { cameraRepository } from '../src/repositories/cameraRepository.js';
import { observationRepository } from '../src/repositories/observationRepository.js';
import { detectionRepository } from '../src/repositories/detectionRepository.js';
import { eventRepository } from '../src/repositories/eventRepository.js';
import { incidentRepository } from '../src/repositories/incidentRepository.js';
import { correlationRepository } from '../src/repositories/correlationRepository.js';
import { evidenceRepository } from '../src/repositories/evidenceRepository.js';
import { syncRepository } from '../src/repositories/syncRepository.js';
import { auditRepository } from '../src/repositories/auditRepository.js';
import fs from 'fs';
import path from 'path';

describe('IBVAP Database & Domain Models (Phase 0 Foundation)', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test_ibvap.sqlite');

  beforeAll(async () => {
    await db.connect();
    await db.initializeSchema();
    await db.clearAllTables();
  });

  afterAll(async () => {
    await db.close();
  });

  it('1. Camera Model: should create and retrieve a camera', async () => {
    const camera = await cameraRepository.create({
      id: 'TEST-CAM-01',
      name: 'Test Perimeter Camera',
      description: 'Test optical and thermal sensor',
      sourceReference: 'file://data/videos/test.mp4',
      status: 'active',
      capabilities: ['optical', 'thermal'],
      coverage: {
        sector: 'North',
        latitude: 32.0,
        longitude: -117.0,
        azimuth: 180,
        fovDegrees: 90,
      },
      health: {
        isOnline: true,
        fps: 30,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(camera.id).toBe('TEST-CAM-01');
    const retrieved = await cameraRepository.findById('TEST-CAM-01');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Test Perimeter Camera');
    expect(retrieved?.capabilities).toContain('thermal');
  });

  it('2. Observation Model: should record and retrieve an observation', async () => {
    const obs = await observationRepository.create({
      id: 'TEST-OBS-01',
      cameraId: 'TEST-CAM-01',
      timestamp: new Date().toISOString(),
      objectClass: 'vehicle',
      localTrackRef: 'TRK-VEH-100',
      metadata: { estimatedSpeedKph: 45 },
      createdAt: new Date().toISOString(),
    });

    expect(obs.id).toBe('TEST-OBS-01');
    const retrieved = await observationRepository.findById('TEST-OBS-01');
    expect(retrieved?.objectClass).toBe('vehicle');
    expect(retrieved?.metadata?.estimatedSpeedKph).toBe(45);
  });

  it('3. Detection Model: should record and retrieve a detection', async () => {
    const detection = await detectionRepository.create({
      id: 'TEST-DET-01',
      cameraId: 'TEST-CAM-01',
      timestamp: new Date().toISOString(),
      objectClass: 'person',
      confidence: 0.94,
      boundingBox: { x: 0.2, y: 0.3, width: 0.1, height: 0.25 },
      trackRef: 'TRK-PER-200',
      createdAt: new Date().toISOString(),
    });

    expect(detection.id).toBe('TEST-DET-01');
    const retrieved = await detectionRepository.findById('TEST-DET-01');
    expect(retrieved?.confidence).toBe(0.94);
    expect(retrieved?.boundingBox.width).toBe(0.1);
  });

  it('4. Event Model: should record an event and update verification state', async () => {
    const event = await eventRepository.create({
      id: 'TEST-EVT-01',
      eventType: 'sterile_zone_breach',
      cameraId: 'TEST-CAM-01',
      timestamp: new Date().toISOString(),
      zoneId: 'ZONE-RESTRICTED-01',
      ruleRef: 'RULE-INTRUSION-01',
      verificationState: 'unverified',
      createdAt: new Date().toISOString(),
    });

    expect(event.id).toBe('TEST-EVT-01');
    const updated = await eventRepository.updateVerificationState('TEST-EVT-01', 'verified');
    expect(updated?.verificationState).toBe('verified');
  });

  it('5. Incident Model: should create and update review state', async () => {
    const incident = await incidentRepository.create({
      id: 'TEST-INC-01',
      priority: 'high',
      linkedEvents: ['TEST-EVT-01'],
      relatedObservations: ['TEST-OBS-01'],
      reviewState: 'open',
      evidence: [],
      recommendedViews: ['TEST-CAM-01'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(incident.id).toBe('TEST-INC-01');
    const updated = await incidentRepository.updateReviewState('TEST-INC-01', 'resolved', {
      operatorId: 'OP-42',
      action: 'Dispatched response unit',
      timestamp: new Date().toISOString(),
    });
    expect(updated?.reviewState?.toUpperCase()).toBe('RESOLVED');
    expect(updated?.operatorOutcome?.operatorId).toBe('OP-42');
  });

  it('6. Correlation Model: should record proposed correlation with reason (candidate state)', async () => {
    // Create second event for correlation
    await eventRepository.create({
      id: 'TEST-EVT-02',
      eventType: 'fence_approach',
      cameraId: 'TEST-CAM-01',
      timestamp: new Date().toISOString(),
      verificationState: 'unverified',
      createdAt: new Date().toISOString(),
    });

    const correlation = await correlationRepository.create({
      id: 'TEST-CORR-01',
      sourceEventId: 'TEST-EVT-01',
      targetEventId: 'TEST-EVT-02',
      state: 'candidate',
      reason: 'Spatial proximity and matching trajectory timeline',
      confidence: 0.88,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(correlation.id).toBe('TEST-CORR-01');
    expect(correlation.state).toBe('candidate');

    const updated = await correlationRepository.updateState('TEST-CORR-01', 'accepted');
    expect(updated?.state).toBe('accepted');
  });

  it('7. Evidence Model: should record and retrieve evidence metadata', async () => {
    const evidence = await evidenceRepository.create({
      id: 'TEST-EVD-01',
      originalClip: 'data/videos/demo.mp4',
      snapshot: 'data/snapshots/demo_01.jpg',
      timestamps: {
        startTime: '2026-09-26T12:00:00Z',
        endTime: '2026-09-26T12:00:15Z',
      },
      cameraId: 'TEST-CAM-01',
      evidenceHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      manifestReference: 'MANIFEST-20260926-01',
      createdAt: new Date().toISOString(),
    });

    expect(evidence.id).toBe('TEST-EVD-01');
    const retrieved = await evidenceRepository.findById('TEST-EVD-01');
    expect(retrieved?.cameraId).toBe('TEST-CAM-01');
    expect(retrieved?.timestamps.startTime).toBe('2026-09-26T12:00:00Z');
  });

  it('8. Sync Record Model: should track sync queue and retry state', async () => {
    const sync = await syncRepository.create({
      id: 'TEST-SYNC-01',
      entityType: 'Incident',
      entityId: 'TEST-INC-01',
      deliveryState: 'pending',
      retryCount: 0,
      acknowledgementState: 'unacknowledged',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(sync.id).toBe('TEST-SYNC-01');
    const updated = await syncRepository.updateDeliveryState('TEST-SYNC-01', 'acknowledged');
    expect(updated?.deliveryState).toBe('acknowledged');
  });

  it('9. Audit Log Model: should record operator and system actions', async () => {
    const log = await auditRepository.create({
      id: 'TEST-AUDIT-01',
      actor: 'OPERATOR_101',
      action: 'REVIEW_INCIDENT',
      entity: 'TEST-INC-01',
      timestamp: new Date().toISOString(),
      metadata: { outcome: 'ESCALATED' },
    });

    expect(log.id).toBe('TEST-AUDIT-01');
    const retrieved = await auditRepository.findById('TEST-AUDIT-01');
    expect(retrieved?.actor).toBe('OPERATOR_101');
    expect(retrieved?.action).toBe('REVIEW_INCIDENT');
  });
});
