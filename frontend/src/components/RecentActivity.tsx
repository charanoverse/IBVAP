import React from 'react';
import { ActivityItem } from '../demo/activity';

interface RecentActivityProps {
  activities: ActivityItem[];
  limit?: number;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ activities, limit }) => {
  const displayItems = activities.slice(0, limit || activities.length);

  return (
    <div className="card">
      <div className="card-header-flex">
        <div className="card-title">
          <span>Recent Operational Activity</span>
          <span className="demo-tag">LIVE FEED</span>
        </div>
      </div>

      <div className="card-desc">
        Chronological audit log of events, observations, and telemetry updates.
      </div>

      <div className="activity-feed-list">
        {displayItems.map((act) => (
          <div key={act.id} className="activity-item">
            <span className="activity-time">{act.timeDisplay}</span>
            <div className="activity-content">
              <span className="activity-camera-tag">[{act.cameraId}]</span>
              <span>{act.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
