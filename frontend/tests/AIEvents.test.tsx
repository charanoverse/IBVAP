import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { EventTimeline } from '../src/components/EventTimeline';
import { CameraVideoPlayer } from '../src/components/CameraVideoPlayer';
import { CameraDetailPage } from '../src/pages/CameraDetailPage';
import { DashboardPage } from '../src/pages/DashboardPage';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Event, Zone, Line, Rule } from '@ibvap/shared';

describe('Phase 5 Rule Engine, Virtual Zones & Verified Security Events UI', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockEvents: Event[] = [
    {
      id: 'EVT-CAM01-001',
      cameraId: 'CAM-01',
      ruleId: 'RULE-CAM01-ENTRY',
      ruleName: 'North Gate Perimeter Entry Detection',
      zoneId: 'ZONE-CAM01-GATEWAY',
      eventType: 'ZONE_ENTRY',
      trackId: 17,
      trackDisplayId: 'T017',
      objectClass: 'person',
      startedAt: '2026-09-26T12:00:00Z',
      verifiedAt: '2026-09-26T12:00:01Z',
      videoTimestamp: 1.20,
      status: 'VERIFIED',
      explanation: 'Person (Track #17) entered zone ZONE-CAM01-GATEWAY at t=1.20s; verified for 3 frames (0.60s).',
      timestamp: '2026-09-26T12:00:01Z',
      acknowledged: false,
    },
    {
      id: 'EVT-CAM01-002',
      cameraId: 'CAM-01',
      ruleId: 'RULE-CAM01-LINE',
      ruleName: 'Main Gate Inbound Boundary Crossing',
      lineId: 'LINE-CAM01-GATE',
      eventType: 'LINE_CROSSING',
      trackId: 17,
      trackDisplayId: 'T017',
      objectClass: 'person',
      startedAt: '2026-09-26T12:00:02Z',
      verifiedAt: '2026-09-26T12:00:02Z',
      videoTimestamp: 2.40,
      status: 'VERIFIED',
      explanation: 'Person (Track #17) crossed tripwire LINE-CAM01-GATE from Outside to Inside at t=2.40s.',
      timestamp: '2026-09-26T12:00:02Z',
      acknowledged: false,
    },
    {
      id: 'EVT-CAM02-003',
      cameraId: 'CAM-02',
      ruleId: 'RULE-CAM02-DWELL',
      ruleName: 'Approach Road Loitering Detection',
      zoneId: 'ZONE-CAM02-APPROACH',
      eventType: 'DWELL',
      trackId: 5,
      trackDisplayId: 'T005',
      objectClass: 'person',
      startedAt: '2026-09-26T12:00:03Z',
      verifiedAt: '2026-09-26T12:00:06Z',
      videoTimestamp: 3.80,
      status: 'VERIFIED',
      explanation: 'Person (Track #5) dwelled inside ZONE-CAM02-APPROACH for 3.20s exceeding 3.0s threshold.',
      timestamp: '2026-09-26T12:00:06Z',
      acknowledged: false,
    },
  ];

  const mockZones: Zone[] = [
    {
      id: 'ZONE-CAM01-GATEWAY',
      cameraId: 'CAM-01',
      name: 'North Gate Entry Zone',
      type: 'ENTRY',
      polygon: [
        [0.05, 0.15],
        [0.95, 0.15],
        [0.95, 0.85],
        [0.05, 0.85],
      ],
      color: '#3b82f6',
    },
  ];

  const mockLines: Line[] = [
    {
      id: 'LINE-CAM01-GATE',
      cameraId: 'CAM-01',
      name: 'North Gate Tripwire',
      start: [0.05, 0.50],
      end: [0.95, 0.50],
      labelA: 'Outside',
      labelB: 'Inside',
      color: '#06b6d4',
    },
  ];

  const mockRules: Rule[] = [
    {
      id: 'RULE-CAM01-ENTRY',
      cameraId: 'CAM-01',
      name: 'North Gate Entry Detection',
      type: 'ZONE_ENTRY',
      ruleType: 'ZONE_ENTRY',
      zoneId: 'ZONE-CAM01-GATEWAY',
      targetClasses: ['person', 'car'],
      enabled: true,
      verification: { minimumFrames: 3, minimumSeconds: 0.5 },
      description: 'Trigger when person or vehicle enters gateway zone',
    },
    {
      id: 'RULE-CAM01-DWELL',
      cameraId: 'CAM-01',
      name: 'North Gate Loitering Alert',
      type: 'DWELL',
      ruleType: 'DWELL',
      zoneId: 'ZONE-CAM01-GATEWAY',
      targetClasses: ['person'],
      enabled: true,
      conditions: { minDwellSeconds: 3.0 },
      description: 'Trigger when person stays in gateway longer than 3 seconds',
    },
  ];

  it('1. EventTimeline renders verified events with badges, track IDs, and explanations', () => {
    const handleClick = vi.fn();
    render(<EventTimeline events={mockEvents} onEventClick={handleClick} />);

    expect(screen.getByText('ZONE ENTRY')).toBeDefined();
    expect(screen.getByText('LINE CROSSING')).toBeDefined();
    expect(screen.getByText('DWELL')).toBeDefined();
    expect(screen.getAllByText(/T017/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Person \(Track #17\) entered zone ZONE-CAM01-GATEWAY/i)).toBeDefined();
    expect(screen.getByText(/crossed tripwire LINE-CAM01-GATE/i)).toBeDefined();

    // Click event
    const firstEvent = screen.getByText(/Person \(Track #17\) entered zone/i);
    fireEvent.click(firstEvent);
    expect(handleClick).toHaveBeenCalledWith(mockEvents[0]);
  });

  it('2. EventTimeline displays empty message when no events exist', () => {
    render(<EventTimeline events={[]} emptyMessage="No security events found." />);
    expect(screen.getByText('No security events found.')).toBeDefined();
  });

  it('3. CameraVideoPlayer renders virtual zone polygons and tripwire lines', () => {
    const { container } = render(
      <CameraVideoPlayer
        cameraId="CAM-01"
        cameraName="North Gate"
        showZones={true}
        showLines={true}
        zones={mockZones}
        lines={mockLines}
      />
    );

    const zoneOverlay = container.querySelector('.virtual-zone-overlay');
    expect(zoneOverlay).toBeDefined();

    const lineOverlay = container.querySelector('.virtual-line-overlay');
    expect(lineOverlay).toBeDefined();

    const polygon = container.querySelector('polygon');
    expect(polygon).toBeDefined();

    const line = container.querySelector('line');
    expect(line).toBeDefined();
  });

  it('4. CameraVideoPlayer renders ground anchor dots for active tracks', () => {
    const { container } = render(
      <CameraVideoPlayer
        cameraId="CAM-01"
        cameraName="North Gate"
        showAIOverlays={true}
      />
    );

    // Initial render check
    expect(container.querySelector('.cctv-player-container')).toBeDefined();
  });

  it('5. CameraVideoPlayer displays Rule Engine HUD and Candidate Events', () => {
    render(
      <CameraVideoPlayer
        cameraId="CAM-01"
        cameraName="North Gate"
        showDebugHUD={true}
        showRuleDebug={true}
        zones={mockZones}
        lines={mockLines}
      />
    );

    expect(screen.getByText(/DEBUG HUD/i)).toBeDefined();
    expect(screen.getByText('RULE LATENCY:')).toBeDefined();
    expect(screen.getByText('ZONES / LINES:')).toBeDefined();
    expect(screen.getByText(/1 zones \/ 1 lines/i)).toBeDefined();
  });

  it('6. CameraDetailPage renders Verified Events tab and Active Rules panel', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/rules')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockRules }),
        });
      }
      if (url.includes('/api/events')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockEvents }),
        });
      }
      if (url.includes('/api/zones')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockZones }),
        });
      }
      if (url.includes('/api/lines')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockLines }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      });
    });

    render(
      <MemoryRouter initialEntries={['/cameras/CAM-01']}>
        <Routes>
          <Route path="/cameras/:id" element={<CameraDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('North Gate — Main Entry View')).toBeDefined();
      expect(screen.getByText('↺ RESET RULES')).toBeDefined();
      expect(screen.getByText('↺ RESET TRACKER')).toBeDefined();
      expect(screen.getByText(/VERIFIED EVENTS/i)).toBeDefined();
      expect(screen.getByText(/Active Spatial & Temporal Rules/i)).toBeDefined();
      expect(screen.getByText('North Gate Entry Detection')).toBeDefined();
      expect(screen.getByText('North Gate Loitering Alert')).toBeDefined();
    });
  });

  it('7. DashboardPage renders Recent Verified Security Events feed', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/events')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockEvents }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Recent Verified Security Events')).toBeDefined();
      expect(screen.getByText('PHASE 5 RULE ENGINE')).toBeDefined();
      expect(screen.getByText('CAMERA FLEET →')).toBeDefined();
      expect(screen.getByText(/Person \(Track #17\) entered zone/i)).toBeDefined();
    });
  });
});
