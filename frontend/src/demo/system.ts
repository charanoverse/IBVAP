export interface SubsystemHealthStatus {
  id: string;
  name: string;
  category: 'CORE' | 'STORAGE' | 'AI' | 'SENSORS';
  status: 'ONLINE' | 'AVAILABLE' | 'READY' | 'NOT_CONNECTED' | 'DEGRADED';
  badgeType: 'ok' | 'degraded' | 'error' | 'disabled';
  detail: string;
  phaseNote?: string;
  isRealBackend?: boolean;
}

export const SUB_SYSTEM_STATUSES: SubsystemHealthStatus[] = [
  {
    id: 'backend',
    name: 'Backend API Service',
    category: 'CORE',
    status: 'ONLINE',
    badgeType: 'ok',
    detail: 'Express REST service on port 4000',
    isRealBackend: true,
  },
  {
    id: 'database',
    name: 'SQLite Database',
    category: 'CORE',
    status: 'AVAILABLE',
    badgeType: 'ok',
    detail: 'Local SQLite engine with foreign-key constraints',
  },
  {
    id: 'camera_services',
    name: 'Camera Ingestion Services',
    category: 'SENSORS',
    status: 'READY',
    badgeType: 'ok',
    detail: 'Sensor registry and HTTP range video streaming active',
  },
  {
    id: 'ai_engine',
    name: 'AI Inference Engine',
    category: 'AI',
    status: 'ONLINE',
    badgeType: 'ok',
    detail: 'YOLOv8 nano local object detection (5 FPS sampling)',
    phaseNote: 'Phase 3 Active',
  },
  {
    id: 'storage',
    name: 'Forensic Storage Volumes',
    category: 'STORAGE',
    status: 'AVAILABLE',
    badgeType: 'ok',
    detail: 'Local video, snapshot, and evidence partitions active',
  },
];
