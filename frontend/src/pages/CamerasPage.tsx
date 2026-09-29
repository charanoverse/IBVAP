import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_CAMERAS, DemoCameraTelemetry } from '../demo/cameras';
import { StatusBadge } from '../components/StatusBadge';

export const CamerasPage: React.FC = () => {
  const navigate = useNavigate();
  const [cameras] = useState<DemoCameraTelemetry[]>(DEMO_CAMERAS);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredCameras = cameras.filter((cam) => {
    if (statusFilter !== 'ALL' && cam.status.toUpperCase() !== statusFilter) {
      return false;
    }
    if (typeFilter === 'OPTICAL' && !cam.lensType.includes('OPTICAL')) {
      return false;
    }
    if (typeFilter === 'THERMAL' && !cam.lensType.includes('THERMAL')) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = cam.name.toLowerCase().includes(q);
      const matchId = cam.id.toLowerCase().includes(q);
      const matchSector = cam.coverage?.sector?.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchSector) return false;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div className="card-header-flex" style={{ margin: 0 }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Perimeter Surveillance Camera Fleet
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
              Real-time telemetry, optical/thermal sensor health, and stream routing directory.
            </p>
          </div>
          <span className="demo-tag">{cameras.length} CONFIGURED SENSORS</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-label">Search:</span>
          <input
            type="text"
            className="filter-input"
            placeholder="Search by ID, name, or sector..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <span className="filter-label">Status:</span>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active (Online)</option>
            <option value="STANDBY">Standby / Degraded</option>
            <option value="INACTIVE">Inactive / Offline</option>
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">Sensor Type:</span>
          <select
            className="filter-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Types</option>
            <option value="OPTICAL">Optical HD</option>
            <option value="THERMAL">Thermal FLIR</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Showing <strong>{filteredCameras.length}</strong> of {cameras.length} cameras
        </div>
      </div>

      {/* Camera Fleet Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Sensor ID</th>
              <th>Camera Name</th>
              <th>Status</th>
              <th>Sensor Type</th>
              <th>FPS</th>
              <th>Visibility</th>
              <th>Sector Coverage</th>
              <th>Last Update</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredCameras.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No cameras match the selected search criteria.
                </td>
              </tr>
            ) : (
              filteredCameras.map((cam) => (
                <tr
                  key={cam.id}
                  onClick={() => navigate(`/cameras/${cam.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#93c5fd' }}>
                    {cam.id}
                  </td>
                  <td style={{ fontWeight: 600 }}>{cam.name}</td>
                  <td>
                    <StatusBadge status={cam.status} />
                  </td>
                  <td>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>
                      {cam.lensType}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{cam.fps}</td>
                  <td>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        color:
                          cam.visibility === 'EXCELLENT' || cam.visibility === 'GOOD'
                            ? '#10b981'
                            : '#f59e0b',
                      }}
                    >
                      {cam.visibility}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{cam.coverage?.sector || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {cam.lastActivity}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/cameras/${cam.id}`);
                      }}
                    >
                      Open Live Feed →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
