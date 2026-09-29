import fs from 'fs';
import path from 'path';
import { CameraRelationship, CameraTopologyConfig, CameraTopologyScoringWeights } from '@ibvap/shared';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export class TopologyService {
  private topologyConfig: CameraTopologyConfig;

  constructor() {
    this.topologyConfig = this.loadTopologyConfig();
  }

  private loadTopologyConfig(): CameraTopologyConfig {
    const defaultFallback: CameraTopologyConfig = {
      version: '1.0',
      description: 'Default Fallback Camera Topology Graph',
      scoringWeights: {
        topologyMatch: 0.35,
        temporalMatch: 0.30,
        directionMatch: 0.15,
        eventTypeMatch: 0.20,
      },
      minScoreThreshold: 0.65,
      maxCandidatesPerEvent: 3,
      recentEventBufferSeconds: 60,
      relationships: [
        {
          id: 'REL-CAM01-CAM02',
          sourceCameraId: 'CAM-01',
          targetCameraId: 'CAM-02',
          relationshipType: 'ENTRY_TO_CORRIDOR',
          minTravelTimeSeconds: 2,
          maxTravelTimeSeconds: 15,
          allowedDirections: ['A_TO_B', 'FORWARD', 'ANY'],
          compatibleEventTypes: ['LINE_CROSSING', 'ZONE_ENTRY', 'ZONE_EXIT'],
          description: 'North Gate entry towards North Corridor approach line',
          enabled: true,
        },
        {
          id: 'REL-CAM02-CAM03',
          sourceCameraId: 'CAM-02',
          targetCameraId: 'CAM-03',
          relationshipType: 'CORRIDOR_TO_STERILE_ZONE',
          minTravelTimeSeconds: 2,
          maxTravelTimeSeconds: 18,
          allowedDirections: ['FORWARD', 'ANY'],
          compatibleEventTypes: ['ZONE_ENTRY', 'ZONE_EXIT', 'LINE_CROSSING', 'DWELL'],
          description: 'Approach from North Corridor fence into Sterile Buffer Zone Alpha-3',
          enabled: true,
        },
        {
          id: 'REL-CAM03-CAM04',
          sourceCameraId: 'CAM-03',
          targetCameraId: 'CAM-04',
          relationshipType: 'STERILE_ZONE_TO_EXIT',
          minTravelTimeSeconds: 3,
          maxTravelTimeSeconds: 20,
          allowedDirections: ['ANY'],
          compatibleEventTypes: ['ZONE_EXIT', 'ZONE_ENTRY', 'LINE_CROSSING'],
          description: 'Transit from Sterile Buffer Zone to South Egress Barrier',
          enabled: true,
        },
        {
          id: 'REL-CAM05-CAM03',
          sourceCameraId: 'CAM-05',
          targetCameraId: 'CAM-03',
          relationshipType: 'PERIMETER_TO_STERILE_ZONE',
          minTravelTimeSeconds: 2,
          maxTravelTimeSeconds: 15,
          allowedDirections: ['ANY'],
          compatibleEventTypes: ['LINE_CROSSING', 'ZONE_ENTRY', 'ZONE_EXIT'],
          description: 'Breach from East Perimeter fence Sector E4 to Sterile Zone',
          enabled: true,
        },
        {
          id: 'REL-CAM06-CAM04',
          sourceCameraId: 'CAM-06',
          targetCameraId: 'CAM-04',
          relationshipType: 'SERVICE_TO_EXIT',
          minTravelTimeSeconds: 3,
          maxTravelTimeSeconds: 20,
          allowedDirections: ['ANY'],
          compatibleEventTypes: ['LINE_CROSSING', 'ZONE_ENTRY', 'ZONE_EXIT'],
          description: 'West Logistics Yard utility road transit to South Egress',
          enabled: true,
        },
      ],
    };

    try {
      const configPath = path.resolve(process.cwd(), 'config', 'cameras', 'camera_relationships.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(raw) as CameraTopologyConfig;
        if (parsed.relationships && Array.isArray(parsed.relationships)) {
          logger.info(`Loaded camera topology relationships from ${configPath} (${parsed.relationships.length} edges)`);
          return parsed;
        }
      }
    } catch (err) {
      logger.warn('Failed to load camera_relationships.json, using built-in defaults:', err);
    }

    return defaultFallback;
  }

  public getTopologyConfig(): CameraTopologyConfig {
    return this.topologyConfig;
  }

  public getScoringWeights(): CameraTopologyScoringWeights {
    return (
      this.topologyConfig.scoringWeights || {
        topologyMatch: 0.35,
        temporalMatch: 0.30,
        directionMatch: 0.15,
        eventTypeMatch: 0.20,
      }
    );
  }

  public getMinScoreThreshold(): number {
    return this.topologyConfig.minScoreThreshold ?? 0.65;
  }

  public getMaxCandidatesPerEvent(): number {
    return this.topologyConfig.maxCandidatesPerEvent ?? 3;
  }

  public getRecentEventBufferSeconds(): number {
    return this.topologyConfig.recentEventBufferSeconds ?? 60;
  }

  public getAllRelationships(): CameraRelationship[] {
    return this.topologyConfig.relationships.filter((r) => r.enabled !== false);
  }

  public getOutgoingNeighbors(sourceCameraId: string): CameraRelationship[] {
    const sId = sourceCameraId.toUpperCase();
    return this.getAllRelationships().filter((r) => r.sourceCameraId.toUpperCase() === sId);
  }

  public getIncomingNeighbors(targetCameraId: string): CameraRelationship[] {
    const tId = targetCameraId.toUpperCase();
    return this.getAllRelationships().filter((r) => r.targetCameraId.toUpperCase() === tId);
  }

  public getRelationshipsForCamera(cameraId: string): CameraRelationship[] {
    const cId = cameraId.toUpperCase();
    return this.getAllRelationships().filter(
      (r) => r.sourceCameraId.toUpperCase() === cId || r.targetCameraId.toUpperCase() === cId
    );
  }

  public findRelationship(sourceCameraId: string, targetCameraId: string): CameraRelationship | undefined {
    const sId = sourceCameraId.toUpperCase();
    const tId = targetCameraId.toUpperCase();
    return this.getAllRelationships().find(
      (r) => r.sourceCameraId.toUpperCase() === sId && r.targetCameraId.toUpperCase() === tId
    );
  }

  public isDirectlyConnected(camA: string, camB: string): boolean {
    return !!this.findRelationship(camA, camB);
  }
}

export const topologyService = new TopologyService();
