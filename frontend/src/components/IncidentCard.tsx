import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Incident } from '@ibvap/shared';
import { StatusBadge } from './StatusBadge';

interface IncidentCardProps {
  incident: Incident | any;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({ incident }) => {
  const navigate = useNavigate();

  const getPriorityClass = () => {
    const p = (incident.priority || '').toString().toLowerCase();
    switch (p) {
      case 'critical':
      case 'high':
        return 'priority-high';
      case 'medium':
        return 'priority-medium';
      default:
        return 'priority-low';
    }
  };

  const formatDisplayTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const getEvidenceBadge = () => {
    const evState = (incident.evidenceState || '').toUpperCase();
    if (evState === 'READY' || incident.evidenceAvailable) {
      return <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 700 }}>✓ Evidence Ready</span>;
    }
    if (evState === 'PROCESSING') {
      return <span style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 700 }}>⏳ Extracting...</span>;
    }
    if (evState === 'FAILED') {
      return <span style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 700 }}>⚠ Evidence Failed</span>;
    }
    return <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Pending</span>;
  };

  const stateLabel = (incident.state || incident.reviewState || 'NEW').toUpperCase();
  const linkedCount = incident.linkedEventIds?.length || incident.linkedEvents?.length || 1;
  const timeStr = incident.displayTime || formatDisplayTime(incident.openedAt || incident.createdAt);

  return (
    <div
      className={`incident-card ${getPriorityClass()}`}
      onClick={() => navigate(`/incidents/${incident.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          navigate(`/incidents/${incident.id}`);
        }
      }}
      aria-label={`Incident ${incident.id}: ${incident.title}`}
    >
      <div className="incident-card-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.78rem', color: '#93c5fd' }}>
            #{incident.id}
          </span>
          <StatusBadge status={incident.priority} label={incident.priority.toUpperCase()} />
          <span
            style={{
              fontSize: '0.68rem',
              padding: '0.1rem 0.35rem',
              borderRadius: '3px',
              backgroundColor: stateLabel === 'NEW' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
              color: stateLabel === 'NEW' ? '#fca5a5' : '#93c5fd',
              fontWeight: 700,
            }}
          >
            {stateLabel}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {timeStr}
        </span>
      </div>

      <div className="incident-card-title">{incident.title}</div>

      <div className="incident-card-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden' }}>
          <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{incident.cameraId}</span>
          <span>•</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {incident.zoneName || incident.lineName || (incident.trackDisplayId ? `Track ${incident.trackDisplayId}` : 'Perimeter')}
          </span>
          {linkedCount > 1 && (
            <span
              style={{
                fontSize: '0.68rem',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                color: '#a5b4fc',
                padding: '0.05rem 0.35rem',
                borderRadius: '3px',
                fontWeight: 700,
              }}
            >
              {linkedCount} Events
            </span>
          )}
        </div>
        <div>{getEvidenceBadge()}</div>
      </div>
    </div>
  );
};
