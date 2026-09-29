import React from 'react';

interface OperationalSummaryProps {
  totalCameras?: number;
  onlineCameras?: number;
  activeIncidents?: number;
  highPriorityIncidents?: number;
  eventsToday?: number;
}

export const OperationalSummary: React.FC<OperationalSummaryProps> = ({
  totalCameras = 6,
  onlineCameras = 5,
  activeIncidents = 3,
  highPriorityIncidents = 1,
  eventsToday = 27,
}) => {
  return (
    <div className="kpi-grid" aria-label="Operational Key Metrics">
      {/* Cameras Status Card */}
      <div className="kpi-card">
        <div className="kpi-label">
          <span>Cameras Fleet</span>
          <span className="demo-tag">TELEMETRY</span>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value" style={{ color: '#10b981' }}>{onlineCameras}</span>
          <span className="kpi-subtext" style={{ color: 'var(--text-muted)' }}>/ {totalCameras} ONLINE</span>
        </div>
      </div>

      {/* Active Incidents Card */}
      <div className="kpi-card kpi-warning">
        <div className="kpi-label">
          <span>Active Incidents</span>
          <span className="demo-tag">QUEUE</span>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value" style={{ color: activeIncidents > 0 ? '#f59e0b' : '#10b981' }}>
            {activeIncidents}
          </span>
          <span className="kpi-subtext">REQUIRES TRIAGE</span>
        </div>
      </div>

      {/* High Priority Critical Incidents Card */}
      <div className="kpi-card kpi-danger">
        <div className="kpi-label">
          <span>High Priority</span>
          <span className="demo-tag">ACTION</span>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value" style={{ color: highPriorityIncidents > 0 ? '#ef4444' : '#10b981' }}>
            {highPriorityIncidents}
          </span>
          <span className="kpi-subtext">CRITICAL BREACHES</span>
        </div>
      </div>

      {/* Events Today Card */}
      <div className="kpi-card">
        <div className="kpi-label">
          <span>Events Today</span>
          <span className="demo-tag">24H CYCLE</span>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value" style={{ color: '#60a5fa' }}>{eventsToday}</span>
          <span className="kpi-subtext">OBSERVATIONS LOGGED</span>
        </div>
      </div>
    </div>
  );
};
