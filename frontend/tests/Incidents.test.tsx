import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { IncidentCard } from '../src/components/IncidentCard';
import { IncidentQueue } from '../src/components/IncidentQueue';
import { IncidentTimeline } from '../src/components/IncidentTimeline';
import { EvidenceViewer } from '../src/components/EvidenceViewer';
import { IncidentDetailPage } from '../src/pages/IncidentDetailPage';
import { incidentService } from '../src/services/incidentService';
import { Incident, Evidence, IncidentTimelineEvent } from '@ibvap/shared';

const mockIncident: Incident = {
  id: 'INC-000101',
  title: 'Sterile Zone Entry Breach',
  cameraId: 'CAM-03',
  cameraName: 'Restricted Sterile Zone — Fence Line',
  zoneId: 'ZONE-CAM03-RESTRICTED',
  zoneName: 'Restricted Sterile Buffer Zone',
  primaryEventId: 'EVT-001',
  linkedEventIds: ['EVT-001', 'EVT-002'],
  priority: 'HIGH',
  priorityReason: 'High priority: Sterile / Restricted zone entry breach detected.',
  state: 'NEW',
  reviewState: 'NEW',
  openedAt: '2026-09-26T18:00:00Z',
  evidenceIds: ['EVD-000101'],
  evidenceState: 'READY',
  evidenceAvailable: true,
  explanation: 'Person track T017 entered Restricted Sterile Buffer Zone.',
  trackId: 17,
  trackDisplayId: 'T017',
  objectClass: 'person',
  observationQuality: 'GOOD',
  notes: [
    {
      id: 'NOTE-1',
      authorId: 'op-1',
      authorName: 'Demo Operator',
      text: 'Subject detected near inner fence perimeter.',
      createdAt: '2026-09-26T18:01:00Z',
    },
  ],
  createdAt: '2026-09-26T18:00:00Z',
  updatedAt: '2026-09-26T18:01:00Z',
};

const mockEvidence: Evidence = {
  id: 'EVD-000101',
  incidentId: 'INC-000101',
  cameraId: 'CAM-03',
  primaryEventId: 'EVT-001',
  linkedEventIds: ['EVT-001', 'EVT-002'],
  preEventClip: 'pre-event.mp4',
  eventClip: 'event.mp4',
  postEventClip: 'post-event.mp4',
  snapshot: 'snapshot.jpg',
  status: 'READY',
  hashes: {
    preEvent: 'a1b2c3d4e5f6',
    event: 'b2c3d4e5f6a1',
    postEvent: 'c3d4e5f6a1b2',
    snapshot: 'd4e5f6a1b2c3',
  },
  timestamps: {
    startTime: '2026-09-26T17:59:50Z',
    endTime: '2026-09-26T18:00:15Z',
    preStartSeconds: 10,
    eventStartSeconds: 18,
    eventEndSeconds: 22,
    postEndSeconds: 32,
    snapshotTimestampSeconds: 18,
  },
  createdAt: '2026-09-26T18:00:05Z',
};

const mockTimeline: IncidentTimelineEvent[] = [
  {
    id: 'TL-1',
    type: 'INCIDENT_OPENED',
    title: 'Incident Opened',
    actor: 'SYSTEM',
    timestamp: '2026-09-26T18:00:00Z',
    description: 'Security incident opened automatically from verified event EVT-001.',
  },
  {
    id: 'TL-2',
    type: 'EVIDENCE_READY',
    title: 'Evidence Extracted',
    actor: 'SYSTEM',
    timestamp: '2026-09-26T18:00:05Z',
    description: 'Forensic temporal video clips & frame snapshot extracted and verified.',
  },
];

describe('Phase 6 Incident Management & Operator Review UI', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('1. IncidentCard displays priority badge, camera, title, and evidence status', () => {
    render(
      <MemoryRouter>
        <IncidentCard incident={mockIncident} />
      </MemoryRouter>
    );

    expect(screen.getByText(/#INC-000101/i)).toBeDefined();
    expect(screen.getByText('HIGH')).toBeDefined();
    expect(screen.getByText('Sterile Zone Entry Breach')).toBeDefined();
    expect(screen.getByText('CAM-03')).toBeDefined();
    expect(screen.getByText(/Restricted Sterile Buffer Zone/i)).toBeDefined();
    expect(screen.getByText(/✓ Evidence Ready/i)).toBeDefined();
  });

  it('2. IncidentQueue renders active incidents list and priority counters', () => {
    render(
      <MemoryRouter>
        <IncidentQueue incidents={[mockIncident]} />
      </MemoryRouter>
    );

    expect(screen.getByText('Active Incident Queue')).toBeDefined();
    expect(screen.getByText('Sterile Zone Entry Breach')).toBeDefined();
    expect(screen.getByText('View All →')).toBeDefined();
  });

  it('3. EvidenceViewer renders 4 tabs: PRE-EVENT, EVENT, POST-EVENT, and SNAPSHOT with SHA-256 hashes', () => {
    render(
      <EvidenceViewer
        incidentId="INC-000101"
        cameraId="CAM-03"
        evidenceData={mockEvidence}
        evidenceAvailable={true}
      />
    );

    expect(screen.getByText(/PRE-EVENT/i)).toBeDefined();
    expect(screen.getByText(/EVENT FOCUS/i)).toBeDefined();
    expect(screen.getByText(/POST-EVENT/i)).toBeDefined();
    expect(screen.getByText(/SNAPSHOT FRAME/i)).toBeDefined();
    expect(screen.getByText(/SHA-256 Hash:/i)).toBeDefined();
  });

  it('4. IncidentTimeline renders chronological events and actors', () => {
    const timelineItems = [
      {
        id: 'TL-1',
        type: 'INCIDENT_OPENED',
        title: 'Security Incident Opened',
        actor: 'SYSTEM',
        time: '18:00:00',
        description: 'Automatic system trigger from verified event EVT-001.',
      },
      {
        id: 'TL-2',
        type: 'EVIDENCE_READY',
        title: 'Forensic Video Attached',
        actor: 'SYSTEM',
        time: '18:00:05',
        description: 'Forensic temporal video clips & frame snapshot extracted and verified.',
      },
    ];

    render(<IncidentTimeline items={timelineItems} />);

    expect(screen.getByText('Security Incident Opened')).toBeDefined();
    expect(screen.getByText('Automatic system trigger from verified event EVT-001.')).toBeDefined();
    expect(screen.getByText(/Forensic temporal video clips/i)).toBeDefined();
  });

  it('5. IncidentDetailPage renders complete operator triage screen with review controls', async () => {
    vi.spyOn(incidentService, 'getIncidentById').mockResolvedValue(mockIncident);
    vi.spyOn(incidentService, 'getIncidentEvidence').mockResolvedValue(mockEvidence);
    vi.spyOn(incidentService, 'getIncidentTimeline').mockResolvedValue(mockTimeline);
    const ackSpy = vi.spyOn(incidentService, 'acknowledge').mockResolvedValue({
      ...mockIncident,
      state: 'ACKNOWLEDGED',
      reviewState: 'ACKNOWLEDGED',
      acknowledgedBy: 'Demo Operator',
    });

    render(
      <MemoryRouter initialEntries={['/incidents/INC-000101']}>
        <Routes>
          <Route path="/incidents/:id" element={<IncidentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sterile Zone Entry Breach' })).toBeDefined();
      expect(screen.getByRole('button', { name: /ACKNOWLEDGE/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /START REVIEW/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /ESCALATE/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /CLOSE INCIDENT/i })).toBeDefined();
    });

    // Test Operator Acknowledge Action
    const ackButton = screen.getByRole('button', { name: /ACKNOWLEDGE/i });
    fireEvent.click(ackButton);

    await waitFor(() => {
      expect(ackSpy).toHaveBeenCalledWith('INC-000101');
    });
  });
});
