import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DemoCameraTelemetry } from '../demo/cameras';
import { CameraVideoPlayer } from './CameraVideoPlayer';
import { CameraAIDetectionPayload, CameraHealth } from '@ibvap/shared';
import { cameraHealthService } from '../services/cameraHealthService';

interface CameraCardProps {
  camera: DemoCameraTelemetry;
}

export const CameraCard: React.FC<CameraCardProps> = ({ camera }) => {
  const [liveDetCount, setLiveDetCount] = useState<number | null>(null);
  const [liveTrackCount, setLiveTrackCount] = useState<number | null>(null);
  const [health, setHealth] = useState<CameraHealth | null>(camera.health || null);

  useEffect(() => {
    let isMounted = true;
    cameraHealthService.getCameraHealth(camera.id)
      .then((h) => {
        if (isMounted) setHealth(h);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [camera.id]);

  const handleDetectionsUpdate = (payload: CameraAIDetectionPayload) => {
    if (payload.detections) {
      setLiveDetCount(payload.detections.length);
    }
    if (payload.tracks) {
      setLiveTrackCount(payload.tracks.length);
    } else if (payload.activeTracksCount !== undefined) {
      setLiveTrackCount(payload.activeTracksCount);
    }
  };

  const healthState = health?.healthState || 'HEALTHY';
  const visibilityState = health?.visibilityState || 'GOOD';
  const isDegradedOrOffline = healthState === 'DEGRADED' || healthState === 'OFFLINE';

  return (
    <div className={`camera-card ${isDegradedOrOffline ? 'camera-card-degraded' : ''}`}>
      <div className="camera-card-header">
        <div className="camera-title-group">
          <span className="camera-id-badge">{camera.id}</span>
          <span className="camera-name-text" title={camera.name}>
            {camera.name}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span
            className={`health-badge health-${healthState.toLowerCase()}`}
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: healthState === 'HEALTHY' ? 'rgba(16, 185, 129, 0.15)' : healthState === 'DEGRADED' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: healthState === 'HEALTHY' ? '#10b981' : healthState === 'DEGRADED' ? '#f59e0b' : '#ef4444',
              border: `1px solid ${healthState === 'HEALTHY' ? '#10b981' : healthState === 'DEGRADED' ? '#f59e0b' : '#ef4444'}`,
            }}
          >
            {healthState}
          </span>
          <span
            className={`vis-badge vis-${visibilityState.toLowerCase()}`}
            style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: visibilityState === 'GOOD' ? 'rgba(59, 130, 246, 0.12)' : visibilityState === 'DEGRADED' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: visibilityState === 'GOOD' ? '#60a5fa' : visibilityState === 'DEGRADED' ? '#fbbf24' : '#f87171',
              border: `1px solid ${visibilityState === 'GOOD' ? '#3b82f6' : visibilityState === 'DEGRADED' ? '#f59e0b' : '#ef4444'}`,
            }}
          >
            VIS: {visibilityState}
          </span>
        </div>
      </div>

      <CameraVideoPlayer
        cameraId={camera.id}
        cameraName={camera.name}
        videoSrc={camera.sourceReference?.startsWith('/api') ? camera.sourceReference : undefined}
        fps={camera.fps}
        resolution={camera.resolution}
        lensType={camera.lensType}
        autoPlay={true}
        muted={true}
        loop={true}
        showHUD={true}
        showAIOverlays={true}
        showTrajectories={false}
        customOverlayText="REPLAY / LOCAL VIDEO SOURCE"
        onDetectionsUpdate={handleDetectionsUpdate}
      />

      {isDegradedOrOffline && (
        <div
          className="camera-degraded-banner"
          style={{
            padding: '6px 12px',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            borderTop: '1px solid rgba(245, 158, 11, 0.3)',
            fontSize: '0.72rem',
            color: '#fbbf24',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
            ⚠️ {health?.reasons?.[0] || 'Feed degraded'}
          </span>
          <Link
            to={`/coverage`}
            style={{ color: '#60a5fa', fontWeight: 600, textDecoration: 'none', fontSize: '0.7rem' }}
          >
            Alternatives →
          </Link>
        </div>
      )}

      <div className="camera-card-footer">
        <div className="camera-meta-row">
          <div className="camera-meta-item">
            <span style={{ color: 'var(--text-muted)' }}>Sector:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {camera.coverage?.sector || 'General Perimeter'}
            </span>
          </div>
          <div className="camera-meta-item">
            <span style={{ color: 'var(--text-muted)' }}>Active Tracks:</span>
            <span
              style={{
                fontWeight: 700,
                color: liveTrackCount !== null && liveTrackCount > 0 ? '#60a5fa' : (liveDetCount && liveDetCount > 0 ? '#fbbf24' : '#94a3b8'),
              }}
            >
              {liveTrackCount !== null ? `${liveTrackCount} Tracks` : (liveDetCount !== null ? `${liveDetCount} Objects` : 'Scanning...')}
            </span>
          </div>
        </div>

        <div className="camera-meta-row" style={{ fontSize: '0.74rem' }}>
          <span>
            AI Pipeline: <strong>YOLO + ByteTrack</strong>
          </span>
          <span style={{ color: '#10b981', fontWeight: 600 }}>● Active</span>
        </div>

        <Link to={`/cameras/${camera.id}`} className="camera-btn">
          <span>OPEN CAMERA INSPECTOR</span>
          <span>→</span>
        </Link>
      </div>
    </div>
  );
};
