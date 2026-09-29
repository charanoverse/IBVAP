import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OperationalSummary } from '../components/OperationalSummary';
import { CameraGrid } from '../components/CameraGrid';
import { IncidentQueue } from '../components/IncidentQueue';
import { RecentActivity } from '../components/RecentActivity';
import { SystemHealth } from '../components/SystemHealth';
import { EventTimeline } from '../components/EventTimeline';
import { DEMO_CAMERAS } from '../demo/cameras';
import { DEMO_ACTIVITIES } from '../demo/activity';
import { Event, Incident } from '@ibvap/shared';
import { incidentService, IncidentMetrics } from '../services/incidentService';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [verifiedEvents, setVerifiedEvents] = useState<Event[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [metrics, setMetrics] = useState<IncidentMetrics>({
    total: 0,
    active: 0,
    highPriority: 0,
    acknowledged: 0,
    closedToday: 0,
  });

  const loadIncidentsAndMetrics = () => {
    incidentService
      .getIncidents({ state: 'ACTIVE', limit: 8 })
      .then((data) => {
        if (Array.isArray(data)) {
          setIncidents(data);
        }
      })
      .catch(() => {});

    incidentService
      .getMetrics()
      .then((m) => {
        if (m) setMetrics(m);
      })
      .catch(() => {});
  };

  // Fetch initial verified events across cameras
  useEffect(() => {
    loadIncidentsAndMetrics();

    fetch('/api/events?limit=12')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setVerifiedEvents(data.data);
        }
      })
      .catch(() => {});
  }, []);

  // Subscribe to real-time security events and incidents over SSE
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events/live/all');
      eventSource.addEventListener('security_event', (e: MessageEvent) => {
        try {
          const newEvt: Event = JSON.parse(e.data);
          setVerifiedEvents((prev) => {
            if (prev.some((x) => x.id === newEvt.id)) return prev;
            return [newEvt, ...prev.slice(0, 19)];
          });
        } catch {}
      });

      eventSource.addEventListener('incident_created', (e: MessageEvent) => {
        try {
          const newInc: Incident = JSON.parse(e.data);
          setIncidents((prev) => {
            if (prev.some((x) => x.id === newInc.id)) return prev;
            return [newInc, ...prev];
          });
          loadIncidentsAndMetrics();
        } catch {}
      });

      eventSource.addEventListener('incident_updated', (e: MessageEvent) => {
        try {
          const updatedInc: Incident = JSON.parse(e.data);
          setIncidents((prev) => prev.map((x) => (x.id === updatedInc.id ? updatedInc : x)));
          loadIncidentsAndMetrics();
        } catch {}
      });
    } catch {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const onlineCamerasCount = DEMO_CAMERAS.filter((c) => c.status === 'active').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Operational Summary KPI Cards */}
      <OperationalSummary
        totalCameras={DEMO_CAMERAS.length}
        onlineCameras={onlineCamerasCount}
        activeIncidents={metrics.active}
        highPriorityIncidents={metrics.highPriority}
        eventsToday={verifiedEvents.length > 0 ? verifiedEvents.length : 27}
      />

      {/* 2. Main Command Center Grid */}
      <div className="command-center-layout">
        {/* Left / Center Column: Surveillance Camera Matrix & Verified Event Feed */}
        <div className="command-main-column">
          <CameraGrid cameras={DEMO_CAMERAS} limit={4} />

          {/* Real Phase 5 Verified Security Events Feed */}
          <div className="card" style={{ padding: '1rem' }}>
            <div className="card-header-flex">
              <div className="card-title">
                <span>Recent Verified Security Events</span>
                <span className="demo-tag" style={{ color: '#ec4899', borderColor: '#db2777' }}>
                  PHASE 5 RULE ENGINE
                </span>
                <span className="demo-tag" style={{ color: '#10b981', borderColor: '#059669' }}>
                  {verifiedEvents.length} VERIFIED
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/cameras')}
                className="btn btn-outline"
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
              >
                CAMERA FLEET →
              </button>
            </div>

            <EventTimeline
              events={verifiedEvents}
              maxEvents={5}
              emptyMessage="No verified security events recorded across camera fleet yet."
              onEventClick={(evt) => navigate(`/cameras/${evt.cameraId}`)}
            />
          </div>

          <RecentActivity activities={DEMO_ACTIVITIES} limit={5} />
        </div>

        {/* Right Column: Active Incident Queue & System Health */}
        <div className="command-sidebar-column">
          <IncidentQueue incidents={incidents} limit={5} />
          <SystemHealth />
        </div>
      </div>
    </div>
  );
};
