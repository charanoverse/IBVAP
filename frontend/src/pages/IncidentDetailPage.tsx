import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Correlation,
  Evidence,
  Incident,
  IncidentOutcomeType,
  IncidentTimelineEvent,
  CameraHealth,
  AlternativeViewRecommendation,
} from '@ibvap/shared';
import { StatusBadge } from '../components/StatusBadge';
import { EvidenceViewer } from '../components/EvidenceViewer';
import { IncidentTimeline } from '../components/IncidentTimeline';
import { CorrelationCard } from '../components/CorrelationCard';
import { incidentService } from '../services/incidentService';
import { correlationService } from '../services/correlationService';
import { cameraHealthService } from '../services/cameraHealthService';
import { coverageService } from '../services/coverageService';
import { INITIAL_DEMO_INCIDENTS } from '../demo/incidents';
import { INITIAL_DEMO_CORRELATIONS } from '../demo/correlations';

export const IncidentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [timeline, setTimeline] = useState<IncidentTimelineEvent[]>([]);
  const [correlations, setCorrelations] = useState<Correlation[]>([]);
  const [cameraHealth, setCameraHealth] = useState<CameraHealth | null>(null);
  const [alternativeRecs, setAlternativeRecs] = useState<AlternativeViewRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [operatorNotes, setOperatorNotes] = useState<string>('');
  const [closeDisposition, setCloseDisposition] = useState<IncidentOutcomeType>('CONFIRMED_ACTIVITY');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  const loadData = () => {
    if (!id) return;
    setIsLoading(true);

    incidentService
      .getIncidentById(id)
      .then((inc) => {
        if (inc) {
          setIncident(inc);
          if (inc.timeline) setTimeline(inc.timeline);
          if (inc.cameraId) {
            cameraHealthService.getCameraHealth(inc.cameraId).then(setCameraHealth).catch(() => {});
            coverageService.getAlternativeRecommendations(inc.cameraId, inc.zoneId).then(setAlternativeRecs).catch(() => {});
          }
        } else {
          // Fallback to demo fixture if mock ID passed
          const demo = INITIAL_DEMO_INCIDENTS.find((d) => d.id === id);
          if (demo) {
            setIncident(demo as any);
            setTimeline((demo as any).timeline || []);
            if (demo.cameraId) {
              cameraHealthService.getCameraHealth(demo.cameraId).then(setCameraHealth).catch(() => {});
              coverageService.getAlternativeRecommendations(demo.cameraId, demo.zoneId).then(setAlternativeRecs).catch(() => {});
            }
          }
        }
      })
      .catch(() => {
        const demo = INITIAL_DEMO_INCIDENTS.find((d) => d.id === id);
        if (demo) {
          setIncident(demo as any);
          setTimeline((demo as any).timeline || []);
          if (demo.cameraId) {
            cameraHealthService.getCameraHealth(demo.cameraId).then(setCameraHealth).catch(() => {});
            coverageService.getAlternativeRecommendations(demo.cameraId, demo.zoneId).then(setAlternativeRecs).catch(() => {});
          }
        }
      })
      .finally(() => {
        setIsLoading(false);
      });

    incidentService.getIncidentEvidence(id).then((evd) => {
      if (evd) setEvidence(evd);
    });

    incidentService.getIncidentTimeline(id).then((tl) => {
      if (tl && tl.length > 0) setTimeline(tl);
    });

    correlationService
      .getCorrelations()
      .then((corrs) => {
        if (corrs && corrs.length > 0) {
          setCorrelations(corrs);
        } else {
          setCorrelations(INITIAL_DEMO_CORRELATIONS);
        }
      })
      .catch(() => {
        setCorrelations(INITIAL_DEMO_CORRELATIONS);
      });
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const showToast = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  const handleAcceptCorrelation = async (corrId: string, note?: string) => {
    try {
      const updated = await correlationService.acceptCorrelation(corrId, 'Operator', note);
      if (updated) {
        setCorrelations((prev) => prev.map((c) => (c.id === corrId ? updated : c)));
        showToast(`Cross-camera correlation #${corrId} ACCEPTED.`);
      } else {
        setCorrelations((prev) =>
          prev.map((c) =>
            c.id === corrId
              ? { ...c, state: 'accepted', reviewedAt: new Date().toISOString(), reviewedBy: 'Operator', reviewNote: note || c.reviewNote }
              : c
          )
        );
        showToast(`Cross-camera correlation #${corrId} ACCEPTED.`);
      }
    } catch {
      setCorrelations((prev) =>
        prev.map((c) =>
          c.id === corrId
            ? { ...c, state: 'accepted', reviewedAt: new Date().toISOString(), reviewedBy: 'Operator', reviewNote: note || c.reviewNote }
            : c
        )
      );
      showToast(`Cross-camera correlation #${corrId} ACCEPTED.`);
    }
  };

  const handleRejectCorrelation = async (corrId: string, note?: string) => {
    try {
      const updated = await correlationService.rejectCorrelation(corrId, 'Operator', note);
      if (updated) {
        setCorrelations((prev) => prev.map((c) => (c.id === corrId ? updated : c)));
        showToast(`Cross-camera correlation #${corrId} REJECTED.`);
      } else {
        setCorrelations((prev) =>
          prev.map((c) =>
            c.id === corrId
              ? { ...c, state: 'rejected', reviewedAt: new Date().toISOString(), reviewedBy: 'Operator', reviewNote: note || c.reviewNote }
              : c
          )
        );
        showToast(`Cross-camera correlation #${corrId} REJECTED.`);
      }
    } catch {
      setCorrelations((prev) =>
        prev.map((c) =>
          c.id === corrId
            ? { ...c, state: 'rejected', reviewedAt: new Date().toISOString(), reviewedBy: 'Operator', reviewNote: note || c.reviewNote }
            : c
        )
      );
      showToast(`Cross-camera correlation #${corrId} REJECTED.`);
    }
  };

  const handleAddCorrelationNote = async (corrId: string, note: string) => {
    try {
      const updated = await correlationService.addNote(corrId, note, 'Operator');
      if (updated) {
        setCorrelations((prev) => prev.map((c) => (c.id === corrId ? updated : c)));
        showToast(`Review note added to correlation #${corrId}.`);
      }
    } catch {
      setCorrelations((prev) =>
        prev.map((c) =>
          c.id === corrId ? { ...c, reviewNote: c.reviewNote ? `${c.reviewNote}\n${note}` : note } : c
        )
      );
      showToast(`Review note added to correlation #${corrId}.`);
    }
  };

  const handleAcknowledge = async () => {
    if (!incident) return;
    setIsProcessingAction(true);
    try {
      const updated = await incidentService.acknowledge(incident.id);
      if (updated) {
        setIncident(updated);
        showToast(`Incident #${incident.id} ACKNOWLEDGED. Status transitioned to ACKNOWLEDGED.`);
        loadData();
      }
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleStartReview = async () => {
    if (!incident) return;
    setIsProcessingAction(true);
    try {
      const updated = await incidentService.startReview(incident.id);
      if (updated) {
        setIncident(updated);
        showToast(`Review started on incident #${incident.id}. Status set to UNDER REVIEW.`);
        loadData();
      }
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleEscalate = async () => {
    if (!incident) return;
    setIsProcessingAction(true);
    try {
      const updated = await incidentService.escalate(incident.id, operatorNotes || 'Operator requested tactical supervisor review.');
      if (updated) {
        setIncident(updated);
        showToast(`Incident #${incident.id} ESCALATED to Watch Commander queue.`);
        setOperatorNotes('');
        loadData();
      }
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleClose = async () => {
    if (!incident) return;
    setIsProcessingAction(true);
    try {
      const updated = await incidentService.close(incident.id, closeDisposition, operatorNotes);
      if (updated) {
        setIncident(updated);
        showToast(`Incident #${incident.id} CLOSED with outcome "${closeDisposition}".`);
        setOperatorNotes('');
        loadData();
      }
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleAddNote = async () => {
    if (!incident || !operatorNotes.trim()) return;
    setIsProcessingAction(true);
    try {
      const updated = await incidentService.addNote(incident.id, operatorNotes);
      if (updated) {
        setIncident(updated);
        showToast(`Operator note appended to incident #${incident.id}.`);
        setOperatorNotes('');
        loadData();
      }
    } finally {
      setIsProcessingAction(false);
    }
  };

  if (isLoading && !incident) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading incident file #{id} from backend repository...</p>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
        <h2>Incident #{id} Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          The requested security incident record could not be located in the database.
        </p>
        <button
          onClick={() => navigate('/incidents')}
          className="btn btn-primary"
          style={{ marginTop: '1.25rem' }}
        >
          ← Return to Incident Queue
        </button>
      </div>
    );
  }

  const stateLabel = (incident.state || incident.reviewState || 'NEW').toUpperCase();
  const priorityLabel = (incident.priority || 'MEDIUM').toUpperCase();
  const isClosed = stateLabel === 'CLOSED';
  const isUnderReview = stateLabel === 'UNDER_REVIEW';

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
      {/* Top Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button
          onClick={() => navigate('/incidents')}
          className="btn btn-secondary"
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
        >
          ← Back to Incident Queue
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Lifecycle State:</span>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.55rem',
              borderRadius: '4px',
              backgroundColor:
                stateLabel === 'NEW'
                  ? 'rgba(239, 68, 68, 0.2)'
                  : stateLabel === 'CLOSED'
                  ? 'rgba(16, 185, 129, 0.2)'
                  : stateLabel === 'ESCALATED'
                  ? 'rgba(245, 158, 11, 0.2)'
                  : 'rgba(59, 130, 246, 0.2)',
              color:
                stateLabel === 'NEW'
                  ? '#fca5a5'
                  : stateLabel === 'CLOSED'
                  ? '#6ee7b7'
                  : stateLabel === 'ESCALATED'
                  ? '#fcd34d'
                  : '#93c5fd',
              fontWeight: 800,
            }}
          >
            {stateLabel}
          </span>
        </div>
      </div>

      {/* Action Notification Toast */}
      {feedbackMessage && (
        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10b981',
            color: '#6ee7b7',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          ✓ {feedbackMessage}
        </div>
      )}

      {/* Main Incident Header Card */}
      <div className="card">
        <div className="card-header-flex">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 800, color: '#93c5fd' }}>
                INCIDENT #{incident.id}
              </span>
              <StatusBadge status={incident.priority} label={`PRIORITY: ${priorityLabel}`} />
              <span className="demo-tag" style={{ color: '#a78bfa', borderColor: '#7c3aed' }}>
                PHASE 6 VERIFIED
              </span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
              {incident.title}
            </h2>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: '#60a5fa' }}>
              {formatDisplayTime(incident.openedAt || incident.createdAt)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Opened Timestamp</div>
          </div>
        </div>

        {/* Explainability Section */}
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            borderLeft: '4px solid #3b82f6',
            borderRadius: '4px',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
            Incident Explanation &amp; Priority Rationale:
          </div>
          <p style={{ color: 'var(--text-primary)', fontSize: '0.88rem', margin: 0, lineHeight: 1.5 }}>
            {incident.explanation || incident.priorityReason || 'Verified security event satisfied declarative perimeter policy.'}
          </p>
          {incident.priorityReason && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.3rem', fontStyle: 'italic' }}>
              Policy rule: {incident.priorityReason}
            </p>
          )}
        </div>
      </div>

      {/* Dual Column Layout: Left Evidence & Operator Controls / Right Timeline & Context */}
      <div className="command-center-layout">
        {/* Left Column: Evidence Package & Operator Actions */}
        <div className="command-main-column">
          <EvidenceViewer
            incidentId={incident.id}
            cameraId={incident.cameraId}
            cameraName={incident.cameraName}
            timestamp={formatDisplayTime(incident.openedAt || incident.createdAt)}
            evidenceAvailable={incident.evidenceAvailable || (incident.evidenceState === 'READY')}
            evidenceData={evidence}
            onEvidenceUpdated={loadData}
          />

          {/* Operator Action Panel */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: '0.5rem' }}>
              <span>Operator Triage &amp; Response Actions</span>
            </div>
            <div className="card-desc">
              Execute controlled standard operating procedure transitions or escalate for tactical perimeter response.
            </div>

            {/* Note Editor */}
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                Operator Response Notes:
              </label>
              <textarea
                rows={2}
                value={operatorNotes}
                onChange={(e) => setOperatorNotes(e.target.value)}
                placeholder="Enter triage notes, activity observations, false-positive justification, or supervisor notes..."
                disabled={isClosed || isProcessingAction}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              />
              <div style={{ marginTop: '0.35rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleAddNote}
                  disabled={!operatorNotes.trim() || isClosed || isProcessingAction}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}
                >
                  + Add Note to Record
                </button>
              </div>
            </div>

            {/* Existing Notes Display if any */}
            {incident.notes && incident.notes.length > 0 && (
              <div style={{ marginBottom: '1rem', backgroundColor: 'var(--bg-secondary)', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Recorded Operational Notes ({incident.notes.length}):
                </div>
                {incident.notes.map((n, i) => (
                  <div key={n.id || i} style={{ fontSize: '0.78rem', marginBottom: '0.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.25rem' }}>
                    <strong style={{ color: '#93c5fd' }}>{n.authorName}: </strong>
                    <span>{n.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Lifecycle Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={handleAcknowledge}
                disabled={stateLabel !== 'NEW' || isClosed || isProcessingAction}
              >
                👁 ACKNOWLEDGE
              </button>

              <button
                className="btn btn-primary"
                onClick={handleStartReview}
                disabled={isUnderReview || isClosed || isProcessingAction}
              >
                🔍 START REVIEW
              </button>

              <button
                className="btn btn-warning"
                onClick={handleEscalate}
                disabled={stateLabel === 'ESCALATED' || isClosed || isProcessingAction}
              >
                ⚠️ ESCALATE
              </button>

              {/* Close Section with Disposition */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
                <select
                  value={closeDisposition}
                  onChange={(e) => setCloseDisposition(e.target.value as IncidentOutcomeType)}
                  disabled={isClosed || isProcessingAction}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.75rem',
                    padding: '0.35rem 0.5rem',
                    borderRadius: '4px',
                  }}
                >
                  <option value="CONFIRMED_ACTIVITY">CONFIRMED ACTIVITY</option>
                  <option value="BENIGN_ACTIVITY">BENIGN ACTIVITY</option>
                  <option value="FALSE_ALERT">FALSE ALERT</option>
                  <option value="UNRESOLVED">UNRESOLVED</option>
                  <option value="OTHER">OTHER</option>
                </select>

                <button
                  className="btn btn-danger"
                  onClick={handleClose}
                  disabled={isClosed || isProcessingAction}
                >
                  ✓ CLOSE INCIDENT
                </button>
              </div>
            </div>
          </div>

          {/* Phase 7 Cross-Camera Event Correlation Panel */}
          <div className="card">
            <div className="card-header-flex">
              <div className="card-title">
                <span>Possibly Related Cross-Camera Events</span>
                <span className="demo-tag" style={{ color: '#38bdf8', borderColor: '#0284c7' }}>
                  PHASE 7 CORRELATION ({correlations.length})
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Topology &amp; Travel-Time Window Links
              </div>
            </div>

            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid var(--border-subtle)',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                marginTop: '0.5rem',
                marginBottom: '0.75rem',
                lineHeight: 1.4,
              }}
            >
              ℹ️ <strong>Operator Notice:</strong> Cross-camera correlations represent explainable spatio-temporal links
              derived from configured perimeter topology and travel-time windows. A correlation proposal does not imply
              confirmed biometric identity or global tracking. Incidents remain independently reviewable.
            </div>

            {correlations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No cross-camera correlation candidates detected within recent topology travel windows.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {correlations.map((corr) => (
                  <CorrelationCard
                    key={corr.id}
                    correlation={corr}
                    onAccept={handleAcceptCorrelation}
                    onReject={handleRejectCorrelation}
                    onAddNote={handleAddCorrelationNote}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Incident Telemetry & Chronological Timeline */}
        <div className="command-sidebar-column">
          {/* Metadata Card */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: '0.75rem' }}>
              <span>Incident Context &amp; Sensor</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Origin Sensor:</span>
                <Link to={`/cameras/${incident.cameraId}`} style={{ color: '#60a5fa', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {incident.cameraId} →
                </Link>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Sector / Zone:</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {incident.zoneName || incident.lineName || 'Perimeter Zone'}
                </strong>
              </div>

              {incident.trackDisplayId && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Local Track ID:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8', fontWeight: 700 }}>
                    {incident.trackDisplayId} ({incident.objectClass || 'object'})
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Primary Event:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>{incident.primaryEventId}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Linked Events:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {incident.linkedEventIds?.join(', ') || incident.primaryEventId}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Observation Quality:</span>
                <span style={{ color: '#10b981', fontWeight: 600 }}>{incident.observationQuality || 'GOOD'}</span>
              </div>

              {incident.acknowledgedBy && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Acknowledged By:</span>
                  <span>{incident.acknowledgedBy}</span>
                </div>
              )}

              {incident.closedAt && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Closed Disposition:</span>
                  <strong style={{ color: '#10b981' }}>{incident.outcome || 'RESOLVED'}</strong>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Assigned Operator:</span>
                <span>Demo Operator</span>
              </div>
            </div>
          </div>

          {/* Phase 8: Alternative Camera Usable Views Recommendation Card */}
          {alternativeRecs.length > 0 && (
            <div
              className="card"
              style={{
                border:
                  cameraHealth?.healthState === 'DEGRADED' || cameraHealth?.healthState === 'OFFLINE'
                    ? '1px solid #f59e0b'
                    : '1px solid var(--border-color)',
                backgroundColor:
                  cameraHealth?.healthState === 'DEGRADED' || cameraHealth?.healthState === 'OFFLINE'
                    ? 'rgba(245, 158, 11, 0.05)'
                    : undefined,
              }}
            >
              <div className="card-title" style={{ marginBottom: '0.65rem' }}>
                <span>Alternative Usable View</span>
                <span className="demo-tag" style={{ color: '#60a5fa', borderColor: '#3b82f6' }}>
                  PHASE 8 COVERAGE
                </span>
              </div>

              {cameraHealth && (cameraHealth.healthState === 'DEGRADED' || cameraHealth.healthState === 'OFFLINE') && (
                <div
                  style={{
                    padding: '0.45rem 0.65rem',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    color: '#f87171',
                    fontSize: '0.72rem',
                    marginBottom: '0.6rem',
                    fontWeight: 600,
                  }}
                >
                  ⚠️ Incident Camera {incident.cameraId} is {cameraHealth.healthState} ({cameraHealth.reasons?.[0] || 'Suboptimal visibility'}). Operator alternative view recommended below.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {alternativeRecs.slice(0, 2).map((rec) => (
                  <div
                    key={rec.id}
                    style={{
                      padding: '0.6rem 0.75rem',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#93c5fd', fontSize: '0.8rem' }}>
                        {rec.recommendedCameraId}
                      </span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '3px',
                          backgroundColor: rec.status === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: rec.status === 'AVAILABLE' ? '#10b981' : '#f59e0b',
                        }}
                      >
                        {rec.status} ({Math.round((rec.factors?.configuredCoverageQuality || 0) * 100)}% quality)
                      </span>
                    </div>

                    <div style={{ fontSize: '0.74rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {rec.recommendedCameraName || rec.recommendedCameraId}
                    </div>

                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                      {rec.reason}
                    </div>

                    {rec.recommendedCameraId && (
                      <button
                        type="button"
                        onClick={() => navigate(`/cameras/${rec.recommendedCameraId}`)}
                        className="btn btn-outline"
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.3rem 0.6rem',
                          marginTop: '0.2rem',
                          borderColor: '#3b82f6',
                          color: '#60a5fa',
                          fontWeight: 700,
                        }}
                      >
                        OPEN ALTERNATIVE CAMERA ({rec.recommendedCameraId}) →
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontStyle: 'italic' }}>
                Coverage-based view recommendation; does not imply biometric identity continuity.
              </div>
            </div>
          )}

          {/* Unified Chronological Timeline Card */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: '0.75rem' }}>
              <span>Event &amp; Operator Timeline</span>
            </div>
            <IncidentTimeline items={timeline} />
          </div>
        </div>
      </div>
    </div>
  );
};
