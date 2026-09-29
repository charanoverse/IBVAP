import http from 'http';
import { Response } from 'express';
import {
  AISubsystemHealth,
  CameraAIDetectionPayload,
  CameraAIStatus,
  Detection,
  Event,
  Line,
  Rule,
  Track,
  Zone,
} from '@ibvap/shared';
import { config } from '../config/index.js';
import { detectionRepository } from '../repositories/detectionRepository.js';
import { trackRepository } from '../repositories/trackRepository.js';
import { eventRepository } from '../repositories/eventRepository.js';
import { incidentService } from './incidentService.js';
import { correlationService } from './correlationService.js';
import { logger } from '../utils/logger.js';

interface SSEClient {
  id: string;
  cameraId?: string;
  res: Response;
}

export class AIDetectionService {
  private sseClients: Map<string, SSEClient> = new Map();
  private pollerTimer: NodeJS.Timeout | null = null;
  private lastPersistenceTime: Map<string, number> = new Map();
  private cachedTelemetry: AISubsystemHealth = {
    status: 'offline',
    modelName: config.ai.model,
    trackerName: 'ByteTrack',
    device: config.ai.device.toUpperCase(),
    supportedClasses: config.ai.targetClasses,
    activeCamerasCount: 0,
    totalDetectionsProcessed: 0,
    totalTracksActive: 0,
    totalEventsVerified: 0,
    avgLatencyMs: 0.0,
    avgTrackerLatencyMs: 0.0,
    avgRuleLatencyMs: 0.0,
    cameras: {},
  };

  constructor() {
    // Hook incidentService broadcasts to SSE clients
    incidentService.registerSSEBroadcaster((eventType: string, data: any) => {
      this.broadcastEvent(eventType, data);
    });

    // Hook correlationService broadcasts to SSE clients (Phase 7)
    correlationService.registerSSEBroadcaster((eventType: string, data: any) => {
      this.broadcastEvent(eventType, data);
    });

    // Hook cameraHealthService broadcasts to SSE clients (Phase 8)
    import('../health/CameraHealthService.js').then(({ cameraHealthService }) => {
      cameraHealthService.registerBroadcaster((eventType: string, data: any) => {
        this.broadcastEvent(eventType, data);
      });
    });

    if (config.ai.enabled) {
      this.startBackgroundSync();
    }
  }

  public broadcastEvent(eventType: string, data: any, targetCameraId?: string): void {
    const msg = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.sseClients.values()) {
      if (!targetCameraId || !client.cameraId || client.cameraId === targetCameraId || client.cameraId === 'ALL') {
        try {
          client.res.write(msg);
        } catch {
          // Handled by close event
        }
      }
    }
  }

  private startBackgroundSync(): void {
    const intervalMs = Math.max(100, Math.floor(1000 / config.ai.inferenceFps));
    this.pollerTimer = setInterval(() => {
      this.syncLiveDetections();
    }, intervalMs);
  }

  public stop(): void {
    if (this.pollerTimer) {
      clearInterval(this.pollerTimer);
      this.pollerTimer = null;
    }
  }

  /**
   * Retrieves overall AI subsystem health, detection, ByteTrack, and Rule Engine telemetry
   */
  public async getAIHealth(): Promise<AISubsystemHealth> {
    try {
      const data = await this.fetchJson<AISubsystemHealth>(
        `http://127.0.0.1:${config.ai.servicePort}/health`
      );
      if (data) {
        this.cachedTelemetry = data;
        return data;
      }
    } catch {
      // Fallback
    }

    return {
      ...this.cachedTelemetry,
      status: 'offline',
    };
  }

  /**
   * Retrieves latest detections, tracks, and events payload for a single camera
   */
  public async getCameraDetections(
    cameraId: string,
    timestamp?: number
  ): Promise<CameraAIDetectionPayload | null> {
    try {
      const sanitizedId = encodeURIComponent(cameraId.toUpperCase());
      const query = timestamp !== undefined ? `?timestamp=${timestamp}` : '';
      const data = await this.fetchJson<CameraAIDetectionPayload>(
        `http://127.0.0.1:${config.ai.servicePort}/cameras/${sanitizedId}/detections${query}`
      );
      if (data) {
        return data;
      }
    } catch {
      // Fallback
    }

    return {
      cameraId,
      timestamp: new Date().toISOString(),
      frameIndex: 0,
      frameTimestamp: timestamp || 0,
      videoTimestamp: timestamp || 0,
      latencyMs: 0,
      trackerLatencyMs: 0,
      ruleLatencyMs: 0,
      pipelineLatencyMs: 0,
      detections: [],
      tracks: [],
      events: [],
      candidateEvents: [],
      activeTracksCount: 0,
      cameraStatus: 'disabled',
    };
  }

  /**
   * Retrieves live active tracks for a camera
   */
  public async getCameraTracks(cameraId: string): Promise<Track[]> {
    try {
      const sanitizedId = encodeURIComponent(cameraId.toUpperCase());
      const data = await this.fetchJson<Track[]>(
        `http://127.0.0.1:${config.ai.servicePort}/cameras/${sanitizedId}/tracks`
      );
      return data || [];
    } catch {
      return [];
    }
  }

  /**
   * Retrieves live verified events for a camera from the AI worker
   */
  public async getCameraEvents(cameraId: string): Promise<Event[]> {
    try {
      const sanitizedId = encodeURIComponent(cameraId.toUpperCase());
      const data = await this.fetchJson<Event[]>(
        `http://127.0.0.1:${config.ai.servicePort}/cameras/${sanitizedId}/events`
      );
      return data || [];
    } catch {
      return [];
    }
  }

  /**
   * Retrieves rules configured for a camera
   */
  public async getCameraRules(cameraId: string): Promise<Rule[]> {
    try {
      const sanitizedId = encodeURIComponent(cameraId.toUpperCase());
      const data = await this.fetchJson<Rule[]>(
        `http://127.0.0.1:${config.ai.servicePort}/cameras/${sanitizedId}/rules`
      );
      return data || [];
    } catch {
      return [];
    }
  }

  /**
   * Retrieves all configured rules
   */
  public async getAllRules(): Promise<Rule[]> {
    try {
      const data = await this.fetchJson<Rule[]>(
        `http://127.0.0.1:${config.ai.servicePort}/rules`
      );
      return data || [];
    } catch {
      return [];
    }
  }

  /**
   * Retrieves all configured virtual zones
   */
  public async getAllZones(): Promise<Zone[]> {
    try {
      const data = await this.fetchJson<Zone[]>(
        `http://127.0.0.1:${config.ai.servicePort}/zones`
      );
      return data || [];
    } catch {
      return [];
    }
  }

  /**
   * Retrieves all configured virtual lines
   */
  public async getAllLines(): Promise<Line[]> {
    try {
      const data = await this.fetchJson<Line[]>(
        `http://127.0.0.1:${config.ai.servicePort}/lines`
      );
      return data || [];
    } catch {
      return [];
    }
  }

  /**
   * Enables or disables a rule at runtime
   */
  public async toggleRule(ruleId: string, enabled: boolean): Promise<boolean> {
    try {
      const res = await this.postJson<{ success: boolean }>(
        `http://127.0.0.1:${config.ai.servicePort}/rules/toggle`,
        { ruleId, enabled }
      );
      return res?.success || false;
    } catch (err) {
      logger.warn(`Failed to toggle rule ${ruleId}:`, err);
      return false;
    }
  }

  /**
   * Retrieves timeline frames for a camera
   */
  public async getCameraTimeline(
    cameraId: string
  ): Promise<CameraAIDetectionPayload[] | null> {
    try {
      const sanitizedId = encodeURIComponent(cameraId.toUpperCase());
      const data = await this.fetchJson<CameraAIDetectionPayload[]>(
        `http://127.0.0.1:${config.ai.servicePort}/cameras/${sanitizedId}/timeline`
      );
      return data || [];
    } catch {
      return [];
    }
  }

  /**
   * Sends pause/resume/restart/reset_tracker/reset_rules control commands to the AI pipeline for a camera
   */
  public async controlCameraAI(cameraId: string, action: string): Promise<boolean> {
    try {
      const sanitizedId = encodeURIComponent(cameraId.toUpperCase());
      const res = await this.postJson<{ success: boolean }>(
        `http://127.0.0.1:${config.ai.servicePort}/cameras/${sanitizedId}/control`,
        { action }
      );
      return res?.success || false;
    } catch (err) {
      logger.warn(`Failed to send AI control action "${action}" for ${cameraId}:`, err);
      return false;
    }
  }

  /**
   * Registers a client for Server-Sent Events (SSE) live detection & tracking streaming
   */
  public registerSSEClient(clientId: string, res: Response, cameraId?: string): void {
    this.sseClients.set(clientId, { id: clientId, cameraId, res });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial handshake
    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', cameraId: cameraId || 'ALL' })}\n\n`);

    res.on('close', () => {
      this.sseClients.delete(clientId);
    });
  }

  /**
   * Periodically syncs live detections & tracks from Python AI service, broadcasts via SSE, and handles persistence
   */
  private async syncLiveDetections(): Promise<void> {
    if (this.sseClients.size === 0 && !config.ai.persistenceEnabled) {
      return;
    }

    try {
      const allDetections = await this.fetchJson<Record<string, CameraAIDetectionPayload>>(
        `http://127.0.0.1:${config.ai.servicePort}/cameras/all/detections`
      );

      if (!allDetections) return;

      const now = Date.now();

      for (const [camId, payload] of Object.entries(allDetections)) {
        if (!payload || !payload.detections) continue;

        // 1. Broadcast to SSE clients
        const message = `event: detection\ndata: ${JSON.stringify(payload)}\n\n`;
        for (const client of this.sseClients.values()) {
          if (!client.cameraId || client.cameraId === camId || client.cameraId === 'ALL') {
            try {
              client.res.write(message);
            } catch {
              // Handled by close event
            }
          }
        }

        // 2. Broadcast Verified Events over SSE, persist immediately, and route to Incident Pipeline (Phase 6)
        if (payload.events && payload.events.length > 0) {
          for (const ev of payload.events) {
            try {
              await eventRepository.upsert(ev);
              const eventMsg = `event: security_event\ndata: ${JSON.stringify(ev)}\n\n`;
              for (const client of this.sseClients.values()) {
                if (!client.cameraId || client.cameraId === camId || client.cameraId === 'ALL') {
                  try {
                    client.res.write(eventMsg);
                  } catch {
                    // Handled by close event
                  }
                }
              }

              // Route verified event to Phase 6 Incident Policy & Aggregator Pipeline
              await incidentService.processVerifiedEvent(ev);

              // Route verified event to Phase 7 Cross-Camera Event Correlation Engine
              await correlationService.evaluateEvent(ev);
            } catch (evErr) {
              logger.warn(`Failed to persist or process verified event for ${camId}:`, evErr);
            }
          }
        }

        // 3. Periodic Database Persistence (detections and track summaries)
        if (config.ai.persistenceEnabled) {
          const lastPersist = this.lastPersistenceTime.get(camId) || 0;
          const intervalMs = config.ai.persistenceIntervalSeconds * 1000;

          if (now - lastPersist >= intervalMs) {
            this.lastPersistenceTime.set(camId, now);

            if (payload.detections.length > 0) {
              for (const det of payload.detections) {
                try {
                  await detectionRepository.create(det);
                } catch (dbErr) {
                  logger.warn(`Failed to persist detection for ${camId}:`, dbErr);
                }
              }
            }

            if (payload.tracks && payload.tracks.length > 0) {
              for (const trk of payload.tracks) {
                try {
                  await trackRepository.upsert(trk);
                } catch (dbErr) {
                  logger.warn(`Failed to persist track summary for ${camId}:`, dbErr);
                }
              }
            }
          }
        }
      }
    } catch {
      // AI service might be restarting or offline
    }
  }

  private fetchJson<T>(url: string): Promise<T | null> {
    return new Promise((resolve) => {
      const req = http.get(url, (res) => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }

        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            resolve((parsed.data || parsed) as T);
          } catch {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.setTimeout(800, () => {
        req.destroy();
        resolve(null);
      });
      req.end();
    });
  }

  private postJson<T>(url: string, body: Record<string, unknown>): Promise<T | null> {
    return new Promise((resolve) => {
      const dataStr = JSON.stringify(body);
      const parsedUrl = new URL(url);

      const req = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(dataStr),
          },
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(raw);
              resolve(parsed as T);
            } catch {
              resolve(null);
            }
          });
        }
      );

      req.on('error', () => resolve(null));
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(null);
      });
      req.write(dataStr);
      req.end();
    });
  }
}

export const aiDetectionService = new AIDetectionService();
