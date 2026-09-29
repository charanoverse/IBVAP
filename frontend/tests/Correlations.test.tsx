import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CorrelationCard } from '../src/components/CorrelationCard';
import { CoverageMap } from '../src/components/CoverageMap';
import { IncidentDetailPage } from '../src/pages/IncidentDetailPage';
import { correlationService } from '../src/services/correlationService';
import { incidentService } from '../src/services/incidentService';
import { Correlation, Incident } from '@ibvap/shared';

const mockCorrelation: Correlation = {
  id: 'CORR-TEST-001',
  sourceEventId: 'EVT-CAM01-101',
  targetEventId: 'EVT-CAM02-201',
  sourceCameraId: 'CAM-01',
  targetCameraId: 'CAM-02',
  relationshipType: 'ENTRY_TO_CORRIDOR',
  timeDeltaSeconds: 4.2,
  score: 0.88,
  confidence: 0.88,
  state: 'candidate',
  reason: 'Topology path ENTRY_TO_CORRIDOR matched with delta 4.2s in [2s, 15s]',
  factors: {
    topologyMatch: true,
    temporalMatch: true,
    directionMatch: true,
    eventTypeMatch: true,
    timeDeltaSeconds: 4.2,
    minAllowedTimeSeconds: 2,
    maxAllowedTimeSeconds: 15,
    sourceEventType: 'LINE_CROSSING',
    targetEventType: 'ZONE_ENTRY',
  },
  explanation:
    'Event EVT-CAM01-101 on CAM-01 (LINE_CROSSING) precedes EVT-CAM02-201 on CAM-02 (ZONE_ENTRY) by 4.2s. This fits the configured travel window (2s–15s) for path "ENTRY_TO_CORRIDOR". Movement direction and event types are consistent.',
  createdAt: '2026-09-26T18:00:00Z',
  updatedAt: '2026-09-26T18:00:00Z',
};

const mockIncident: Incident = {
  id: 'INC-000101',
  title: 'Sterile Zone Entry Breach',
  cameraId: 'CAM-03',
  cameraName: 'Restricted Sterile Zone — Fence Line',
  zoneId: 'ZONE-CAM03-RESTRICTED',
  zoneName: 'Restricted Sterile Buffer Zone',
  primaryEventId: 'EVT-CAM03-201',
  linkedEventIds: ['EVT-CAM03-201'],
  priority: 'HIGH',
  priorityReason: 'High priority: Sterile / Restricted zone entry breach detected.',
  state: 'NEW',
  reviewState: 'NEW',
  openedAt: '2026-09-26T18:00:00Z',
  evidenceIds: [],
  evidenceState: 'PENDING',
  explanation: 'Person entered Restricted Sterile Buffer Zone.',
  createdAt: '2026-09-26T18:00:00Z',
  updatedAt: '2026-09-26T18:00:00Z',
};

describe('Phase 7 Cross-Camera Event Correlation UI', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('1. CorrelationCard Component', () => {
    it('renders camera path, correlation score, time delta, and factor checklist', () => {
      render(<CorrelationCard correlation={mockCorrelation} />);

      // Camera path
      expect(screen.getByText('CAM-01')).toBeDefined();
      expect(screen.getByText('CAM-02')).toBeDefined();
      expect(screen.getByText('ENTRY_TO_CORRIDOR')).toBeDefined();

      // Score
      expect(screen.getByText(/CORRELATION SCORE:/i)).toBeDefined();
      expect(screen.getByText(/88%/i)).toBeDefined();

      // Delta
      expect(screen.getByText(/\+4\.2s travel time/i)).toBeDefined();

      // Factors
      expect(screen.getByText('Topology Edge')).toBeDefined();
      expect(screen.getByText(/Travel Window \[2s–15s\]/i)).toBeDefined();
      expect(screen.getByText('Direction Consistent')).toBeDefined();
      expect(screen.getByText('Event Type Compatible')).toBeDefined();

      // Explanation
      expect(screen.getByText(/Event EVT-CAM01-101 on CAM-01/i)).toBeDefined();
    });

    it('triggers onAccept handler when Accept Correlation button is clicked', async () => {
      const handleAccept = vi.fn().mockResolvedValue(undefined);
      render(<CorrelationCard correlation={mockCorrelation} onAccept={handleAccept} />);

      const acceptBtn = screen.getByRole('button', { name: /accept correlation/i });
      fireEvent.click(acceptBtn);

      expect(handleAccept).toHaveBeenCalledWith('CORR-TEST-001', undefined);
    });

    it('triggers onReject handler when Reject Correlation button is clicked', async () => {
      const handleReject = vi.fn().mockResolvedValue(undefined);
      render(<CorrelationCard correlation={mockCorrelation} onReject={handleReject} />);

      const rejectBtn = screen.getByRole('button', { name: /reject correlation/i });
      fireEvent.click(rejectBtn);

      expect(handleReject).toHaveBeenCalledWith('CORR-TEST-001', undefined);
    });

    it('allows opening note input and submitting review notes', async () => {
      const handleAddNote = vi.fn().mockResolvedValue(undefined);
      render(<CorrelationCard correlation={mockCorrelation} onAddNote={handleAddNote} />);

      const noteBtn = screen.getByRole('button', { name: /\+ Note/i });
      fireEvent.click(noteBtn);

      const textarea = screen.getByPlaceholderText(/Add operator triage note/i);
      fireEvent.change(textarea, { target: { value: 'Verified perimeter timing match' } });

      const saveBtn = screen.getByRole('button', { name: /Save Note/i });
      fireEvent.click(saveBtn);

      expect(handleAddNote).toHaveBeenCalledWith('CORR-TEST-001', 'Verified perimeter timing match');
    });

    it('enforces terminology boundaries: contains NO prohibited same-person or biometric claims', () => {
      const { container } = render(<CorrelationCard correlation={mockCorrelation} />);
      const text = container.textContent?.toLowerCase() || '';

      expect(text).not.toContain('same person');
      expect(text).not.toContain('same vehicle');
      expect(text).not.toContain('identity match');
      expect(text).not.toContain('reid');
      expect(text).not.toContain('biometric');
    });
  });

  describe('2. CoverageMap Topology Overlay', () => {
    it('renders directional topology paths with travel-time window tags', () => {
      render(<CoverageMap />);

      expect(screen.getByText('2D Perimeter Sensor Coverage & Topology Map')).toBeDefined();
      expect(screen.getByText('PHASE 7 TOPOLOGY')).toBeDefined();

      // Travel-time window tags on SVG map (e.g. 2s–15s, 2s–18s, 3s–20s)
      expect(screen.getAllByText('2s–15s').length).toBeGreaterThan(0);
      expect(screen.getAllByText('2s–18s').length).toBeGreaterThan(0);
      expect(screen.getAllByText('3s–20s').length).toBeGreaterThan(0);
    });

    it('displays connected topology paths when a camera is inspected', () => {
      render(<CoverageMap />);

      // Connected topology paths section
      expect(screen.getByText(/Connected Topology Paths/i)).toBeDefined();
    });
  });

  describe('3. IncidentDetailPage Cross-Camera Correlations Section', () => {
    it('renders Possibly Related Cross-Camera Events panel in incident triage screen', async () => {
      vi.spyOn(incidentService, 'getIncidentById').mockResolvedValue(mockIncident);
      vi.spyOn(incidentService, 'getIncidentEvidence').mockResolvedValue(null);
      vi.spyOn(incidentService, 'getIncidentTimeline').mockResolvedValue([]);
      vi.spyOn(correlationService, 'getCorrelations').mockResolvedValue([mockCorrelation]);

      render(
        <MemoryRouter initialEntries={['/incidents/INC-000101']}>
          <Routes>
            <Route path="/incidents/:id" element={<IncidentDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Possibly Related Cross-Camera Events/i)).toBeDefined();
        expect(screen.getByText(/PHASE 7 CORRELATION/i)).toBeDefined();
        expect(screen.getByText(/Operator Notice:/i)).toBeDefined();
      });

      // Renders candidate card
      expect(screen.getByText(/CORRELATION SCORE:/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /accept correlation/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /reject correlation/i })).toBeDefined();
    });
  });
});
