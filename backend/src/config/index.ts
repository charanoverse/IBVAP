import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from workspace root or current directory
const rootEnvPath = path.resolve(__dirname, '../../../.env');
const localEnvPath = path.resolve(__dirname, '../../.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
} else {
  dotenv.config();
}

export interface AppConfig {
  env: string;
  port: number;
  host: string;
  databasePath: string;
  storage: {
    videosPath: string;
    snapshotsPath: string;
    evidencePath: string;
  };
  configPaths: {
    camerasPath: string;
    zonesPath: string;
    rulesPath: string;
    incidentsPath: string;
  };
  evidence: {
    preSeconds: number;
    postSeconds: number;
    minEventDurationSeconds: number;
    maxConcurrency: number;
  };
  ai: {
    enabled: boolean;
    model: string;
    modelPath: string;
    confidenceThreshold: number;
    iouThreshold: number;
    inferenceFps: number;
    device: 'auto' | 'cpu' | 'cuda';
    targetClasses: string[];
    pythonPath: string;
    servicePort: number;
    persistenceEnabled: boolean;
    persistenceIntervalSeconds: number;
  };
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}

const resolveAppPath = (relPath: string): string => {
  if (path.isAbsolute(relPath)) {
    return relPath;
  }
  return path.resolve(__dirname, '../../../', relPath);
};

export const config: AppConfig = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '127.0.0.1',
  databasePath: resolveAppPath(process.env.DATABASE_PATH || './data/ibvap_dev.sqlite'),
  storage: {
    videosPath: resolveAppPath(process.env.STORAGE_VIDEOS_PATH || './data/videos'),
    snapshotsPath: resolveAppPath(process.env.STORAGE_SNAPSHOTS_PATH || './data/snapshots'),
    evidencePath: resolveAppPath(process.env.STORAGE_EVIDENCE_PATH || './data/evidence'),
  },
  configPaths: {
    camerasPath: resolveAppPath(process.env.CONFIG_CAMERAS_PATH || './config/cameras'),
    zonesPath: resolveAppPath(process.env.CONFIG_ZONES_PATH || './config/zones'),
    rulesPath: resolveAppPath(process.env.CONFIG_RULES_PATH || './config/rules'),
    incidentsPath: resolveAppPath(process.env.CONFIG_INCIDENTS_PATH || './config/incidents'),
  },
  evidence: {
    preSeconds: parseFloat(process.env.EVIDENCE_PRE_SECONDS || '10.0'),
    postSeconds: parseFloat(process.env.EVIDENCE_POST_SECONDS || '10.0'),
    minEventDurationSeconds: parseFloat(process.env.EVIDENCE_MIN_DURATION || '4.0'),
    maxConcurrency: parseInt(process.env.EVIDENCE_MAX_CONCURRENCY || '2', 10),
  },
  ai: {
    enabled: process.env.AI_ENABLED !== 'false',
    model: process.env.AI_MODEL || 'yolov8n.pt',
    modelPath: resolveAppPath(process.env.AI_MODEL_PATH || './ai/models/yolov8n.pt'),
    confidenceThreshold: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD || '0.40'),
    iouThreshold: parseFloat(process.env.AI_IOU_THRESHOLD || '0.45'),
    inferenceFps: parseInt(process.env.AI_INFERENCE_FPS || '5', 10),
    device: (process.env.AI_DEVICE as 'auto' | 'cpu' | 'cuda') || 'auto',
    targetClasses: (process.env.AI_CLASSES || 'person,car,motorcycle,bus,truck')
      .split(',')
      .map((c) => c.trim().toLowerCase()),
    pythonPath: process.env.PYTHON_PATH || 'python',
    servicePort: parseInt(process.env.AI_SERVICE_PORT || '5001', 10),
    persistenceEnabled: process.env.AI_PERSISTENCE_ENABLED !== 'false',
    persistenceIntervalSeconds: parseInt(process.env.AI_PERSISTENCE_INTERVAL || '5', 10),
  },
  logLevel: (process.env.LOG_LEVEL?.toUpperCase() as AppConfig['logLevel']) || 'INFO',
};
