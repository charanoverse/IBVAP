import React from 'react';
import { CameraStatus, IncidentPriority, IncidentReviewState } from '@ibvap/shared';

export type ExtendedStatus =
  | CameraStatus
  | IncidentPriority
  | IncidentReviewState
  | 'ok'
  | 'degraded'
  | 'error'
  | 'loading'
  | 'disabled'
  | 'critical'
  | 'warning'
  | 'info'
  | 'normal';

interface StatusBadgeProps {
  status: ExtendedStatus | string;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className = '' }) => {
  const normalized = (status || '').toLowerCase();

  const getBadgeClass = () => {
    switch (normalized) {
      case 'ok':
      case 'active':
      case 'online':
      case 'resolved':
      case 'normal':
        return 'badge-success';

      case 'degraded':
      case 'standby':
      case 'maintenance':
      case 'medium':
      case 'warning':
      case 'under_review':
        return 'badge-warning';

      case 'error':
      case 'inactive':
      case 'critical':
      case 'high':
      case 'open':
      case 'escalated':
        return 'badge-danger';

      case 'low':
      case 'info':
      case 'candidate':
      case 'acknowledged':
        return 'badge-info';

      case 'disabled':
      case 'not_connected':
      case 'dismissed':
        return 'badge-disabled';

      default:
        return 'badge-info';
    }
  };

  const displayText = label || (status ? status.toUpperCase() : 'UNKNOWN');

  return (
    <span className={`badge ${getBadgeClass()} ${className}`}>
      <span className="badge-dot" />
      <span>{displayText}</span>
    </span>
  );
};
