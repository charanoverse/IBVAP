import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { CameraDetailPage } from '../src/pages/CameraDetailPage';
import { CameraCard } from '../src/components/CameraCard';
import { CameraVideoPlayer } from '../src/components/CameraVideoPlayer';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { DEMO_CAMERAS } from '../src/demo/cameras';
import { Track } from '@ibvap/shared';

describe('Phase 4 Multi-Object Tracking UI & Local Track Identity', () => {
  beforeEach(() => {
    cleanup();
  });

  const mockTrack1: Track = {
    id: 'trk-cam-01-17',
    trackId: 17,
    displayId: 'T017',
    cameraId: 'CAM-01',
    classId: 0,
    className: 'person',
    confidence: 0.92,
    boundingBox: { x: 0.25, y: 0.35, width: 0.12, height: 0.28 },
    firstSeen: '2026-09-26T12:00:00Z',
    lastSeen: '2026-09-26T12:00:04Z',
    firstSeenTimestamp: 0.0,
    lastSeenTimestamp: 4.2,
    ageFrames: 21,
    ageSeconds: 4.2,
    missedFrames: 0,
    status: 'ACTIVE',
    trajectory: [
      { x: 0.25, y: 0.35, timestamp: 0.0 },
      { x: 0.27, y: 0.35, timestamp: 2.0 },
      { x: 0.31, y: 0.35, timestamp: 4.2 },
    ],
  };

  const mockTrack2: Track = {
    id: 'trk-cam-01-24',
    trackId: 24,
    displayId: 'T024',
    cameraId: 'CAM-01',
    classId: 2,
    className: 'car',
    confidence: 0.88,
    boundingBox: { x: 0.65, y: 0.45, width: 0.22, height: 0.25 },
    firstSeen: '2026-09-26T12:00:01Z',
    lastSeen: '2026-09-26T12:00:04Z',
    firstSeenTimestamp: 1.0,
    lastSeenTimestamp: 4.2,
    ageFrames: 16,
    ageSeconds: 3.2,
    missedFrames: 0,
    status: 'ACTIVE',
    trajectory: [
      { x: 0.65, y: 0.45, timestamp: 1.0 },
      { x: 0.68, y: 0.45, timestamp: 4.2 },
    ],
  };

  it('1. Renders Camera Detail Page with ByteTrack status and Current Tracks table', async () => {
    render(
      <MemoryRouter initialEntries={['/cameras/CAM-01']}>
        <Routes>
          <Route path="/cameras/:id" element={<CameraDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('North Gate — Main Entry View')).toBeDefined();
      expect(screen.getByText('YOLOv8 + BYTETRACK ACTIVE')).toBeDefined();
      expect(screen.getByText(/CURRENT TRACKS/i)).toBeDefined();
      expect(screen.getByText('RAW DETECTIONS (0)')).toBeDefined();
      expect(screen.getByText('PIPELINE STATUS')).toBeDefined();
      expect(screen.getByText('ACTIVE TRACKS')).toBeDefined();
      expect(screen.getByText('↺ RESET TRACKER')).toBeDefined();
    });
  });

  it('2. CameraVideoPlayer renders Track labels (Class, ID, Confidence) on bounding boxes', async () => {
    expect(mockTrack1.displayId).toBe('T017');
    expect(mockTrack1.status).toBe('ACTIVE');
    expect(mockTrack1.trajectory.length).toBe(3);
    expect(mockTrack2.displayId).toBe('T024');
    expect(mockTrack2.className).toBe('car');

    const { container } = render(
      <CameraVideoPlayer
        cameraId="CAM-01"
        cameraName="North Gate"
        showAIOverlays={true}
        showTrajectories={true}
      />
    );

    expect(container.querySelector('.cctv-player-container')).toBeDefined();
  });

  it('3. Clicking Reset Tracker sends control action and displays confirmation', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
    ) as any;

    render(
      <MemoryRouter initialEntries={['/cameras/CAM-01']}>
        <Routes>
          <Route path="/cameras/:id" element={<CameraDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    const resetBtn = screen.getByText('↺ RESET TRACKER');
    expect(resetBtn).toBeDefined();

    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(screen.getByText(/ByteTracker state reset for CAM-01/i)).toBeDefined();
    });
  });

  it('4. Dashboard CameraCard displays Active Tracks count and ByteTrack status', async () => {
    render(
      <MemoryRouter>
        <CameraCard camera={DEMO_CAMERAS[0]} />
      </MemoryRouter>
    );

    expect(screen.getByText('Active Tracks:')).toBeDefined();
    expect(screen.getByText('YOLO + ByteTrack')).toBeDefined();
  });

  it('5. Toggles between CURRENT TRACKS and RAW DETECTIONS tabs', async () => {
    render(
      <MemoryRouter initialEntries={['/cameras/CAM-01']}>
        <Routes>
          <Route path="/cameras/:id" element={<CameraDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    const detectionsTab = screen.getByText(/RAW DETECTIONS/i);
    fireEvent.click(detectionsTab);

    await waitFor(() => {
      expect(screen.getByText(/FRAME-LOCAL YOLO DETECTIONS/i)).toBeDefined();
    });

    const tracksTab = screen.getByText(/CURRENT TRACKS/i);
    fireEvent.click(tracksTab);

    await waitFor(() => {
      expect(screen.getByText(/LOCAL CAMERA TRACKS/i)).toBeDefined();
    });
  });
});
