import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CoverageMap } from '../components/CoverageMap';
import { coverageService } from '../services/coverageService';
import { cameraHealthService } from '../services/cameraHealthService';
import { ZoneCoverageStatus, CameraHealth } from '@ibvap/shared';

export const CoveragePage: React.FC = () => {
  const navigate = useNavigate();
  const [coverageData, setCoverageData] = useState<ZoneCoverageStatus[]>([]);
  const [camerasHealth, setCamerasHealth] = useState<Record<string, CameraHealth>>({});

  const loadData = () => {
    Promise.all([
      coverageService.getCoverageHealth().catch(() => []),
      cameraHealthService.getAllCamerasHealth().catch(() => ({})),
    ])
      .then(([cov, health]) => {
        setCoverageData(cov);
        setCamerasHealth(health);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadData();

    // Listen for live SSE health transitions
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events/live/ALL');
      eventSource.addEventListener('camera_health_updated', () => {
        loadData();
      });
    } catch {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const totalZones = coverageData.length;
  const healthyCount = coverageData.filter((z) => z.coverageState === 'HEALTHY').length;
  const degradedCount = coverageData.filter((z) => z.coverageState === 'DEGRADED').length;
  const blindSpotCount = coverageData.filter((z) => z.coverageState === 'BLIND_SPOT_RISK').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div className="card-header-flex" style={{ margin: 0 }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Perimeter Geospatial Coverage &amp; Blind-Spot Analysis
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
              Perimeter Coverage, Blind-Spot Intelligence &amp; Alternative Usable Views — monitors primary camera availability, detects perimeter blind-spots, and recommends ranked usable alternative views.
            </p>
          </div>
          <span className="demo-tag" style={{ color: '#60a5fa', borderColor: '#3b82f6' }}>
            PHASE 8 COVERAGE MODEL
          </span>
        </div>
      </div>

      {/* High-Level Coverage KPI Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <div className="card" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CONFIGURED COVERAGE ZONES</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#93c5fd', marginTop: '0.2rem' }}>
            {totalZones || 6}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Border sectors monitored</div>
        </div>

        <div className="card" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>NOMINAL COVERAGE</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>
            {healthyCount}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Primary cameras healthy &amp; visible</div>
        </div>

        <div className="card" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>DEGRADED / ALTERNATIVE ACTIVE</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>
            {degradedCount}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Supporting view backing up primary</div>
        </div>

        <div className="card" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>BLIND-SPOT RISK</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: blindSpotCount > 0 ? '#ef4444' : '#10b981', marginTop: '0.2rem' }}>
            {blindSpotCount}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>No usable camera covering zone</div>
        </div>
      </div>

      {/* Interactive 2D Map Component */}
      <CoverageMap />

      {/* Zone Coverage & Blind-Spot Intelligence Matrix */}
      <div className="card">
        <div className="card-header-flex">
          <div className="card-title">
            <span>Perimeter Security Sectors &amp; Sterile Zones</span>
            <span className="demo-tag">{totalZones} ZONES MONITORED</span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Zone Code &amp; Name</th>
                <th>Coverage State</th>
                <th>Primary Camera(s)</th>
                <th>Supporting Camera(s)</th>
                <th>Active Recommendations / Blind-Spot Rationale</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coverageData.map((zone) => {
                const isRisk = zone.coverageState === 'BLIND_SPOT_RISK';
                const isDegraded = zone.coverageState === 'DEGRADED';

                return (
                  <tr key={zone.zoneId} style={{ backgroundColor: isRisk ? 'rgba(239, 68, 68, 0.08)' : isDegraded ? 'rgba(245, 158, 11, 0.05)' : undefined }}>
                    <td style={{ verticalAlign: 'top' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#93c5fd', fontSize: '0.8rem' }}>
                        {zone.zoneId}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                        {zone.zoneName}
                      </div>
                    </td>

                    <td style={{ verticalAlign: 'top' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor:
                            zone.coverageState === 'HEALTHY'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : isDegraded
                              ? 'rgba(245, 158, 11, 0.2)'
                              : 'rgba(239, 68, 68, 0.2)',
                          color:
                            zone.coverageState === 'HEALTHY'
                              ? '#10b981'
                              : isDegraded
                              ? '#f59e0b'
                              : '#ef4444',
                          border: `1px solid ${
                            zone.coverageState === 'HEALTHY'
                              ? '#10b981'
                              : isDegraded
                              ? '#f59e0b'
                              : '#ef4444'
                          }`,
                        }}
                      >
                        {zone.coverageState}
                      </span>
                    </td>

                    <td style={{ verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {zone.primaryCameras.map((pCamId) => {
                          const h = camerasHealth[pCamId];
                          const hState = h?.healthState || 'HEALTHY';
                          return (
                            <div key={pCamId} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem' }}>
                              <strong style={{ color: '#93c5fd' }}>{pCamId}</strong>
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                  backgroundColor: hState === 'HEALTHY' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                  color: hState === 'HEALTHY' ? '#10b981' : '#f87171',
                                }}
                              >
                                {hState}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    <td style={{ verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {zone.supportingCameras.map((sCamId) => {
                          const h = camerasHealth[sCamId];
                          const hState = h?.healthState || 'HEALTHY';
                          return (
                            <span
                              key={sCamId}
                              style={{
                                fontSize: '0.7rem',
                                fontFamily: 'var(--font-mono)',
                                padding: '2px 5px',
                                borderRadius: '3px',
                                backgroundColor: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                color: hState === 'HEALTHY' ? '#a5b4fc' : '#f59e0b',
                              }}
                            >
                              {sCamId}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    <td style={{ verticalAlign: 'top', maxWidth: '340px' }}>
                      {zone.recommendations.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {zone.recommendations.map((rec) => (
                            <div
                              key={rec.id}
                              style={{
                                padding: '0.4rem 0.5rem',
                                backgroundColor: 'var(--bg-secondary)',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                fontSize: '0.72rem',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                                <span style={{ color: '#60a5fa' }}>{rec.recommendedCameraId}</span>
                                <span style={{ color: rec.status === 'AVAILABLE' ? '#10b981' : '#f59e0b' }}>
                                  {rec.status} ({Math.round((rec.factors?.configuredCoverageQuality || 0) * 100)}%)
                                </span>
                              </div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', marginTop: '0.2rem' }}>
                                {rec.reason}
                              </div>
                              {rec.recommendedCameraId && (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/cameras/${rec.recommendedCameraId}`)}
                                  className="btn btn-outline"
                                  style={{
                                    fontSize: '0.65rem',
                                    padding: '0.15rem 0.4rem',
                                    marginTop: '0.3rem',
                                    borderColor: '#3b82f6',
                                    color: '#60a5fa',
                                  }}
                                >
                                  Open {rec.recommendedCameraId} View →
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.74rem', color: '#10b981' }}>
                          ✓ Primary camera coverage nominal. No blind spots detected.
                        </span>
                      )}
                    </td>

                    <td style={{ verticalAlign: 'top' }}>
                      <button
                        type="button"
                        onClick={() => navigate(`/cameras/${zone.primaryCameras[0]}`)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                      >
                        Inspect Camera →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Strict Non-Biometric Boundary Disclaimer */}
        <div
          style={{
            margin: '1rem',
            padding: '0.65rem 1rem',
            backgroundColor: 'rgba(30, 41, 59, 0.4)',
            borderRadius: '4px',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
          }}
        >
          <strong>Operational Boundary Notice:</strong> Alternative usable view recommendations are strictly coverage- and availability-based (FOV geometry, primary/supporting roles, optical visibility scores). IBVAP explicitly does NOT perform person re-identification, face recognition, or biometric tracking across camera views.
        </div>
      </div>
    </div>
  );
};
