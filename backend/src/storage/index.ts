import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface StorageLocations {
  videosDir: string;
  snapshotsDir: string;
  evidenceDir: string;
}

export class StorageManager {
  private locations: StorageLocations;

  constructor() {
    this.locations = {
      videosDir: config.storage.videosPath,
      snapshotsDir: config.storage.snapshotsPath,
      evidenceDir: config.storage.evidencePath,
    };
  }

  public ensureDirectories(): void {
    Object.entries(this.locations).forEach(([key, dirPath]) => {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        logger.info(`Created storage directory: ${key} -> ${dirPath}`);
      }
    });
  }

  public getVideosPath(fileName?: string): string {
    return fileName ? path.join(this.locations.videosDir, fileName) : this.locations.videosDir;
  }

  public getSnapshotsPath(fileName?: string): string {
    return fileName ? path.join(this.locations.snapshotsDir, fileName) : this.locations.snapshotsDir;
  }

  public getEvidencePath(fileName?: string): string {
    return fileName ? path.join(this.locations.evidenceDir, fileName) : this.locations.evidenceDir;
  }

  public getLocations(): StorageLocations {
    return { ...this.locations };
  }
}

export const storageManager = new StorageManager();
