import React, { useState } from 'react';
import {
  DEMO_MAP_ZONES,
  DEMO_MAP_CAMERAS,
  DEMO_MAP_TOPOLOGY_LINKS,
  MapCameraMarker,
  MapZone,
} from '../demo/coverage';
import { StatusBadge } from './StatusBadge';

export const CoverageMap: React.FC = () => {
  const [selectedCamId, setSelectedCamId] = useState<string>('CAM-03');
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [showTopologyOverlay, setShowTopologyOverlay] = useState<boolean>(true);
  const [showFovCones, setShowFovCones] = useState<boolean>(true);

  const selectedCamera = DEMO_MAP_CAMERAS.find((c) => c.id === selectedCamId) || DEMO_MAP_CAMERAS[0];
  const selectedLink = DEMO_MAP_TOPOLOGY_LINKS.find((l) => l.id === selectedLinkId) || null;

  // Helper to calculate SVG polygon points for a camera FOV cone
  const getFovConePath = (cam: MapCameraMarker) => {
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const startAngle = cam.azimuth - cam.fov / 2 - 90;
    const endAngle = cam.azimuth + cam.fov / 2 - 90;

    const x1 = cam.x + cam.range * Math.cos(rad(startAngle));
    const y1 = cam.y + cam.range * Math.sin(rad(startAngle));
    const x2 = cam.x + cam.range * Math.cos(rad(endAngle));
    const y2 = cam.y + cam.range * Math.sin(rad(endAngle));

    return `M ${cam.x} ${cam.y} L ${x1} ${y1} A ${cam.range} ${cam.range} 0 0 1 ${x2} ${y2} Z`;
  };

  const getPolygonPointsString = (zone: MapZone) => {
    return zone.polygon.map((p) => `${p.x},${p.y}`).join(' ');
  };

  const getCameraCoord = (camId: string) => {
    const cam = DEMO_MAP_CAMERAS.find((c) => c.id === camId);
    return cam ? { x: cam.x, y: cam.y } : { x: 0, y: 0 };
  };

  // Connected links for selected camera
  const cameraLinks = DEMO_MAP_TOPOLOGY_LINKS.filter(
    (l) => l.sourceCameraId === selectedCamId || l.targetCameraId === selectedCamId
  );

  return (
    <div className="card">
      <div className="card-header-flex">
        <div className="card-title">
          <span>2D Perimeter Sensor Coverage &amp; Topology Map</span>
          <span className="demo-tag">PHASE 7 TOPOLOGY</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showTopologyOverlay}
              onChange={(e) => setShowTopologyOverlay(e.target.checked)}
            />
            Topology Paths
          </label>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showFovCones}
              onChange={(e) => setShowFovCones(e.target.checked)}
            />
            Sensor FOVs
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1rem', marginTop: '0.5rem' }}>
        {/* SVG Tactical Map Canvas */}
        <div
          style={{
            backgroundColor: '#040711',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <svg
            viewBox="0 0 800 500"
            style={{ width: '100%', height: 'auto', display: 'block' }}
            aria-label="Perimeter Defense Geospatial Grid and Topology Graph"
          >
            {/* Grid & Marker Definitions */}
            <defs>
              <pattern id="tactical-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(59, 130, 246, 0.07)" strokeWidth="1" />
              </pattern>

              <marker
                id="arrow-default"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
              </marker>

              <marker
                id="arrow-selected"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#fbbf24" />
              </marker>
            </defs>
            <rect width="800" height="500" fill="url(#tactical-grid)" />

            {/* Perimeter Outer Boundary Fence Lines */}
            <rect
              x="100"
              y="40"
              width="600"
              height="420"
              fill="none"
              stroke="#334155"
              strokeWidth="2"
              strokeDasharray="6,4"
            />
            <text x="110" y="32" fill="#64748b" fontSize="10" fontFamily="monospace" fontWeight="bold">
              [ PERIMETER SECURITY PERIMETER — NORTH SECTOR ]
            </text>

            {/* Facility & Sterile Zones Polygons */}
            {DEMO_MAP_ZONES.map((zone) => {
              const isHovered = hoveredZoneId === zone.id;
              return (
                <g key={zone.id}>
                  <polygon
                    points={getPolygonPointsString(zone)}
                    fill={zone.color}
                    stroke={zone.stroke}
                    strokeWidth={isHovered ? 2 : 1.2}
                    onMouseEnter={() => setHoveredZoneId(zone.id)}
                    onMouseLeave={() => setHoveredZoneId(null)}
                    style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                  />
                  <text
                    x={zone.labelPosition.x}
                    y={zone.labelPosition.y}
                    fill={zone.type === 'sterile' ? '#f87171' : '#94a3b8'}
                    fontSize="9.5"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    {zone.name}
                  </text>
                </g>
              );
            })}

            {/* Camera FOV Cones */}
            {showFovCones &&
              DEMO_MAP_CAMERAS.map((cam) => {
                const isSelected = selectedCamId === cam.id;
                return (
                  <path
                    key={`fov-${cam.id}`}
                    d={getFovConePath(cam)}
                    fill={isSelected ? 'rgba(59, 130, 246, 0.35)' : 'rgba(59, 130, 246, 0.12)'}
                    stroke={isSelected ? '#60a5fa' : 'rgba(59, 130, 246, 0.4)'}
                    strokeWidth={isSelected ? 2 : 1}
                    style={{ transition: 'all 0.2s', cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedCamId(cam.id);
                      setSelectedLinkId(null);
                    }}
                  />
                );
              })}

            {/* Phase 7 Declarative Topology Directional Edges */}
            {showTopologyOverlay &&
              DEMO_MAP_TOPOLOGY_LINKS.map((link) => {
                const source = getCameraCoord(link.sourceCameraId);
                const target = getCameraCoord(link.targetCameraId);
                const isSelected = selectedLinkId === link.id;
                const isHovered = hoveredLinkId === link.id;
                const isCamRelated = link.sourceCameraId === selectedCamId || link.targetCameraId === selectedCamId;

                // Midpoint for badge
                const midX = (source.x + target.x) / 2;
                const midY = (source.y + target.y) / 2;

                const strokeColor = isSelected ? '#fbbf24' : isCamRelated ? '#38bdf8' : 'rgba(56, 189, 248, 0.45)';
                const strokeWidth = isSelected || isHovered ? 2.5 : isCamRelated ? 2 : 1.2;

                return (
                  <g
                    key={link.id}
                    onClick={() => {
                      setSelectedLinkId(link.id);
                      setSelectedCamId(link.sourceCameraId);
                    }}
                    onMouseEnter={() => setHoveredLinkId(link.id)}
                    onMouseLeave={() => setHoveredLinkId(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Directional Path Line */}
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={isSelected ? 'none' : '5,3'}
                      markerEnd={isSelected ? 'url(#arrow-selected)' : 'url(#arrow-default)'}
                    />

                    {/* Travel Time Window Tag */}
                    <rect
                      x={midX - 26}
                      y={midY - 8}
                      width="52"
                      height="16"
                      rx="3"
                      fill={isSelected ? '#78350f' : '#0f172a'}
                      stroke={strokeColor}
                      strokeWidth="1"
                    />
                    <text
                      x={midX}
                      y={midY + 3.5}
                      fill={isSelected ? '#fef08a' : '#93c5fd'}
                      fontSize="8"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {link.minTravelTimeSeconds}s–{link.maxTravelTimeSeconds}s
                    </text>
                  </g>
                );
              })}

            {/* Camera Sensor Markers */}
            {DEMO_MAP_CAMERAS.map((cam) => {
              const isSelected = selectedCamId === cam.id;
              return (
                <g
                  key={cam.id}
                  transform={`translate(${cam.x}, ${cam.y})`}
                  onClick={() => {
                    setSelectedCamId(cam.id);
                    setSelectedLinkId(null);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Selection Ring */}
                  {isSelected && (
                    <circle r="14" fill="none" stroke="#60a5fa" strokeWidth="2" strokeDasharray="3,2" />
                  )}

                  {/* Marker Body */}
                  <circle
                    r="8"
                    fill={cam.status === 'active' ? '#10b981' : '#f59e0b'}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />

                  {/* Label */}
                  <rect
                    x="-24"
                    y="11"
                    width="48"
                    height="14"
                    rx="3"
                    fill="rgba(15, 23, 42, 0.9)"
                    stroke={isSelected ? '#60a5fa' : '#334155'}
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="21"
                    fill={isSelected ? '#93c5fd' : '#cbd5e1'}
                    fontSize="8.5"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {cam.id}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Sensor / Topology Inspector Panel */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            overflowY: 'auto',
          }}
        >
          {/* Topology Edge Inspection */}
          {selectedLink ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#fbbf24', fontSize: '0.95rem' }}>
                  {selectedLink.sourceCameraId} → {selectedLink.targetCameraId}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    color: '#fbbf24',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    padding: '0.15rem 0.4rem',
                    borderRadius: '4px',
                    fontWeight: 700,
                  }}
                >
                  TOPOLOGY LINK
                </span>
              </div>

              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
                {selectedLink.relationshipType}
              </div>

              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {selectedLink.description}
              </div>

              <div
                style={{
                  marginTop: '0.6rem',
                  padding: '0.6rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Travel Window:</span>
                  <strong style={{ fontFamily: 'monospace', color: '#60a5fa' }}>
                    {selectedLink.minTravelTimeSeconds}s – {selectedLink.maxTravelTimeSeconds}s
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Allowed Direction:</span>
                  <strong style={{ fontFamily: 'monospace' }}>{selectedLink.allowedDirections.join(', ')}</strong>
                </div>
              </div>

              <button
                onClick={() => setSelectedLinkId(null)}
                style={{
                  marginTop: '0.5rem',
                  width: '100%',
                  padding: '0.3rem',
                  fontSize: '0.72rem',
                  backgroundColor: 'transparent',
                  border: '1px solid #475569',
                  color: '#cbd5e1',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                ← Back to Sensor Details
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#93c5fd', fontSize: '1rem' }}>
                  {selectedCamera.id}
                </span>
                <StatusBadge status={selectedCamera.status} />
              </div>

              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedCamera.name}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {selectedCamera.sector}
                </div>
              </div>

              <div
                style={{
                  padding: '0.6rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Sensor Lens:</span>
                  <strong>{selectedCamera.lensType}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Azimuth:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedCamera.azimuth}°</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>FOV Angle:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedCamera.fov}°</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Effective Range:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedCamera.range}m</strong>
                </div>
              </div>

              {/* Connected Topology Links */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#93c5fd', marginBottom: '0.35rem' }}>
                  Connected Topology Paths ({cameraLinks.length}):
                </div>
                {cameraLinks.length === 0 ? (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>No direct topology edges.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {cameraLinks.map((l) => (
                      <div
                        key={l.id}
                        onClick={() => setSelectedLinkId(l.id)}
                        style={{
                          padding: '0.35rem 0.5rem',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontFamily: 'monospace', color: '#60a5fa' }}>
                          {l.sourceCameraId} → {l.targetCameraId}
                        </span>
                        <span style={{ color: '#94a3b8' }}>
                          {l.minTravelTimeSeconds}s–{l.maxTravelTimeSeconds}s
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Select Active Sensor:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
              {DEMO_MAP_CAMERAS.map((cam) => (
                <button
                  key={cam.id}
                  onClick={() => {
                    setSelectedCamId(cam.id);
                    setSelectedLinkId(null);
                  }}
                  style={{
                    padding: '0.35rem',
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    background: selectedCamId === cam.id ? '#1e40af' : 'var(--bg-card)',
                    color: selectedCamId === cam.id ? '#ffffff' : 'var(--text-secondary)',
                    border: selectedCamId === cam.id ? '1px solid #60a5fa' : '1px solid var(--border-color)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {cam.id}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
