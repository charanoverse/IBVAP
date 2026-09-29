import React from 'react';
import { Link } from 'react-router-dom';
import { Incident } from '@ibvap/shared';
import { IncidentCard } from './IncidentCard';

interface IncidentQueueProps {
  incidents: (Incident | any)[];
  limit?: number;
}

const PRIORITY_ORDER: Record<string, number> = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

export const IncidentQueue: React.FC<IncidentQueueProps> = ({ incidents, limit }) => {
  const activeIncidents = (incidents || [])
    .filter((inc) => {
      const st = (inc.state || inc.reviewState || '').toString().toUpperCase();
      return st !== 'CLOSED' && st !== 'RESOLVED' && st !== 'DISMISSED';
    })
    .sort((a, b) => {
      const prioA = PRIORITY_ORDER[a.priority] || 99;
      const prioB = PRIORITY_ORDER[b.priority] || 99;
      if (prioA !== prioB) return prioA - prioB;
      const timeA = new Date(a.openedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.openedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    })
    .slice(0, limit || incidents.length);

  return (
    <div className="card">
      <div className="card-header-flex">
        <div className="card-title">
          <span>Active Incident Queue</span>
          <span className="demo-tag" style={{ color: '#ef4444', borderColor: '#b91c1c' }}>
            {activeIncidents.length} PENDING
          </span>
        </div>
        <Link
          to="/incidents"
          style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 600 }}
        >
          View All →
        </Link>
      </div>

      <div className="card-desc">
        Real-time tactical security breaches prioritized for operator review.
      </div>

      <div className="incident-queue-list">
        {activeIncidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            No active incidents requiring immediate attention.
          </div>
        ) : (
          activeIncidents.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} />
          ))
        )}
      </div>
    </div>
  );
};
