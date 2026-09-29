import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { CameraDetailPage } from '../src/pages/CameraDetailPage';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SystemHealth } from '../src/components/SystemHealth';
import { CameraVideoPlayer } from '../src/components/CameraVideoPlayer';

describe('Phase 3 AI Detection UI & Camera Inspector', () => {
  beforeEach(() => {
    cleanup();
  });

  it('1. Renders Camera Detail Page with YOLO AI telemetry, detection panel, and no track IDs', async () => {
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
      expect(screen.getByText('PIPELINE STATUS')).toBeDefined();
      expect(screen.getByText('SYNCED FRAME / TIME')).toBeDefined();

      // Explicit check: NO identity metadata or global tracking claims
      expect(screen.queryByText(/PERSON #\d+/)).toBeNull();
      expect(screen.queryByText(/GLOBAL_TRACK/i)).toBeNull();
    });
  });

  it('2. Interacts with AI Pause/Resume button', async () => {
    render(
      <MemoryRouter initialEntries={['/cameras/CAM-01']}>
        <Routes>
          <Route path="/cameras/:id" element={<CameraDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    const pauseBtn = screen.getByText('⏸ PAUSE AI');
    expect(pauseBtn).toBeDefined();

    fireEvent.click(pauseBtn);

    await waitFor(() => {
      expect(screen.getByText('▶ RESUME AI')).toBeDefined();
    });
  });

  it('3. Renders SystemHealth with active AI Inference Engine in Phase 3', async () => {
    render(<SystemHealth />);

    await waitFor(() => {
      expect(screen.getByText('AI Inference Engine')).toBeDefined();
      expect(screen.getByText('Phase 3 Active —')).toBeDefined();
      expect(screen.getByText(/YOLOv8 nano local object detection/i)).toBeDefined();
    });
  });

  it('4. Toggles AI Sync Debug HUD overlay in CameraVideoPlayer', async () => {
    render(
      <CameraVideoPlayer
        cameraId="CAM-01"
        cameraName="North Gate"
        interactiveControls={true}
        showDebugHUD={false}
      />
    );

    // Initial state: debug HUD not shown
    expect(screen.queryByText(/AI & BYTETRACK DEBUG HUD/i)).toBeNull();

    // Click DEBUG toggle
    const debugBtn = screen.getByText('DEBUG');
    fireEvent.click(debugBtn);

    // Debug HUD appears with synchronized telemetry metrics
    expect(screen.getByText(/AI & BYTETRACK DEBUG HUD/i)).toBeDefined();
    expect(screen.getByText('VIDEO TIME:')).toBeDefined();
    expect(screen.getByText('AI TIME:')).toBeDefined();
    expect(screen.getByText('SYNC DELTA:')).toBeDefined();
    expect(screen.getByText('FRAME:')).toBeDefined();
  });
});
