import React from 'react';
import { useHealth } from '../hooks/useHealth';
import { config } from '../utils/config';
import { StatusBadge } from '../components/StatusBadge';
import { DEMO_CAMERAS } from '../demo/cameras';

export const SettingsPage: React.FC = () => {
  const { health, loading, error } = useHealth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div className="card-header-flex" style={{ margin: 0 }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              System Configuration &amp; Telemetry Diagnostics
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
              Platform runtime environment, local storage paths, and service health metrics.
            </p>
          </div>
          <span className="demo-tag">PROTOTYPE CONFIG</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {/* System & API Core Information */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: '0.75rem' }}>
            <span>Core System Parameters</span>
          </div>

          <table className="data-table">
            <tbody>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Application Name</td>
                <td><strong>{config.appName} — Intelligent Border Video Analytics Platform</strong></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Platform Version</td>
                <td><span style={{ fontFamily: 'var(--font-mono)' }}>v{config.version} (Phase 1 UI)</span></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>API Endpoint Base</td>
                <td><code>{config.apiBaseUrl}</code></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Backend Health</td>
                <td>
                  {loading ? (
                    <StatusBadge status="loading" label="CHECKING..." />
                  ) : error ? (
                    <StatusBadge status="error" label="OFFLINE / UNREACHABLE" />
                  ) : (
                    <StatusBadge status="ok" label={`ONLINE (${health?.service || 'ibvap-backend'})`} />
                  )}
                </td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Operational Mode</td>
                <td><span style={{ color: '#60a5fa', fontWeight: 700 }}>LOCAL PROTOTYPE MODE</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Local Storage & Forensic Directories */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: '0.75rem' }}>
            <span>Storage &amp; Data Volumes</span>
          </div>

          <table className="data-table">
            <tbody>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Video Recordings</td>
                <td><code>./data/videos/</code></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Frame Snapshots</td>
                <td><code>./data/snapshots/</code></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Forensic Evidence</td>
                <td><code>./data/evidence/</code></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Database Engine</td>
                <td><code>SQLite 3 (./data/ibvap_dev.sqlite)</code></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Persistence Mode</td>
                <td><span style={{ color: '#10b981', fontWeight: 700 }}>LOCAL-FIRST STORAGE</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Camera Fleet Diagnostics */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: '0.75rem' }}>
            <span>Sensor Fleet Summary</span>
          </div>

          <table className="data-table">
            <tbody>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Registered Sensors</td>
                <td><strong>{DEMO_CAMERAS.length} Multi-Spectrum Cameras</strong></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Optical HD Sensors</td>
                <td><span>4 Sensors</span></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Thermal FLIR Sensors</td>
                <td><span>2 Sensors</span></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Sterile Zones Covered</td>
                <td><span>5 Monitored Sectors</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Prototype Roadmap Notice */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: '0.75rem' }}>
            <span>Architecture Roadmap &amp; Phase Status</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Phase 0: Technical Architecture &amp; Database</span>
              <StatusBadge status="ok" label="COMPLETE" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Phase 1: Operator Command Center UI</span>
              <StatusBadge status="ok" label="COMPLETE" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Phase 2: Video Ingestion &amp; YOLO Detection</span>
              <StatusBadge status="disabled" label="PLANNED" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Phase 3: Multi-Object Tracking &amp; Zone Rules</span>
              <StatusBadge status="disabled" label="PLANNED" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Phase 4: Incident Correlation &amp; Analytics</span>
              <StatusBadge status="disabled" label="PLANNED" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
