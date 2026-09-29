import React from 'react';
import { useHealth } from '../hooks/useHealth';
import { SUB_SYSTEM_STATUSES } from '../demo/system';
import { StatusBadge } from './StatusBadge';

export const SystemHealth: React.FC = () => {
  const { loading, error } = useHealth();

  return (
    <div className="card">
      <div className="card-header-flex">
        <div className="card-title">
          <span>Subsystem Status</span>
          <span className="demo-tag">HEALTH</span>
        </div>
      </div>

      <div className="card-desc">
        Real-time infrastructure health and modular subsystem state.
      </div>

      <div className="system-health-list">
        {SUB_SYSTEM_STATUSES.map((sub) => {
          // If this is the real backend item, dynamically reflect useHealth status
          const isBackend = sub.isRealBackend;
          const status = isBackend
            ? loading
              ? 'CONNECTING'
              : error
              ? 'OFFLINE'
              : 'ONLINE'
            : sub.status;

          const badgeType = isBackend
            ? loading
              ? 'loading'
              : error
              ? 'error'
              : 'ok'
            : sub.badgeType;

          return (
            <div key={sub.id} className="system-health-item">
              <div className="health-name-group">
                <span className="health-item-name">{sub.name}</span>
                <span className="health-item-detail">
                  {sub.phaseNote ? (
                    <strong style={{ color: '#93c5fd' }}>{sub.phaseNote} — </strong>
                  ) : null}
                  {sub.detail}
                </span>
              </div>

              <StatusBadge status={badgeType} label={status} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
