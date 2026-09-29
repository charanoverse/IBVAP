export interface MapZone {
  id: string;
  name: string;
  type: 'sterile' | 'warning' | 'checkpoint' | 'yard' | 'perimeter';
  polygon: Array<{ x: number; y: number }>;
  color: string;
  stroke: string;
  labelPosition: { x: number; y: number };
  description: string;
}

export interface MapCameraMarker {
  id: string;
  name: string;
  x: number; // 0 to 800 coordinate system
  y: number; // 0 to 500 coordinate system
  azimuth: number; // angle in degrees
  fov: number; // angle in degrees
  range: number; // radius in px
  status: 'active' | 'standby' | 'inactive';
  sector: string;
  lensType: string;
}

export const DEMO_MAP_ZONES: MapZone[] = [
  {
    id: 'ZONE-STERILE-ALPHA',
    name: 'STERILE BUFFER ZONE ALPHA-3',
    type: 'sterile',
    polygon: [
      { x: 120, y: 120 },
      { x: 680, y: 120 },
      { x: 680, y: 190 },
      { x: 120, y: 190 },
    ],
    color: 'rgba(239, 68, 68, 0.12)',
    stroke: 'rgba(239, 68, 68, 0.7)',
    labelPosition: { x: 400, y: 155 },
    description: 'Zero-tolerance sterile perimeter buffer along northern barrier',
  },
  {
    id: 'ZONE-WARNING-NORTH',
    name: 'NORTH APPROACH WARNING CORRIDOR',
    type: 'warning',
    polygon: [
      { x: 120, y: 50 },
      { x: 680, y: 50 },
      { x: 680, y: 120 },
      { x: 120, y: 120 },
    ],
    color: 'rgba(245, 158, 11, 0.08)',
    stroke: 'rgba(245, 158, 11, 0.5)',
    labelPosition: { x: 400, y: 85 },
    description: 'Outer approach corridor for early classification and telemetry',
  },
  {
    id: 'ZONE-GATE-INTERIOR',
    name: 'MAIN CHECKPOINT PLAZA',
    type: 'checkpoint',
    polygon: [
      { x: 300, y: 190 },
      { x: 500, y: 190 },
      { x: 500, y: 340 },
      { x: 300, y: 340 },
    ],
    color: 'rgba(59, 130, 246, 0.08)',
    stroke: 'rgba(59, 130, 246, 0.4)',
    labelPosition: { x: 400, y: 265 },
    description: 'Vehicle and pedestrian security inspection checkpoint',
  },
  {
    id: 'ZONE-LOGISTICS',
    name: 'WEST LOGISTICS YARD',
    type: 'yard',
    polygon: [
      { x: 120, y: 190 },
      { x: 300, y: 190 },
      { x: 300, y: 440 },
      { x: 120, y: 440 },
    ],
    color: 'rgba(107, 114, 128, 0.08)',
    stroke: 'rgba(107, 114, 128, 0.4)',
    labelPosition: { x: 210, y: 315 },
    description: 'Service vehicles, equipment maintenance, and utility bay',
  },
  {
    id: 'ZONE-EAST-FENCE',
    name: 'EAST PERIMETER SECTOR E4',
    type: 'perimeter',
    polygon: [
      { x: 500, y: 190 },
      { x: 680, y: 190 },
      { x: 680, y: 440 },
      { x: 500, y: 440 },
    ],
    color: 'rgba(16, 185, 129, 0.06)',
    stroke: 'rgba(16, 185, 129, 0.4)',
    labelPosition: { x: 590, y: 315 },
    description: 'High-security eastern boundary sensor fence line',
  },
];

export const DEMO_MAP_CAMERAS: MapCameraMarker[] = [
  {
    id: 'CAM-01',
    name: 'North Gate — Main Entry',
    x: 400,
    y: 190,
    azimuth: 0, // Facing North
    fov: 85,
    range: 120,
    status: 'active',
    sector: 'Sector-North Alpha',
    lensType: 'OPTICAL HD',
  },
  {
    id: 'CAM-02',
    name: 'North Corridor Approach',
    x: 220,
    y: 120,
    azimuth: 15,
    fov: 70,
    range: 110,
    status: 'active',
    sector: 'Sector-North Bravo',
    lensType: 'OPTICAL HD',
  },
  {
    id: 'CAM-03',
    name: 'Restricted Sterile Zone E3',
    x: 580,
    y: 120,
    azimuth: 345,
    fov: 65,
    range: 115,
    status: 'standby',
    sector: 'Sector-East Sterile Zone',
    lensType: 'THERMAL FLIR',
  },
  {
    id: 'CAM-04',
    name: 'South Egress Barrier',
    x: 400,
    y: 340,
    azimuth: 180, // Facing South
    fov: 80,
    range: 110,
    status: 'active',
    sector: 'Sector-South Egress',
    lensType: 'OPTICAL HD',
  },
  {
    id: 'CAM-05',
    name: 'East Boundary Fence',
    x: 680,
    y: 315,
    azimuth: 270, // Facing West
    fov: 65,
    range: 100,
    status: 'active',
    sector: 'Sector-East Perimeter',
    lensType: 'THERMAL FLIR',
  },
  {
    id: 'CAM-06',
    name: 'West Maintenance Yard',
    x: 120,
    y: 315,
    azimuth: 90, // Facing East
    fov: 75,
    range: 95,
    status: 'active',
    sector: 'Sector-West Logistics',
    lensType: 'OPTICAL HD',
  },
];

export interface MapTopologyLink {
  id: string;
  sourceCameraId: string;
  targetCameraId: string;
  relationshipType: string;
  minTravelTimeSeconds: number;
  maxTravelTimeSeconds: number;
  allowedDirections: string[];
  description: string;
}

export const DEMO_MAP_TOPOLOGY_LINKS: MapTopologyLink[] = [
  {
    id: 'REL-CAM01-CAM02',
    sourceCameraId: 'CAM-01',
    targetCameraId: 'CAM-02',
    relationshipType: 'ENTRY_TO_CORRIDOR',
    minTravelTimeSeconds: 2,
    maxTravelTimeSeconds: 15,
    allowedDirections: ['A_TO_B', 'FORWARD', 'ANY'],
    description: 'North Gate entry towards North Corridor approach line',
  },
  {
    id: 'REL-CAM02-CAM03',
    sourceCameraId: 'CAM-02',
    targetCameraId: 'CAM-03',
    relationshipType: 'CORRIDOR_TO_STERILE_ZONE',
    minTravelTimeSeconds: 2,
    maxTravelTimeSeconds: 18,
    allowedDirections: ['FORWARD', 'ANY'],
    description: 'Approach from North Corridor fence into Sterile Buffer Zone Alpha-3',
  },
  {
    id: 'REL-CAM03-CAM04',
    sourceCameraId: 'CAM-03',
    targetCameraId: 'CAM-04',
    relationshipType: 'STERILE_ZONE_TO_EXIT',
    minTravelTimeSeconds: 3,
    maxTravelTimeSeconds: 20,
    allowedDirections: ['ANY'],
    description: 'Transit from Sterile Buffer Zone to South Egress Barrier',
  },
  {
    id: 'REL-CAM05-CAM03',
    sourceCameraId: 'CAM-05',
    targetCameraId: 'CAM-03',
    relationshipType: 'PERIMETER_TO_STERILE_ZONE',
    minTravelTimeSeconds: 2,
    maxTravelTimeSeconds: 15,
    allowedDirections: ['ANY'],
    description: 'Breach from East Perimeter fence Sector E4 to Sterile Zone',
  },
  {
    id: 'REL-CAM06-CAM04',
    sourceCameraId: 'CAM-06',
    targetCameraId: 'CAM-04',
    relationshipType: 'SERVICE_TO_EXIT',
    minTravelTimeSeconds: 3,
    maxTravelTimeSeconds: 20,
    allowedDirections: ['ANY'],
    description: 'West Logistics Yard utility road transit to South Egress',
  },
];

