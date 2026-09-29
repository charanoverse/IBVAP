import React from 'react';
import { Event } from '@ibvap/shared';

export interface EventTimelineProps {
  events: Event[];
  maxEvents?: number;
  emptyMessage?: string;
  onEventClick?: (event: Event) => void;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({
  events,
  maxEvents = 20,
  emptyMessage = 'No verified security events recorded yet.',
  onEventClick,
}) => {
  const displayEvents = events.slice(0, maxEvents);

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'ZONE_ENTRY':
      case 'sterile_zone_breach':
        return '#ef4444'; // Red
      case 'DWELL':
      case 'corridor_loitering':
        return '#f59e0b'; // Amber
      case 'LINE_CROSSING':
        return '#06b6d4'; // Cyan
      case 'WRONG_DIRECTION':
        return '#ec4899'; // Pink
      case 'REPEATED_CROSSING':
        return '#8b5cf6'; // Purple
      case 'ZONE_EXIT':
        return '#10b981'; // Green
      default:
        return '#3b82f6';
    }
  };

  if (displayEvents.length === 0) {
    return (
      <div
        style={{
          padding: '2rem 1rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.82rem',
          fontStyle: 'italic',
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {displayEvents.map((evt) => {
        const color = getEventTypeColor(evt.eventType);
        const timeStr = evt.videoTimestamp !== undefined
          ? `${evt.videoTimestamp.toFixed(2)}s`
          : evt.timestamp
          ? new Date(evt.timestamp).toLocaleTimeString()
          : '00:00:00';

        return (
          <div
            key={evt.id}
            onClick={() => onEventClick?.(evt)}
            style={{
              padding: '0.75rem 0.85rem',
              backgroundColor: 'var(--bg-secondary)',
              border: `1px solid ${color}44`,
              borderLeft: `4px solid ${color}`,
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              cursor: onEventClick ? 'pointer' : 'default',
              transition: 'background-color 0.15s ease',
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    backgroundColor: `${color}22`,
                    color: color,
                    border: `1px solid ${color}66`,
                    borderRadius: '3px',
                    padding: '0.1rem 0.4rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  {evt.eventType.replace('_', ' ')}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#93c5fd',
                  }}
                >
                  {evt.cameraId}
                </span>
                {evt.trackDisplayId && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      color: '#cbd5e1',
                    }}
                  >
                    {evt.objectClass?.toUpperCase()} · {evt.trackDisplayId}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {timeStr}
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: evt.status === 'VERIFIED' ? '#10b981' : '#f59e0b',
                    backgroundColor: evt.status === 'VERIFIED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    padding: '0.05rem 0.35rem',
                    borderRadius: '3px',
                  }}
                >
                  {evt.status || 'VERIFIED'}
                </span>
              </div>
            </div>

            {/* Explanation row */}
            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-primary)',
                lineHeight: 1.35,
              }}
            >
              {evt.explanation || `Security event ${evt.eventType} triggered by rule ${evt.ruleId || 'N/A'}.`}
            </div>
          </div>
        );
      })}
    </div>
  );
};
