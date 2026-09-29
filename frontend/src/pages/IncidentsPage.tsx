import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Incident } from '@ibvap/shared';
import { StatusBadge } from '../components/StatusBadge';
import { incidentService } from '../services/incidentService';

export const IncidentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterState, setFilterState] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterCamera, setFilterCamera] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchIncidents = () => {
    incidentService
      .getIncidents({
        state: filterState !== 'ALL' ? filterState : undefined,
        priority: filterPriority !== 'ALL' ? filterPriority : undefined,
        cameraId: filterCamera !== 'ALL' ? filterCamera : undefined,
        search: searchQuery.trim() || undefined,
        limit: 100,
      })
      .then((data) => {
        setIncidents(data);
      })
      .catch(() => {})
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchIncidents();
  }, [filterState, filterPriority, filterCamera, searchQuery]);

  // Live real-time updates over SSE
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events/live/all');
      eventSource.addEventListener('incident_created', (e: MessageEvent) => {
        try {
          const newInc: Incident = JSON.parse(e.data);
          setIncidents((prev) => {
            if (prev.some((x) => x.id === newInc.id)) return prev;
            return [newInc, ...prev];
          });
        } catch {}
      });

      eventSource.addEventListener('incident_updated', (e: MessageEvent) => {
        try {
          const updatedInc: Incident = JSON.parse(e.data);
          setIncidents((prev) => prev.map((x) => (x.id === updatedInc.id ? updatedInc : x)));
        } catch {}
      });
    } catch {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const formatDisplayTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Banner / Header */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div className="card-header-flex" style={{ margin: 0 }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Perimeter Security Incidents &amp; Triage Queue
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
              Real-time operator queue for verified security events, sterile zone breaches, and tactical evidence review.
            </p>
          </div>
          <span className="demo-tag" style={{ color: '#60a5fa', borderColor: '#3b82f6' }}>
            PHASE 6 LIVE ENGINE
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-label">Search:</span>
          <input
            type="text"
            className="filter-input"
            placeholder="Search incident #, title, or zone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <span className="filter-label">State:</span>
          <select
            className="filter-select"
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
          >
            <option value="ALL">All States</option>
            <option value="ACTIVE">Active (Unresolved)</option>
            <option value="NEW">New</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="ESCALATED">Escalated</option>
            <option value="CLOSED">Closed / Resolved</option>
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">Priority:</span>
          <select
            className="filter-select"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">Camera:</span>
          <select
            className="filter-select"
            value={filterCamera}
            onChange={(e) => setFilterCamera(e.target.value)}
          >
            <option value="ALL">All Cameras</option>
            <option value="CAM-01">CAM-01 (Main Gate)</option>
            <option value="CAM-02">CAM-02 (North Corridor)</option>
            <option value="CAM-03">CAM-03 (Sterile Zone)</option>
            <option value="CAM-04">CAM-04 (Exit Lane)</option>
            <option value="CAM-05">CAM-05 (East Fence)</option>
            <option value="CAM-06">CAM-06 (Service Yard)</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Showing <strong>{incidents.length}</strong> incidents
        </div>
      </div>

      {/* Incident List Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Priority</th>
              <th>Incident Title</th>
              <th>Origin Camera</th>
              <th>Sector / Zone</th>
              <th>Timestamp</th>
              <th>Review State</th>
              <th>Evidence</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Loading incident queue from backend...
                </td>
              </tr>
            ) : incidents.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No security incidents match the selected filter criteria.
                </td>
              </tr>
            ) : (
              incidents.map((inc) => {
                const stateLabel = (inc.state || inc.reviewState || 'NEW').toUpperCase();
                const evState = (inc.evidenceState || '').toUpperCase();
                return (
                  <tr
                    key={inc.id}
                    onClick={() => navigate(`/incidents/${inc.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#93c5fd' }}>
                      #{inc.id}
                    </td>
                    <td>
                      <StatusBadge status={inc.priority} label={inc.priority.toUpperCase()} />
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {inc.title}
                      {inc.linkedEventIds && inc.linkedEventIds.length > 1 && (
                        <span
                          style={{
                            marginLeft: '0.4rem',
                            fontSize: '0.65rem',
                            backgroundColor: 'rgba(99, 102, 241, 0.2)',
                            color: '#a5b4fc',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '3px',
                          }}
                        >
                          {inc.linkedEventIds.length} Events
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>{inc.cameraId}</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {inc.zoneName || inc.lineName || (inc.trackDisplayId ? `Track ${inc.trackDisplayId}` : 'Perimeter')}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {formatDisplayTime(inc.openedAt || inc.createdAt)}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          backgroundColor:
                            stateLabel === 'NEW'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : stateLabel === 'CLOSED'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(59, 130, 246, 0.15)',
                          color:
                            stateLabel === 'NEW'
                              ? '#fca5a5'
                              : stateLabel === 'CLOSED'
                              ? '#6ee7b7'
                              : '#93c5fd',
                          fontWeight: 700,
                        }}
                      >
                        {stateLabel}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: evState === 'READY' || inc.evidenceAvailable ? '#10b981' : evState === 'FAILED' ? '#ef4444' : '#f59e0b',
                          fontWeight: 600,
                        }}
                      >
                        {evState === 'READY' || inc.evidenceAvailable ? '✓ Ready' : evState === 'FAILED' ? '⚠ Failed' : '⏳ Extracting'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/incidents/${inc.id}`);
                        }}
                      >
                        Inspect →
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
