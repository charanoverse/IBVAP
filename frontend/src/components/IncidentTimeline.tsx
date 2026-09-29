import React from 'react';
import { IncidentTimelineEvent } from '@ibvap/shared';

interface IncidentTimelineProps {
  items: (IncidentTimelineEvent | any)[];
}

export const IncidentTimeline: React.FC<IncidentTimelineProps> = ({ items }) => {
  const getDotClass = (type: string) => {
    switch (type) {
      case 'INCIDENT_OPENED':
      case 'EVENT_VERIFIED':
      case 'EVENT':
        return 'danger';
      case 'ZONE_ACTIVITY':
      case 'ACTIVITY':
      case 'TRACK_CREATED':
        return 'warning';
      case 'EVIDENCE_READY':
        return 'success';
      case 'OPERATOR_ACTION':
      case 'NOTE_ADDED':
        return 'primary';
      default:
        return '';
    }
  };

  const formatItemTime = (item: any) => {
    if (item.time) return item.time;
    if (item.videoTimestamp !== undefined) {
      return `${item.videoTimestamp.toFixed(1)}s`;
    }
    if (item.timestamp) {
      try {
        const d = new Date(item.timestamp);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      } catch {
        return item.timestamp;
      }
    }
    return '';
  };

  if (!items || items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        No timeline milestones recorded yet.
      </div>
    );
  }

  return (
    <div className="timeline-container" aria-label="Incident Event Timeline">
      {items.map((item, idx) => (
        <div key={item.id || idx} className="timeline-item">
          <div className={`timeline-dot ${getDotClass(item.type)}`} />
          <div className="timeline-time">{formatItemTime(item)}</div>
          <div className="timeline-title">
            {item.title}
            {item.actor && (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '0.4rem' }}>
                ({item.actor})
              </span>
            )}
          </div>
          <div className="timeline-desc">{item.description}</div>
        </div>
      ))}
    </div>
  );
};
