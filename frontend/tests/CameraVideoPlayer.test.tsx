import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CameraVideoPlayer } from '../src/components/CameraVideoPlayer';

describe('CameraVideoPlayer Component (Phase 3 AI Ingestion & YOLO Overlays)', () => {
  beforeEach(() => {
    cleanup();
  });

  it('1. Renders HTML5 video element with correct source endpoint', () => {
    const { container } = render(
      <CameraVideoPlayer
        cameraId="CAM-01"
        cameraName="North Gate — Main Entry View"
        fps={30}
        resolution="1080p @ 30fps"
        lensType="OPTICAL HD"
      />
    );

    const videoEl = container.querySelector('video');
    expect(videoEl).toBeDefined();
    expect(videoEl?.getAttribute('src')).toBe('/api/cameras/CAM-01/video');
    expect(videoEl?.hasAttribute('autoplay')).toBe(true);
    expect(videoEl?.hasAttribute('playsinline')).toBe(true);
  });

  it('2. Renders HUD telemetry, REC indicator, and Phase 3 AI status badge', () => {
    render(
      <CameraVideoPlayer
        cameraId="CAM-02"
        cameraName="North Corridor — Approach Line"
        fps={25}
        resolution="1080p @ 25fps"
        lensType="OPTICAL HD"
        showHUD={true}
      />
    );

    expect(screen.getByText('CAM-02')).toBeDefined();
    expect(screen.getByText('OPTICAL HD')).toBeDefined();
    expect(screen.getByText('25 FPS')).toBeDefined();
    expect(screen.getByText('REC')).toBeDefined();
    expect(screen.getByText('REPLAY / LOCAL VIDEO SOURCE')).toBeDefined();

    // Ensure no fake bounding boxes exist
    expect(screen.queryByText(/PERSON: 0\.\d+/)).toBeNull();
    expect(screen.queryByText(/VEHICLE: 0\.\d+/)).toBeNull();
    expect(screen.queryByText(/PERSON #\d+/)).toBeNull();
  });

  it('3. Renders interactive playback controls and AI control button when enabled', () => {
    render(
      <CameraVideoPlayer
        cameraId="CAM-03"
        cameraName="Restricted Sterile Zone"
        fps={24}
        resolution="1080p @ 24fps"
        lensType="THERMAL FLIR"
        interactiveControls={true}
      />
    );

    expect(screen.getByTitle('Restart Replay')).toBeDefined();
    expect(screen.getByTitle('Capture Snapshot Frame')).toBeDefined();
    expect(screen.getByTitle('Fullscreen')).toBeDefined();
    expect(screen.getByText('AI PAUSE')).toBeDefined();
    expect(screen.getByText('0.5x')).toBeDefined();
    expect(screen.getByText('1x')).toBeDefined();
    expect(screen.getByText('1.5x')).toBeDefined();
    expect(screen.getByText('2x')).toBeDefined();
    expect(screen.getByText('SNAPSHOT')).toBeDefined();
  });

  it('4. Renders error banner and retry button when stream fails', () => {
    const { container } = render(
      <CameraVideoPlayer
        cameraId="CAM-ERROR-TEST"
        cameraName="Faulty Camera"
      />
    );

    const videoEl = container.querySelector('video');
    expect(videoEl).toBeDefined();

    // Trigger video error event
    if (videoEl) {
      fireEvent.error(videoEl);
    }

    expect(screen.getByText('VIDEO FEED UNAVAILABLE')).toBeDefined();
    expect(screen.getByText('RETRY FEED')).toBeDefined();
  });
});
