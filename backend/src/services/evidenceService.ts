import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  AuditLog,
  Event,
  Evidence,
  EvidenceManifest,
  Incident,
  IncidentEvidenceState,
} from '@ibvap/shared';
import { config } from '../config/index.js';
import { evidenceRepository } from '../repositories/evidenceRepository.js';
import { incidentRepository } from '../repositories/incidentRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { cameraRepository } from '../repositories/cameraRepository.js';
import { eventRepository } from '../repositories/eventRepository.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class EvidenceService {
  private activeJobsCount = 0;
  private jobQueue: Array<() => Promise<void>> = [];

  /**
   * Resolves the local source video file path for a camera ID safely
   */
  public resolveSourceVideoPath(cameraId: string): string | null {
    const rootDir = path.resolve(__dirname, '../../../');
    const candidates = [
      path.resolve(config.storage.videosPath, cameraId.toLowerCase(), 'gate.mp4'),
      path.resolve(config.storage.videosPath, cameraId.toLowerCase(), 'corridor.mp4'),
      path.resolve(config.storage.videosPath, cameraId.toLowerCase(), 'restricted.mp4'),
      path.resolve(config.storage.videosPath, cameraId.toLowerCase(), 'vehicle.mp4'),
      path.resolve(config.storage.videosPath, cameraId.toLowerCase(), 'vehicles.mp4'),
      path.resolve(config.storage.videosPath, cameraId.toLowerCase(), 'perimeter.mp4'),
      path.resolve(config.storage.videosPath, cameraId.toLowerCase(), 'night.mp4'),
      path.resolve(config.storage.videosPath, cameraId.toUpperCase(), 'gate.mp4'),
      path.resolve(config.storage.videosPath, cameraId.toUpperCase(), 'corridor.mp4'),
      path.resolve(config.storage.videosPath, cameraId.toUpperCase(), 'restricted.mp4'),
      path.resolve(config.storage.videosPath, cameraId.toUpperCase(), 'vehicle.mp4'),
      path.resolve(config.storage.videosPath, cameraId.toUpperCase(), 'vehicles.mp4'),
      path.resolve(config.storage.videosPath, cameraId.toUpperCase(), 'perimeter.mp4'),
      path.resolve(config.storage.videosPath, cameraId.toUpperCase(), 'night.mp4'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    // Check directory for any .mp4
    const dirCandidates = [
      path.resolve(config.storage.videosPath, cameraId.toLowerCase()),
      path.resolve(config.storage.videosPath, cameraId.toUpperCase()),
      path.resolve(config.storage.videosPath, cameraId.replace('-', '')),
    ];

    for (const d of dirCandidates) {
      if (fs.existsSync(d)) {
        const files = fs.readdirSync(d);
        const mp4 = files.find((f) => f.endsWith('.mp4'));
        if (mp4) return path.join(d, mp4);
      }
    }

    return null;
  }

  /**
   * Enqueues evidence extraction with bounded concurrency
   */
  public async queueEvidenceExtraction(incident: Incident, event?: Event): Promise<void> {
    const task = async () => {
      await this.extractEvidence(incident, event);
    };

    if (this.activeJobsCount < config.evidence.maxConcurrency) {
      this.activeJobsCount++;
      task().finally(() => {
        this.activeJobsCount--;
        this.processNextInQueue();
      });
    } else {
      this.jobQueue.push(task);
    }
  }

  private processNextInQueue(): void {
    if (this.jobQueue.length > 0 && this.activeJobsCount < config.evidence.maxConcurrency) {
      const nextTask = this.jobQueue.shift();
      if (nextTask) {
        this.activeJobsCount++;
        nextTask().finally(() => {
          this.activeJobsCount--;
          this.processNextInQueue();
        });
      }
    }
  }

  /**
   * Performs temporal clip extraction and snapshot capture via Python worker
   */
  public async extractEvidence(incident: Incident, event?: Event): Promise<Evidence> {
    const evidenceId = `EVD-${incident.id}`;
    const outputDir = path.resolve(config.storage.evidencePath, incident.id);
    fs.mkdirSync(outputDir, { recursive: true });

    // Update status to PROCESSING
    await incidentRepository.updateEvidenceState(incident.id, 'PROCESSING', [evidenceId]);

    await auditRepository.create({
      id: `AUD-EVD-START-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actor: 'SYSTEM',
      action: 'EVIDENCE_STARTED',
      entity: incident.id,
      timestamp: new Date().toISOString(),
      metadata: { evidenceId, cameraId: incident.cameraId },
    });

    const sourcePath = this.resolveSourceVideoPath(incident.cameraId);
    if (!sourcePath) {
      logger.warn(`Source video for camera ${incident.cameraId} not found on disk. Marking evidence FAILED.`);

      const failedEvidence: Evidence = {
        id: evidenceId,
        incidentId: incident.id,
        cameraId: incident.cameraId,
        primaryEventId: incident.primaryEventId,
        linkedEventIds: incident.linkedEventIds,
        status: 'FAILED',
        errorMessage: 'SOURCE_VIDEO_UNAVAILABLE',
        timestamps: {
          startTime: incident.openedAt,
          preStartSeconds: 0,
          eventStartSeconds: 0,
          eventEndSeconds: 0,
          postEndSeconds: 0,
          snapshotTimestampSeconds: 0,
        },
        createdAt: new Date().toISOString(),
      };

      await evidenceRepository.create(failedEvidence);
      await incidentRepository.updateEvidenceState(incident.id, 'FAILED', [evidenceId]);

      await auditRepository.create({
        id: `AUD-EVD-FAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        actor: 'SYSTEM',
        action: 'EVIDENCE_FAILED',
        entity: incident.id,
        timestamp: new Date().toISOString(),
        metadata: { reason: 'SOURCE_VIDEO_UNAVAILABLE', cameraId: incident.cameraId },
      });

      return failedEvidence;
    }

    // Resolve event timestamp
    let eventTimestamp = 10.0;
    if (event && event.videoTimestamp !== undefined) {
      eventTimestamp = event.videoTimestamp;
    } else if (incident.primaryEventId) {
      try {
        const ev = await eventRepository.findById(incident.primaryEventId);
        if (ev && ev.videoTimestamp !== undefined) {
          eventTimestamp = ev.videoTimestamp;
        }
      } catch {}
    }

    const scriptPath = path.resolve(__dirname, '../../../ai/processing/evidence_extractor.py');
    const pythonExe = config.ai.pythonPath || 'python';

    const args = [
      scriptPath,
      '--source',
      sourcePath,
      '--output-dir',
      outputDir,
      '--incident-id',
      incident.id,
      '--camera-id',
      incident.cameraId,
      '--event-timestamp',
      eventTimestamp.toString(),
      '--primary-event-id',
      incident.primaryEventId || '',
      '--linked-event-ids',
      JSON.stringify(incident.linkedEventIds || []),
      '--pre-seconds',
      config.evidence.preSeconds.toString(),
      '--post-seconds',
      config.evidence.postSeconds.toString(),
      '--min-event-duration',
      config.evidence.minEventDurationSeconds.toString(),
    ];

    return new Promise((resolve) => {
      logger.info(`Extracting evidence for ${incident.id} from ${path.basename(sourcePath)} at ${eventTimestamp.toFixed(1)}s...`);
      const child = spawn(pythonExe, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));

      child.on('close', async (code) => {
        if (code !== 0) {
          logger.error(`Evidence extractor process failed with exit code ${code}: ${stderr}`);

          const failedEvidence: Evidence = {
            id: evidenceId,
            incidentId: incident.id,
            cameraId: incident.cameraId,
            primaryEventId: incident.primaryEventId,
            linkedEventIds: incident.linkedEventIds,
            status: 'FAILED',
            errorMessage: stderr || `EXTRACTOR_PROCESS_EXIT_${code}`,
            timestamps: {
              startTime: incident.openedAt,
              preStartSeconds: 0,
              eventStartSeconds: 0,
              eventEndSeconds: 0,
              postEndSeconds: 0,
              snapshotTimestampSeconds: 0,
            },
            createdAt: new Date().toISOString(),
          };

          await evidenceRepository.create(failedEvidence);
          await incidentRepository.updateEvidenceState(incident.id, 'FAILED', [evidenceId]);

          await auditRepository.create({
            id: `AUD-EVD-FAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            actor: 'SYSTEM',
            action: 'EVIDENCE_FAILED',
            entity: incident.id,
            timestamp: new Date().toISOString(),
            metadata: { error: stderr, code },
          });

          return resolve(failedEvidence);
        }

        try {
          const result = JSON.parse(stdout.trim());
          const now = new Date().toISOString();

          const evidence: Evidence = {
            id: evidenceId,
            incidentId: incident.id,
            cameraId: incident.cameraId,
            primaryEventId: incident.primaryEventId,
            linkedEventIds: incident.linkedEventIds,
            originalClip: `/api/cameras/${encodeURIComponent(incident.cameraId)}/video`,
            derivedClip: `/api/evidence/${encodeURIComponent(evidenceId)}/file/event.mp4`,
            preEventClip: `/api/evidence/${encodeURIComponent(evidenceId)}/file/pre-event.mp4`,
            eventClip: `/api/evidence/${encodeURIComponent(evidenceId)}/file/event.mp4`,
            postEventClip: `/api/evidence/${encodeURIComponent(evidenceId)}/file/post-event.mp4`,
            snapshot: `/api/evidence/${encodeURIComponent(evidenceId)}/file/snapshot.jpg`,
            manifestReference: `/api/evidence/${encodeURIComponent(evidenceId)}/manifest`,
            evidenceHash: result.hashes?.manifest || result.hashes?.event,
            hashes: result.hashes,
            status: 'READY',
            timestamps: {
              startTime: incident.openedAt,
              preStartSeconds: result.timestamps?.preStartSeconds || 0,
              eventStartSeconds: result.timestamps?.eventStartSeconds || 0,
              eventEndSeconds: result.timestamps?.eventEndSeconds || 0,
              postEndSeconds: result.timestamps?.postEndSeconds || 0,
              snapshotTimestampSeconds: result.timestamps?.snapshotTimestampSeconds || eventTimestamp,
            },
            manifest: result.manifest,
            createdAt: now,
            updatedAt: now,
          };

          const existing = await evidenceRepository.findById(evidenceId);
          if (existing) {
            await evidenceRepository.update(evidence);
          } else {
            await evidenceRepository.create(evidence);
          }

          await incidentRepository.updateEvidenceState(incident.id, 'READY', [evidenceId]);

          await auditRepository.create({
            id: `AUD-EVD-READY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            actor: 'SYSTEM',
            action: 'EVIDENCE_READY',
            entity: incident.id,
            timestamp: now,
            metadata: {
              evidenceId,
              hashes: result.hashes,
              clips: ['pre-event.mp4', 'event.mp4', 'post-event.mp4', 'snapshot.jpg'],
            },
          });

          logger.info(`Evidence ${evidenceId} generated successfully for ${incident.id} (SHA-256: ${evidence.evidenceHash?.slice(0, 16)}...)`);
          resolve(evidence);
        } catch (parseErr) {
          logger.error(`Failed to parse evidence extractor JSON output: ${stdout}`, parseErr);
          resolve({
            id: evidenceId,
            incidentId: incident.id,
            cameraId: incident.cameraId,
            status: 'FAILED',
            errorMessage: 'OUTPUT_PARSE_ERROR',
            timestamps: {
              startTime: incident.openedAt,
              preStartSeconds: 0,
              eventStartSeconds: 0,
              eventEndSeconds: 0,
              postEndSeconds: 0,
              snapshotTimestampSeconds: 0,
            },
            createdAt: new Date().toISOString(),
          });
        }
      });
    });
  }

  /**
   * Retries evidence generation for an incident
   */
  public async retryEvidence(incidentId: string, actor = 'demo-operator'): Promise<Evidence> {
    const incident = await incidentRepository.findById(incidentId);
    if (!incident) {
      throw new NotFoundError(`Incident '${incidentId}' not found`);
    }

    await auditRepository.create({
      id: `AUD-EVD-RETRY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actor,
      action: 'EVIDENCE_RETRY',
      entity: incidentId,
      timestamp: new Date().toISOString(),
      metadata: { incidentId },
    });

    return this.extractEvidence(incident);
  }

  /**
   * Verifies hashes of all files in an evidence package against manifest
   */
  public async verifyIntegrity(evidenceId: string): Promise<{
    status: 'MATCH' | 'MISMATCH';
    evidenceId: string;
    incidentId: string;
    files: Record<string, { status: string; expected: string; actual?: string }>;
  }> {
    const evidence = await evidenceRepository.findById(evidenceId);
    if (!evidence) {
      throw new NotFoundError(`Evidence with ID '${evidenceId}' not found`);
    }

    const outputDir = path.resolve(config.storage.evidencePath, evidence.incidentId);
    const scriptPath = path.resolve(__dirname, '../../../ai/processing/evidence_extractor.py');
    const pythonExe = config.ai.pythonPath || 'python';

    return new Promise((resolve, reject) => {
      const args = [
        scriptPath,
        '--source',
        'dummy.mp4',
        '--output-dir',
        outputDir,
        '--incident-id',
        evidence.incidentId,
        '--camera-id',
        evidence.cameraId,
        '--event-timestamp',
        '0',
        '--verify',
      ];

      const child = spawn(pythonExe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));

      child.on('close', () => {
        try {
          const res = JSON.parse(stdout.trim());
          resolve(res);
        } catch {
          reject(new Error(`Failed to verify evidence integrity: ${stderr}`));
        }
      });
    });
  }

  /**
   * Securely resolves a derived media file path inside the evidence storage folder.
   * Strictly prevents path traversal attacks.
   */
  public getSecureFilePath(evidenceId: string, filename: string): { filePath: string; mimeType: string } {
    const incidentId = evidenceId.startsWith('EVD-') ? evidenceId.replace('EVD-', '') : evidenceId;
    const allowedFiles: Record<string, string> = {
      'pre-event.mp4': 'video/mp4',
      'event.mp4': 'video/mp4',
      'post-event.mp4': 'video/mp4',
      'snapshot.jpg': 'image/jpeg',
      'manifest.json': 'application/json',
    };

    if (!allowedFiles[filename]) {
      throw new ValidationError(`Access to file '${filename}' is not permitted.`);
    }

    // Sanitize incidentId against path traversal
    if (!/^[A-Za-z0-9_-]+$/.test(incidentId)) {
      throw new ValidationError('Invalid incident identifier format');
    }

    const evidenceDir = path.resolve(config.storage.evidencePath, incidentId);
    const targetPath = path.resolve(evidenceDir, filename);

    // Verify resolved path is strictly inside evidenceDir
    if (!targetPath.startsWith(evidenceDir)) {
      throw new ValidationError('Path traversal attempt detected.');
    }

    if (!fs.existsSync(targetPath)) {
      throw new NotFoundError(`Evidence file '${filename}' for incident '${incidentId}' not found on disk.`);
    }

    return { filePath: targetPath, mimeType: allowedFiles[filename] };
  }

  public async getEvidenceList(limit?: number): Promise<Evidence[]> {
    return evidenceRepository.findAll(limit);
  }

  public async getEvidenceById(id: string): Promise<Evidence> {
    const evidence = await evidenceRepository.findById(id);
    if (!evidence) {
      throw new NotFoundError(`Evidence with ID '${id}' not found`);
    }
    return evidence;
  }

  public async getEvidenceByIncidentId(incidentId: string): Promise<Evidence | undefined> {
    return evidenceRepository.findByIncidentId(incidentId);
  }

  public async getEvidenceByCamera(cameraId: string, limit?: number): Promise<Evidence[]> {
    return evidenceRepository.findByCameraId(cameraId, limit);
  }

  public async registerEvidence(evidence: Evidence): Promise<Evidence> {
    return evidenceRepository.create(evidence);
  }
}

export const evidenceService = new EvidenceService();
