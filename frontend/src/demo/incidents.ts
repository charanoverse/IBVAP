import { Incident } from '@ibvap/shared';

export interface IncidentTimelineItem {
  id: string;
  time: string;
  title: string;
  description: string;
  type: 'OBSERVATION' | 'ACTIVITY' | 'EVENT' | 'INCIDENT_OPENED' | 'OPERATOR_ACTION' | any;
  iconType?: string;
  timestamp?: string;
}

export interface DemoIncident extends Omit<Incident, 'timeline'> {
  id: string;
  title: string;
  summary: string;
  priority: any;
  state: any;
  reviewState: any;
  cameraId: string;
  cameraName: string;
  zoneName: string;
  displayTime: string;
  primaryEventId: string;
  linkedEventIds: string[];
  linkedEvents: string[];
  evidenceIds: string[];
  evidence: string[];
  priorityReason: string;
  openedAt: string;
  evidenceState: any;
  timeline: IncidentTimelineItem[];
  evidenceAvailable: boolean;
  preEventClip: string;
  eventClip: string;
  postEventClip: string;
  snapshotUrl?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export const INITIAL_DEMO_INCIDENTS: DemoIncident[] = [
  {
    id: 'INC-1042',
    title: 'Restricted Sterile Zone Breach',
    summary: 'Unidentified subject crossed sterile buffer perimeter fence into restricted area Alpha-3.',
    priority: 'HIGH',
    state: 'NEW',
    reviewState: 'open',
    cameraId: 'CAM-03',
    cameraName: 'Restricted Sterile Zone — Fence Line',
    zoneName: 'Sterile Buffer Zone Alpha-3',
    displayTime: '10:42:18',
    primaryEventId: 'EVT-4021',
    linkedEventIds: ['EVT-4021', 'EVT-4022'],
    linkedEvents: ['EVT-4021', 'EVT-4022'],
    relatedObservations: ['OBS-8901', 'OBS-8902'],
    evidenceIds: ['EVD-5001'],
    evidence: ['EVD-5001'],
    priorityReason: 'High priority sterile zone boundary breach.',
    openedAt: '2026-09-26T10:42:18Z',
    evidenceState: 'READY',
    recommendedViews: ['CAM-03', 'CAM-02'],
    createdAt: '2026-09-26T10:42:18Z',
    updatedAt: '2026-09-26T10:42:18Z',
    evidenceAvailable: true,
    preEventClip: 'sim://evidence/INC-1042_pre.mp4',
    eventClip: 'sim://evidence/INC-1042_event.mp4',
    postEventClip: 'sim://evidence/INC-1042_post.mp4',
    tags: ['Sterile Zone', 'Pedestrian', 'Fence Breach', 'High Risk'],
    timeline: [
      {
        id: 'tl-1',
        time: '10:42:10',
        title: 'Initial Target Observation',
        description: 'Thermal signature detected along eastern perimeter tree line at Sector E2.',
        type: 'OBSERVATION',
      },
      {
        id: 'tl-2',
        time: '10:42:13',
        title: 'Zone Boundary Proximity Alert',
        description: 'Target moved inside warning corridor within 5m of sterile fence.',
        type: 'ACTIVITY',
      },
      {
        id: 'tl-3',
        time: '10:42:18',
        title: 'Sterile Zone Perimeter Breach Event Created',
        description: 'Rule RULE-INTRUSION-01 triggered: sterile perimeter fence breach confirmed.',
        type: 'EVENT',
      },
      {
        id: 'tl-4',
        time: '10:42:18',
        title: 'High-Priority Incident Opened',
        description: 'Incident #INC-1042 created with priority HIGH. Operator dispatch advisory active.',
        type: 'INCIDENT_OPENED',
      },
    ],
  },
  {
    id: 'INC-1040',
    title: 'Corridor Crowd Surge / Density Alert',
    summary: 'Unusual gathering of 4+ individuals detected loitering near Northern Checkpoint gate.',
    priority: 'MEDIUM',
    state: 'UNDER_REVIEW',
    reviewState: 'under_review',
    cameraId: 'CAM-01',
    cameraName: 'North Gate — Main Entry View',
    zoneName: 'North Entry Checkpoint Approach',
    displayTime: '10:40:02',
    primaryEventId: 'EVT-4015',
    linkedEventIds: ['EVT-4015'],
    linkedEvents: ['EVT-4015'],
    relatedObservations: ['OBS-8889'],
    evidenceIds: ['EVD-5002'],
    evidence: ['EVD-5002'],
    priorityReason: 'Medium priority corridor crowd density threshold exceeded.',
    openedAt: '2026-09-26T10:40:02Z',
    evidenceState: 'READY',
    recommendedViews: ['CAM-01', 'CAM-02'],
    createdAt: '2026-09-26T10:40:02Z',
    updatedAt: '2026-09-26T10:41:00Z',
    evidenceAvailable: true,
    preEventClip: 'sim://evidence/INC-1040_pre.mp4',
    eventClip: 'sim://evidence/INC-1040_event.mp4',
    postEventClip: 'sim://evidence/INC-1040_post.mp4',
    tags: ['Gate Area', 'Crowd Density', 'Loitering'],
    timeline: [
      {
        id: 'tl-10',
        time: '10:37:45',
        title: 'Initial Cluster Detected',
        description: '2 individuals observed standing outside marked waiting zone.',
        type: 'OBSERVATION',
      },
      {
        id: 'tl-11',
        time: '10:39:15',
        title: 'Crowd Size Increase',
        description: '2 additional individuals joined group; dwell time exceeded 90 seconds.',
        type: 'ACTIVITY',
      },
      {
        id: 'tl-12',
        time: '10:40:02',
        title: 'Corridor Loitering Rule Triggered',
        description: 'Event EVT-4015 generated. Incident #INC-1040 assigned to operator queue.',
        type: 'EVENT',
      },
    ],
  },
  {
    id: 'INC-1038',
    title: 'Slow Vehicle Speed / Barrier Loitering',
    summary: 'Vehicle stopped in south egress lane for prolonged duration with hazard flashers.',
    priority: 'LOW',
    state: 'NEW',
    reviewState: 'open',
    cameraId: 'CAM-04',
    cameraName: 'Exit Lane & Southern Barrier',
    zoneName: 'South Egress Corridor',
    displayTime: '10:38:44',
    primaryEventId: 'EVT-4009',
    linkedEventIds: ['EVT-4009'],
    linkedEvents: ['EVT-4009'],
    relatedObservations: ['OBS-8850'],
    evidenceIds: ['EVD-5003'],
    evidence: ['EVD-5003'],
    priorityReason: 'Low priority vehicle dwell time threshold exceeded.',
    openedAt: '2026-09-26T10:38:44Z',
    evidenceState: 'READY',
    recommendedViews: ['CAM-04'],
    createdAt: '2026-09-26T10:38:44Z',
    updatedAt: '2026-09-26T10:38:44Z',
    evidenceAvailable: true,
    preEventClip: 'sim://evidence/INC-1038_pre.mp4',
    eventClip: 'sim://evidence/INC-1038_event.mp4',
    postEventClip: 'sim://evidence/INC-1038_post.mp4',
    tags: ['Vehicle', 'Exit Lane', 'Obstruction'],
    timeline: [
      {
        id: 'tl-20',
        time: '10:36:10',
        title: 'Vehicle Entered Exit Lane',
        description: 'Commercial van approached south barrier at normal speed.',
        type: 'OBSERVATION',
      },
      {
        id: 'tl-21',
        time: '10:38:44',
        title: 'Dwell Threshold Exceeded',
        description: 'Vehicle stationary > 120s without clearance scan. Incident opened as LOW priority.',
        type: 'INCIDENT_OPENED',
      },
    ],
  },
  {
    id: 'INC-1031',
    title: 'Sensor Thermal Anomaly — E4 Fence',
    summary: 'Infrared temperature contrast spike detected near drainage culvert at Sector E4.',
    priority: 'LOW',
    state: 'CLOSED',
    reviewState: 'resolved',
    cameraId: 'CAM-05',
    cameraName: 'East Perimeter Fence — Sector E4',
    zoneName: 'East Fence Line E4',
    displayTime: '09:55:12',
    primaryEventId: 'EVT-3990',
    linkedEventIds: ['EVT-3990'],
    linkedEvents: ['EVT-3990'],
    relatedObservations: ['OBS-8790'],
    evidenceIds: ['EVD-4990'],
    evidence: ['EVD-4990'],
    priorityReason: 'Low priority thermal signature anomaly at perimeter fence.',
    openedAt: '2026-09-26T09:55:12Z',
    evidenceState: 'READY',
    recommendedViews: ['CAM-05'],
    createdAt: '2026-09-26T09:55:12Z',
    updatedAt: '2026-09-26T10:05:00Z',
    operatorOutcome: {
      operatorId: 'OP-42',
      action: 'Verified as false positive (wildlife activity).',
      notes: 'No human signature detected; closed per SOP-04.',
      timestamp: '2026-09-26T10:05:00Z',
    },
    evidenceAvailable: true,
    preEventClip: 'sim://evidence/INC-1031_pre.mp4',
    eventClip: 'sim://evidence/INC-1031_event.mp4',
    postEventClip: 'sim://evidence/INC-1031_post.mp4',
    tags: ['Thermal', 'Wildlife', 'Resolved'],
    timeline: [
      {
        id: 'tl-30',
        time: '09:55:12',
        title: 'Thermal Signature Alert',
        description: 'IR flare detected at culvert drainage grate.',
        type: 'EVENT',
      },
      {
        id: 'tl-31',
        time: '10:05:00',
        title: 'Operator Review & Resolution',
        description: 'Operator verified wildlife presence and closed incident.',
        type: 'OPERATOR_ACTION',
      },
    ],
  },
];
