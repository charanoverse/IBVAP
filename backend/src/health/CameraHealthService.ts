import {
  CameraHealth,
  CameraHealthState,
  CameraStreamStatus,
  CameraVisibilityMetrics,
  CameraVisibilityState,
} from '@ibvap/shared';
import { videoSourceService } from '../services/videoSourceService.js';
import { cameraRepository } from '../repositories/cameraRepository.js';
import { logger } from '../utils/logger.js';

export interface CameraHealthThresholds {
  minBrightness: number;
  maxBrightness: number;
  minContrast: number;
  minBlur: number;
  minFps: number;
  maxFreshnessMs: number;
  minFrameDiff: number;
}

export interface SimulatedDegradation {
  type: 'OFFLINE' | 'FREEZE' | 'BLUR' | 'LOW_LIGHT' | 'GLARE' | 'FPS_DROP';
  reason?: string;
  appliedAt: string;
}

export type HealthSSEBroadcaster = (eventType: string, data: any) => void;

export class CameraHealthService {
  private broadcasters: HealthSSEBroadcaster[] = [];
  private simulations: Map<string, SimulatedDegradation> = new Map();
  private lastHealthState: Map<string, CameraHealth> = new Map();

  // Baseline calibrated video metrics from actual demo feeds
  private readonly baselineMetrics: Record<string, CameraVisibilityMetrics & { fps: number }> = {
    'CAM-01': { brightness: 135.2, contrast: 43.2, blurScore: 466.0, frameDifference: 2.66, fps: 24.0 },
    'CAM-02': { brightness: 122.3, contrast: 42.5, blurScore: 891.9, frameDifference: 1.73, fps: 24.0 },
    'CAM-03': { brightness: 129.1, contrast: 33.1, blurScore: 126.1, frameDifference: 0.36, fps: 24.0 },
    'CAM-04': { brightness: 123.9, contrast: 45.3, blurScore: 246.6, frameDifference: 2.24, fps: 24.0 },
    'CAM-05': { brightness: 125.6, contrast: 34.7, blurScore: 209.8, frameDifference: 0.50, fps: 24.0 },
    'CAM-06': { brightness: 42.8, contrast: 33.3, blurScore: 91.7, frameDifference: 0.40, fps: 24.0 },
  };

  // Camera-specific thresholds (night cameras have lower natural brightness & blur)
  private readonly cameraThresholds: Record<string, CameraHealthThresholds> = {
    'CAM-06': {
      minBrightness: 20.0,
      maxBrightness: 240.0,
      minContrast: 20.0,
      minBlur: 50.0,
      minFps: 10.0,
      maxFreshnessMs: 5000,
      minFrameDiff: 0.05,
    },
    'CAM-03': {
      minBrightness: 30.0,
      maxBrightness: 240.0,
      minContrast: 20.0,
      minBlur: 75.0,
      minFps: 10.0,
      maxFreshnessMs: 5000,
      minFrameDiff: 0.05,
    },
    default: {
      minBrightness: 30.0,
      maxBrightness: 240.0,
      minContrast: 20.0,
      minBlur: 100.0,
      minFps: 10.0,
      maxFreshnessMs: 5000,
      minFrameDiff: 0.05,
    },
  };

  public registerBroadcaster(fn: HealthSSEBroadcaster): void {
    this.broadcasters.push(fn);
  }

  private broadcast(eventType: string, data: any): void {
    for (const broadcaster of this.broadcasters) {
      try {
        broadcaster(eventType, data);
      } catch (err) {
        logger.warn('Failed to broadcast health SSE event:', err);
      }
    }
  }

  public getThresholds(cameraId: string): CameraHealthThresholds {
    const normalized = cameraId.toUpperCase();
    return this.cameraThresholds[normalized] || this.cameraThresholds['default'];
  }

  /**
   * Assesses health, visibility, and stream status for a camera.
   */
  public async getCameraHealth(cameraId: string): Promise<CameraHealth> {
    const normalized = cameraId.toUpperCase();
    const thresholds = this.getThresholds(normalized);
    const simulation = this.simulations.get(normalized);
    const baseline = this.baselineMetrics[normalized] || {
      brightness: 120.0,
      contrast: 40.0,
      blurScore: 250.0,
      frameDifference: 1.0,
      fps: 24.0,
    };

    let sourceAvailable = false;
    let expectedFps = baseline.fps;

    try {
      const meta = await videoSourceService.getVideoMetadata(normalized);
      if (meta && meta.status !== 'unavailable') {
        sourceAvailable = true;
        if (meta.fps) expectedFps = meta.fps;
      }
    } catch {
      sourceAvailable = false;
    }

    // Default nominal metrics
    let streamStatus: CameraStreamStatus = sourceAvailable ? 'AVAILABLE' : 'UNAVAILABLE';
    let effectiveFps = sourceAvailable ? expectedFps : 0;
    let frameFreshnessMs = sourceAvailable ? 42 : 10000;
    let frozenFrameDetected = false;
    let metrics: CameraVisibilityMetrics = {
      brightness: baseline.brightness,
      contrast: baseline.contrast,
      blurScore: baseline.blurScore,
      frameDifference: baseline.frameDifference,
    };
    const reasons: string[] = [];
    let isSimulated = false;
    let simulatedReason: string | undefined;

    // Apply simulation overrides if active
    if (simulation) {
      isSimulated = true;
      switch (simulation.type) {
        case 'OFFLINE':
          streamStatus = 'UNAVAILABLE';
          sourceAvailable = false;
          effectiveFps = 0;
          frameFreshnessMs = 99999;
          simulatedReason = simulation.reason || '[SIMULATION] Camera stream disconnected / signal lost';
          reasons.push(simulatedReason);
          break;
        case 'FREEZE':
          streamStatus = 'STALLED';
          frozenFrameDetected = true;
          metrics.frameDifference = 0.0;
          simulatedReason = simulation.reason || '[SIMULATION] Video feed frozen: identical consecutive frames detected';
          reasons.push(simulatedReason);
          break;
        case 'BLUR':
          metrics.blurScore = 22.4;
          simulatedReason = simulation.reason || '[SIMULATION] Severe optical defocus / lens obstruction detected';
          reasons.push(simulatedReason);
          break;
        case 'LOW_LIGHT':
          metrics.brightness = 12.5;
          simulatedReason = simulation.reason || '[SIMULATION] Underexposure: scene illumination dropped below operational limit';
          reasons.push(simulatedReason);
          break;
        case 'GLARE':
          metrics.brightness = 252.0;
          metrics.contrast = 8.2;
          simulatedReason = simulation.reason || '[SIMULATION] Severe solar glare / overexposure saturating camera sensor';
          reasons.push(simulatedReason);
          break;
        case 'FPS_DROP':
          effectiveFps = 3.5;
          simulatedReason = simulation.reason || '[SIMULATION] Frame rate dropped below threshold (3.5 FPS < 10.0 FPS)';
          reasons.push(simulatedReason);
          break;
      }
    }

    // Evaluate Visibility State
    let visibilityState: CameraVisibilityState = 'GOOD';
    if (!sourceAvailable || streamStatus === 'UNAVAILABLE') {
      visibilityState = 'UNKNOWN';
      if (!simulation) {
        reasons.push('Camera stream is unavailable; visibility cannot be assessed.');
      }
    } else {
      let issuesCount = 0;
      if (metrics.brightness < thresholds.minBrightness) {
        issuesCount++;
        reasons.push(
          `Scene underexposed: brightness ${metrics.brightness.toFixed(1)} < min threshold ${thresholds.minBrightness.toFixed(1)}.`
        );
      } else if (metrics.brightness > thresholds.maxBrightness) {
        issuesCount++;
        reasons.push(
          `Sensor overexposed: brightness ${metrics.brightness.toFixed(1)} > max threshold ${thresholds.maxBrightness.toFixed(1)}.`
        );
      }

      if (metrics.contrast < thresholds.minContrast) {
        issuesCount++;
        reasons.push(
          `Low contrast: ${metrics.contrast.toFixed(1)} < min threshold ${thresholds.minContrast.toFixed(1)} (fog or glare wash).`
        );
      }

      if (metrics.blurScore < thresholds.minBlur) {
        issuesCount += 2; // Blur is critical for AI detection & operator review
        reasons.push(
          `Sharpness failure: Laplacian blur score ${metrics.blurScore.toFixed(1)} < min threshold ${thresholds.minBlur.toFixed(1)}.`
        );
      }

      if (issuesCount >= 2) {
        visibilityState = 'POOR';
      } else if (issuesCount === 1) {
        visibilityState = 'DEGRADED';
      } else {
        visibilityState = 'GOOD';
        if (reasons.length === 0) {
          reasons.push(
            `Visibility nominal: brightness ${metrics.brightness.toFixed(1)}, contrast ${metrics.contrast.toFixed(1)}, sharpness score ${metrics.blurScore.toFixed(1)}.`
          );
        }
      }
    }

    // Evaluate Overall Camera Health State
    let healthState: CameraHealthState = 'HEALTHY';
    if (streamStatus === 'UNAVAILABLE' || !sourceAvailable) {
      healthState = 'OFFLINE';
    } else if (streamStatus === 'STALLED' || frozenFrameDetected) {
      healthState = 'DEGRADED';
      if (!reasons.some((r) => r.includes('frozen') || r.includes('stalled'))) {
        reasons.push('Stream stalled or frozen frame detected.');
      }
    } else if (effectiveFps < thresholds.minFps) {
      healthState = 'DEGRADED';
      reasons.push(
        `Degraded FPS: effective ${effectiveFps.toFixed(1)} FPS is below operational baseline ${thresholds.minFps.toFixed(1)} FPS.`
      );
    } else if (visibilityState === 'POOR' || visibilityState === 'DEGRADED') {
      healthState = 'DEGRADED';
    } else {
      healthState = 'HEALTHY';
      if (!isSimulated && reasons.length <= 1) {
        reasons.unshift(`Camera online at ${effectiveFps.toFixed(1)} FPS. Stream healthy.`);
      }
    }

    const health: CameraHealth = {
      cameraId: normalized,
      isOnline: healthState === 'HEALTHY' || healthState === 'DEGRADED',
      healthState,
      visibilityState,
      streamStatus,
      sourceAvailable,
      effectiveFps,
      expectedFps,
      fps: effectiveFps,
      frameFreshnessMs,
      frozenFrameDetected,
      metrics,
      reasons,
      isSimulated,
      simulatedReason,
      measuredAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
    };

    // Check for state transitions and record audit trail
    const previous = this.lastHealthState.get(normalized);
    if (
      !previous ||
      previous.healthState !== health.healthState ||
      previous.visibilityState !== health.visibilityState
    ) {
      this.lastHealthState.set(normalized, health);
      const prevHealth = previous?.healthState || 'UNKNOWN';
      const prevVis = previous?.visibilityState || 'UNKNOWN';
      const primaryReason = reasons[0] || 'State evaluation transition';

      cameraRepository
        .recordHealthTransition({
          cameraId: normalized,
          previousState: prevHealth,
          newState: health.healthState || 'UNKNOWN',
          previousVisibility: prevVis,
          newVisibility: health.visibilityState || 'UNKNOWN',
          reason: primaryReason,
          isSimulated: isSimulated,
        })
        .catch((err) => logger.warn('Failed to log camera health transition:', err));

      this.broadcast('camera_health_updated', health);
    }

    return health;
  }

  /**
   * Assesses health and visibility for all known cameras.
   */
  public async getAllCamerasHealth(): Promise<Record<string, CameraHealth>> {
    const cameras = await cameraRepository.findAll();
    const result: Record<string, CameraHealth> = {};

    for (const camera of cameras) {
      result[camera.id] = await this.getCameraHealth(camera.id);
    }

    return result;
  }

  /**
   * Simulates a health/visibility degradation on a camera for development and demonstration.
   */
  public async simulateDegradation(
    cameraId: string,
    type: 'OFFLINE' | 'FREEZE' | 'BLUR' | 'LOW_LIGHT' | 'GLARE' | 'FPS_DROP',
    reason?: string
  ): Promise<CameraHealth> {
    const normalized = cameraId.toUpperCase();
    this.simulations.set(normalized, {
      type,
      reason,
      appliedAt: new Date().toISOString(),
    });
    logger.info(`Simulated degradation [${type}] applied to camera ${normalized}`);
    return this.getCameraHealth(normalized);
  }

  /**
   * Restores a camera from any simulated degradation back to normal operational telemetry.
   */
  public async restoreCamera(cameraId: string): Promise<CameraHealth> {
    const normalized = cameraId.toUpperCase();
    this.simulations.delete(normalized);
    logger.info(`Simulated degradation cleared for camera ${normalized}`);
    return this.getCameraHealth(normalized);
  }

  /**
   * Returns recent health state transitions for a camera.
   */
  public async getHealthTransitions(cameraId: string, limit = 20): Promise<any[]> {
    const normalized = cameraId.toUpperCase();
    return cameraRepository.findHealthTransitions(normalized, limit);
  }
}

export const cameraHealthService = new CameraHealthService();
