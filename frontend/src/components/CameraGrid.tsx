import React, { useState } from 'react';
import { DemoCameraTelemetry } from '../demo/cameras';
import { CameraCard } from './CameraCard';

interface CameraGridProps {
  cameras: DemoCameraTelemetry[];
  limit?: number;
}

export const CameraGrid: React.FC<CameraGridProps> = ({ cameras, limit }) => {
  const [filter, setFilter] = useState<string>('ALL');

  const filteredCameras = cameras
    .filter((cam) => {
      if (filter === 'ALL') return true;
      if (filter === 'ACTIVE') return cam.status === 'active';
      if (filter === 'THERMAL') return cam.lensType.includes('THERMAL');
      if (filter === 'OPTICAL') return cam.lensType.includes('OPTICAL');
      return true;
    })
    .slice(0, limit || cameras.length);

  return (
    <div className="card">
      <div className="card-header-flex">
        <div className="card-title">
          <span>Surveillance Camera Matrix</span>
          <span className="demo-tag" style={{ color: '#6ee7b7', borderColor: '#059669', background: 'rgba(6, 78, 59, 0.4)' }}>
            LOCAL CCTV REPLAY
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {(['ALL', 'ACTIVE', 'OPTICAL', 'THERMAL'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              style={{
                background: filter === mode ? '#1e3a8a' : 'rgba(255,255,255,0.03)',
                color: filter === mode ? '#93c5fd' : 'var(--text-secondary)',
                border: filter === mode ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="camera-grid">
        {filteredCameras.map((camera) => (
          <CameraCard key={camera.id} camera={camera} />
        ))}
      </div>
    </div>
  );
};
