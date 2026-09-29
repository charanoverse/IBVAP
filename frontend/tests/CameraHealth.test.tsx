import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CameraCard } from '../src/components/CameraCard';
import { CameraDetailPage } from '../src/pages/CameraDetailPage';
import { CoveragePage } from '../src/pages/CoveragePage';
import { cameraHealthService } from '../src/services/cameraHealthService';
import { coverageService } from '../src/services/coverageService';
import { DEMO_CAMERAS } from '../src/demo/cameras';
import { CameraHealth, ZoneCoverageStatus, AlternativeViewRecommendation } from '@ibvap/shared';

const mockHealthNominal: CameraHealth = {
  cameraId: 'CAM-01',
  isOnline: true,
  healthState: 'HEALTHY',
  visibilityState: 'GOOD',
  streamStatus: 'AVAILABLE',
  sourceAvailable: true,
  effectiveFps: 24.0,
  expectedFps: 24.0,
  frameFreshnessMs: 42,
  frozenFrameDetected: false,
  metrics: {
    brightness: 135.2,
    contrast: 43.2,
    blurScore: 466.0,
    frameDifference: 2.66,
  },
  reasons: ['Stream active at 24.0 FPS.', 'Brightness (135.2) and contrast (43.2) nominal.'],
  isSimulated: false,
  measuredAt: new Date().toISOString(),
};

const mockHealthDegraded: CameraHealth = {
  cameraId: 'CAM-03',
  isOnline: true,
  healthState: 'DEGRADED',
  visibilityState: 'POOR',
  streamStatus: 'AVAILABLE',
  sourceAvailable: true,
  effectiveFps: 24.0,
  expectedFps: 24.0,
  frameFreshnessMs: 45,
  frozenFrameDetected: false,
  metrics: {
    brightness: 129.1,
    contrast: 33.1,
    blurScore: 22.4, // Degraded blur
    frameDifference: 0.36,
  },
  reasons: ['[SIMULATION] Severe optical defocus / lens obstruction detected'],
  isSimulated: true,
  simulatedReason: '[SIMULATION] Severe optical defocus / lens obstruction detected',
  measuredAt: new Date().toISOString(),
};

const mockAlternativeRecs: AlternativeViewRecommendation[] = [
  {
    id: 'REC-CAM03-ZONE01-CAM04',
    affectedCameraId: 'CAM-03',
    zoneId: 'ZONE-CAM03-RESTRICTED',
    zoneName: 'Restricted Sterile Buffer Zone',
    recommendedCameraId: 'CAM-04',
    recommendedCameraName: 'South Egress Barrier',
    status: 'AVAILABLE',
    rank: 1,
    reason:
      'Primary camera Sterile Zone East (CAM-03) is degraded. Recommended alternative South Egress Barrier (CAM-04) covers "Restricted Sterile Buffer Zone" with 85% calibrated coverage quality (supporting view). Camera is currently HEALTHY with GOOD visibility. [Coverage-based view recommendation; does not imply biometric identity continuity].',
    factors: {
      sameZoneCoverage: true,
      configuredCoverageQuality: 0.85,
      healthState: 'HEALTHY',
      visibilityState: 'GOOD',
      sourceAvailable: true,
    },
    createdAt: new Date().toISOString(),
  },
];

const mockCoverageStatuses: ZoneCoverageStatus[] = [
  {
    zoneId: 'ZONE-CAM03-RESTRICTED',
    zoneName: 'Restricted Sterile Buffer Zone',
    coverageState: 'DEGRADED',
    primaryCameras: ['CAM-03'],
    supportingCameras: ['CAM-04', 'CAM-05'],
    activePrimaryCount: 0,
    usableAlternativeCount: 2,
    recommendations: mockAlternativeRecs,
    updatedAt: new Date().toISOString(),
  },
  {
    zoneId: 'ZONE-CAM01-GATEWAY',
    zoneName: 'North Gate Perimeter Zone',
    coverageState: 'HEALTHY',
    primaryCameras: ['CAM-01'],
    supportingCameras: ['CAM-02'],
    activePrimaryCount: 1,
    usableAlternativeCount: 1,
    recommendations: [],
    updatedAt: new Date().toISOString(),
  },
];

describe('Phase 8: Frontend Camera Health, Visibility & Coverage UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. CameraCard Component', () => {
    it('renders health badge and visibility badge for nominal camera', async () => {
      vi.spyOn(cameraHealthService, 'getCameraHealth').mockResolvedValue(mockHealthNominal as any);

      render(
        <MemoryRouter>
          <CameraCard camera={DEMO_CAMERAS[0]} />
        </MemoryRouter>
      );

      expect(screen.getAllByText('CAM-01').length).toBeGreaterThan(0);
      await waitFor(() => {
        expect(screen.getByText('HEALTHY')).toBeDefined();
        expect(screen.getByText('VIS: GOOD')).toBeDefined();
      });
    });

    it('renders degraded notice banner and alternative link when camera is degraded', async () => {
      vi.spyOn(cameraHealthService, 'getCameraHealth').mockResolvedValue(mockHealthDegraded as any);

      render(
        <MemoryRouter>
          <CameraCard camera={{ ...DEMO_CAMERAS[2], health: mockHealthDegraded }} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('DEGRADED')).toBeDefined();
        expect(screen.getByText('VIS: POOR')).toBeDefined();
        expect(screen.getByText(/Alternatives →/i)).toBeDefined();
      });
    });
  });

  describe('2. CameraDetailPage Health & Simulation Telemetry', () => {
    it('renders health & visibility tab with optical metrics and stream telemetry', async () => {
      vi.spyOn(cameraHealthService, 'getCameraHealth').mockResolvedValue({
        ...mockHealthNominal,
        recentTransitions: [
          {
            id: 'TRANS-1',
            camera_id: 'CAM-01',
            previous_state: 'UNKNOWN',
            new_state: 'HEALTHY',
            reason: 'Stream active at 24.0 FPS.',
            is_simulated: 0,
            timestamp: new Date().toISOString(),
          },
        ],
      } as any);

      vi.spyOn(coverageService, 'getAlternativeRecommendations').mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={['/cameras/CAM-01']}>
          <Routes>
            <Route path="/cameras/:id" element={<CameraDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      // Verify health badge in header
      await waitFor(() => {
        expect(screen.getByText(/HEALTH: HEALTHY/i)).toBeDefined();
        expect(screen.getByText(/VIS: GOOD/i)).toBeDefined();
      });

      // Switch to HEALTH & VISIBILITY tab
      const healthTabBtn = screen.getByRole('button', { name: /HEALTH & VISIBILITY TELEMETRY/i });
      fireEvent.click(healthTabBtn);

      await waitFor(() => {
        expect(screen.getByText('STREAM AVAILABILITY')).toBeDefined();
        expect(screen.getByText('EFFECTIVE FRAME RATE')).toBeDefined();
        expect(screen.getByText('FRAME FRESHNESS')).toBeDefined();
        expect(screen.getByText('MOTION / FROZEN DETECTOR')).toBeDefined();
        expect(screen.getByText(/Mean Luminance \(Brightness\)/i)).toBeDefined();
        expect(screen.getByText(/Luminance Std Dev \(Contrast\)/i)).toBeDefined();
        expect(screen.getByText(/Laplacian Sharpness \(Focus\)/i)).toBeDefined();
      });
    });

    it('renders simulation controls and triggers simulation / restoration handlers', async () => {
      vi.spyOn(cameraHealthService, 'getCameraHealth').mockResolvedValue(mockHealthDegraded as any);
      const simSpy = vi.spyOn(cameraHealthService, 'simulateDegradation').mockResolvedValue(mockHealthDegraded);
      const restoreSpy = vi.spyOn(cameraHealthService, 'restoreCamera').mockResolvedValue(mockHealthNominal);
      vi.spyOn(coverageService, 'getAlternativeRecommendations').mockResolvedValue(mockAlternativeRecs);

      render(
        <MemoryRouter initialEntries={['/cameras/CAM-03']}>
          <Routes>
            <Route path="/cameras/:id" element={<CameraDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Simulation Controls \(Dev \/ Demo\)/i)).toBeDefined();
        expect(screen.getByText(/Alternative View Recommendations/i)).toBeDefined();
        expect(screen.getAllByText(/South Egress Barrier/i).length).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: /SWITCH TO CAM-04/i })).toBeDefined();
      });

      // Click Simulate Blur
      const blurBtn = screen.getByRole('button', { name: /Lens Blur/i });
      fireEvent.click(blurBtn);
      await waitFor(() => {
        expect(simSpy).toHaveBeenCalledWith('CAM-03', 'BLUR', expect.any(String));
      });

      // Click Restore Nominal Telemetry
      const restoreBtn = await screen.findByRole('button', { name: /Restore Nominal Telemetry/i });
      fireEvent.click(restoreBtn);
      await waitFor(() => {
        expect(restoreSpy).toHaveBeenCalledWith('CAM-03');
      });
    });
  });

  describe('3. CoveragePage & Blind-Spot Intelligence', () => {
    it('renders declarative zone coverage matrix and alternative recommendations', async () => {
      vi.spyOn(coverageService, 'getCoverageHealth').mockResolvedValue(mockCoverageStatuses);
      vi.spyOn(cameraHealthService, 'getAllCamerasHealth').mockResolvedValue({
        'CAM-01': mockHealthNominal,
        'CAM-03': mockHealthDegraded,
      });

      render(
        <MemoryRouter>
          <CoveragePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Perimeter Coverage, Blind-Spot Intelligence/i)).toBeDefined();
        expect(screen.getByText('ZONE-CAM03-RESTRICTED')).toBeDefined();
        expect(screen.getByText('Restricted Sterile Buffer Zone')).toBeDefined();
        expect(screen.getByText('ZONE-CAM01-GATEWAY')).toBeDefined();
        expect(screen.getByRole('button', { name: /Open CAM-04 View →/i })).toBeDefined();
      });
    });

    it('displays operational non-biometric safety disclaimer', async () => {
      vi.spyOn(coverageService, 'getCoverageHealth').mockResolvedValue(mockCoverageStatuses);
      vi.spyOn(cameraHealthService, 'getAllCamerasHealth').mockResolvedValue({});

      render(
        <MemoryRouter>
          <CoveragePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByText(
            /IBVAP explicitly does NOT perform person re-identification, face recognition, or biometric tracking across camera views/i
          )
        ).toBeDefined();
      });
    });
  });
});
