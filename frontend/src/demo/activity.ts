export interface ActivityItem {
  id: string;
  timestamp: string;
  timeDisplay: string;
  cameraId: string;
  cameraName: string;
  message: string;
  type: 'INCIDENT' | 'EVENT' | 'OBSERVATION' | 'SYSTEM' | 'HEALTH';
  severity: 'critical' | 'warning' | 'info' | 'normal';
}

export const DEMO_ACTIVITIES: ActivityItem[] = [
  {
    id: 'act-1',
    timestamp: '2026-09-26T10:42:18Z',
    timeDisplay: '10:42:18',
    cameraId: 'CAM-03',
    cameraName: 'Restricted Sterile Zone',
    message: 'High-priority intrusion event #INC-1042 opened on sterile fence line',
    type: 'INCIDENT',
    severity: 'critical',
  },
  {
    id: 'act-2',
    timestamp: '2026-09-26T10:40:02Z',
    timeDisplay: '10:40:02',
    cameraId: 'CAM-01',
    cameraName: 'North Gate Checkpoint',
    message: 'Crowd surge alert detected (4 persons loitering in vehicle lane)',
    type: 'EVENT',
    severity: 'warning',
  },
  {
    id: 'act-3',
    timestamp: '2026-09-26T10:38:44Z',
    timeDisplay: '10:38:44',
    cameraId: 'CAM-04',
    cameraName: 'South Exit Barrier',
    message: 'Vehicle dwell timeout event logged at south egress barrier',
    type: 'OBSERVATION',
    severity: 'info',
  },
  {
    id: 'act-4',
    timestamp: '2026-09-26T10:35:21Z',
    timeDisplay: '10:35:21',
    cameraId: 'CAM-02',
    cameraName: 'North Corridor',
    message: 'Perimeter optical health telemetry updated (25.0 FPS, signal 95%)',
    type: 'HEALTH',
    severity: 'normal',
  },
  {
    id: 'act-5',
    timestamp: '2026-09-26T10:30:11Z',
    timeDisplay: '10:30:11',
    cameraId: 'CAM-05',
    cameraName: 'East Perimeter E4',
    message: 'Day/Night thermal filter switch completed automatically',
    type: 'SYSTEM',
    severity: 'normal',
  },
  {
    id: 'act-6',
    timestamp: '2026-09-26T10:25:40Z',
    timeDisplay: '10:25:40',
    cameraId: 'CAM-06',
    cameraName: 'Service Yard',
    message: 'Authorized logistics vehicle entry logged (ID #LOG-928)',
    type: 'OBSERVATION',
    severity: 'normal',
  },
];
