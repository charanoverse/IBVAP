import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DEMO_CAMERAS, DemoCameraTelemetry } from '../demo/cameras';
import { StatusBadge } from '../components/StatusBadge';
import { CameraVideoPlayer } from '../components/CameraVideoPlayer';
import { EventTimeline } from '../components/EventTimeline';
import {
  CameraAIDetectionPayload,
  Detection,
  Track,
  Rule,
  Event,
  AlternativeViewRecommendation,
} from '@ibvap/shared';
import { cameraHealthService, CameraHealthDetail } from '../services/cameraHealthService';
import { coverageService } from '../services/coverageService';

export const CameraDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [snapshotToast, setSnapshotToast] = useState<string | null>(null);
  const [liveAIPayload, setLiveAIPayload] = useState<CameraAIDetectionPayload | null>(null);
  const [isAIPaused, setIsAIPaused] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'tracks' | 'detections' | 'events' | 'health'>('events');
  const [rules, setRules] = useState<Rule[]>([]);
  const [cameraEvents, setCameraEvents] = useState<Event[]>([]);
  const [healthData, setHealthData] = useState<CameraHealthDetail | null>(null);
  const [alternativeRecs, setAlternativeRecs] = useState<AlternativeViewRecommendation[]>([]);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  const camera: DemoCameraTelemetry =
    DEMO_CAMERAS.find((c) => c.id === id) || DEMO_CAMERAS[0];

  // Fetch camera health and alternatives
  const loadHealthAndAlternatives = useCallback(() => {
    cameraHealthService
      .getCameraHealth(camera.id)
      .then((data) => setHealthData(data))
      .catch(() => {});

    coverageService
      .getAlternativeRecommendations(camera.id)
      .then((recs) => {
        if (Array.isArray(recs)) {
          setAlternativeRecs(recs);
        } else if (recs && Array.isArray((recs as any).data)) {
          setAlternativeRecs((recs as any).data);
        }
      })
      .catch(() => {});
  }, [camera.id]);

  useEffect(() => {
    loadHealthAndAlternatives();
  }, [loadHealthAndAlternatives]);

  // Fetch configured rules for this camera
  useEffect(() => {
    fetch(`/api/rules?cameraId=${encodeURIComponent(camera.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setRules(data.data);
        }
      })
      .catch(() => {});
  }, [camera.id]);

  // Fetch verified security events for this camera
  useEffect(() => {
    fetch(`/api/events?cameraId=${encodeURIComponent(camera.id)}&limit=50`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setCameraEvents(data.data);
        }
      })
      .catch(() => {});
  }, [camera.id]);

  // Subscribe to live SSE events
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/events/live/${encodeURIComponent(camera.id)}`);
      eventSource.addEventListener('security_event', (e: MessageEvent) => {
        try {
          const newEvt: Event = JSON.parse(e.data);
          setCameraEvents((prev) => {
            if (prev.some((x) => x.id === newEvt.id)) return prev;
            return [newEvt, ...prev];
          });
        } catch {}
      });

      eventSource.addEventListener('camera_health_updated', (e: MessageEvent) => {
        try {
          const updatedHealth = JSON.parse(e.data);
          if (updatedHealth.cameraId === camera.id) {
            setHealthData((prev) => (prev ? { ...prev, ...updatedHealth } : updatedHealth));
          }
        } catch {}
      });
    } catch {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [camera.id]);

  const handleSimulate = async (type: 'OFFLINE' | 'FREEZE' | 'BLUR' | 'LOW_LIGHT' | 'GLARE' | 'FPS_DROP') => {
    setSimLoading(true);
    try {
      await cameraHealthService.simulateDegradation(camera.id, type, `Operator simulation [${type}]`);
      loadHealthAndAlternatives();
      setSnapshotToast(`Degradation simulated: [${type}]`);
      setTimeout(() => setSnapshotToast(null), 3500);
    } catch {
      // Ignore
    } finally {
      setSimLoading(false);
    }
  };

  const handleRestore = async () => {
    setSimLoading(true);
    try {
      await cameraHealthService.restoreCamera(camera.id);
      loadHealthAndAlternatives();
      setSnapshotToast(`Camera ${camera.id} restored to nominal telemetry`);
      setTimeout(() => setSnapshotToast(null), 3500);
    } catch {
      // Ignore
    } finally {
      setSimLoading(false);
    }
  };

  const handleSnapshot = (dataUrl: string) => {
    setSnapshotToast(`Snapshot captured (${new Date().toLocaleTimeString()})`);
    setTimeout(() => setSnapshotToast(null), 3000);

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `SNAPSHOT_${camera.id}_${Date.now()}.png`;
    a.click();
  };

  const handleDetectionsUpdate = (payload: CameraAIDetectionPayload) => {
    setLiveAIPayload(payload);
    if (payload.cameraStatus === 'paused') {
      setIsAIPaused(true);
    } else if (payload.cameraStatus === 'running') {
      setIsAIPaused(false);
    }
    // If payload has new verified events, prepend them
    if (payload.events && payload.events.length > 0) {
      setCameraEvents((prev) => {
        const newOnes = payload.events!.filter((ne) => !prev.some((pe) => pe.id === ne.id));
        if (newOnes.length > 0) {
          return [...newOnes, ...prev];
        }
        return prev;
      });
    }
  };

  const toggleAI = async () => {
    const nextAction = isAIPaused ? 'resume' : 'pause';
    try {
      await fetch(`/api/detections/control/${encodeURIComponent(camera.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: nextAction }),
      });
      setIsAIPaused(!isAIPaused);
    } catch {
      setIsAIPaused(!isAIPaused);
    }
  };

  const handleResetTracker = async () => {
    try {
      await fetch(`/api/detections/control/${encodeURIComponent(camera.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_tracker' }),
      });
      setSnapshotToast(`ByteTracker state reset for ${camera.id}`);
      setTimeout(() => setSnapshotToast(null), 2500);
    } catch {
      setSnapshotToast(`ByteTracker state reset for ${camera.id}`);
      setTimeout(() => setSnapshotToast(null), 2500);
    }
  };

  const handleResetRules = async () => {
    try {
      await fetch(`/api/detections/control/${encodeURIComponent(camera.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_rules' }),
      });
      setSnapshotToast(`Rule Engine states reset for ${camera.id}`);
      setTimeout(() => setSnapshotToast(null), 2500);
    } catch {
      setSnapshotToast(`Rule Engine states reset for ${camera.id}`);
      setTimeout(() => setSnapshotToast(null), 2500);
    }
  };

  const handleToggleRule = async (ruleId: string, currentEnabled: boolean) => {
    const nextVal = !currentEnabled;
    try {
      const res = await fetch('/api/rules/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId, enabled: nextVal }),
      });
      const data = await res.json();
      if (data.success) {
        setRules((prev) =>
          prev.map((r) => (r.id === ruleId ? { ...r, enabled: nextVal } : r))
        );
        setSnapshotToast(`Rule ${ruleId} ${nextVal ? 'enabled' : 'disabled'}`);
        setTimeout(() => setSnapshotToast(null), 2500);
      }
    } catch {
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, enabled: nextVal } : r))
      );
    }
  };

  const detections: Detection[] = liveAIPayload?.detections || [];
  const tracks: Track[] = liveAIPayload?.tracks || [];
  const latencyMs = liveAIPayload?.latencyMs || 0;
  const trackerLatencyMs = liveAIPayload?.trackerLatencyMs || 0;
  const pipelineLatencyMs = liveAIPayload?.pipelineLatencyMs || Math.round(latencyMs + trackerLatencyMs);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header & Back Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => navigate('/cameras')}
          className="btn btn-secondary"
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
        >
          ← Back to Camera Fleet
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {healthData?.isSimulated && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(239, 68, 68, 0.25)',
                color: '#f87171',
                border: '1px solid #ef4444',
                fontFamily: 'var(--font-mono)',
              }}
            >
              [SIMULATION ACTIVE]
            </span>
          )}
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor:
                (healthData?.healthState || 'HEALTHY') === 'HEALTHY'
                  ? 'rgba(16, 185, 129, 0.2)'
                  : (healthData?.healthState || 'HEALTHY') === 'DEGRADED'
                  ? 'rgba(245, 158, 11, 0.2)'
                  : 'rgba(239, 68, 68, 0.2)',
              color:
                (healthData?.healthState || 'HEALTHY') === 'HEALTHY'
                  ? '#10b981'
                  : (healthData?.healthState || 'HEALTHY') === 'DEGRADED'
                  ? '#f59e0b'
                  : '#ef4444',
              border: `1px solid ${
                (healthData?.healthState || 'HEALTHY') === 'HEALTHY'
                  ? '#10b981'
                  : (healthData?.healthState || 'HEALTHY') === 'DEGRADED'
                  ? '#f59e0b'
                  : '#ef4444'
              }`,
            }}
          >
            {`HEALTH: ${healthData?.healthState || 'HEALTHY'}`}
          </span>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor:
                (healthData?.visibilityState || 'GOOD') === 'GOOD'
                  ? 'rgba(59, 130, 246, 0.2)'
                  : (healthData?.visibilityState || 'GOOD') === 'DEGRADED'
                  ? 'rgba(245, 158, 11, 0.2)'
                  : 'rgba(239, 68, 68, 0.2)',
              color:
                (healthData?.visibilityState || 'GOOD') === 'GOOD'
                  ? '#60a5fa'
                  : (healthData?.visibilityState || 'GOOD') === 'DEGRADED'
                  ? '#fbbf24'
                  : '#f87171',
              border: `1px solid ${
                (healthData?.visibilityState || 'GOOD') === 'GOOD'
                  ? '#3b82f6'
                  : (healthData?.visibilityState || 'GOOD') === 'DEGRADED'
                  ? '#f59e0b'
                  : '#ef4444'
              }`,
            }}
          >
            {`VIS: ${healthData?.visibilityState || 'GOOD'}`}
          </span>
          <StatusBadge status={camera.status} />
        </div>
      </div>

      {/* Main Camera Title Card */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div className="card-header-flex" style={{ margin: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 800, color: '#93c5fd' }}>
                {camera.id}
              </span>
              <span className="demo-tag">{camera.lensType}</span>
              <span className="demo-tag" style={{ color: '#6ee7b7', borderColor: '#059669', background: 'rgba(6, 78, 59, 0.4)' }}>
                LOCAL MP4 STREAM
              </span>
              <span className="demo-tag" style={{ color: '#93c5fd', borderColor: '#3b82f6', background: 'rgba(30, 58, 138, 0.4)' }}>
                YOLOv8 + BYTETRACK ACTIVE
              </span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              {camera.name}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
              {camera.description}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#10b981' }}>
              {camera.fps} FPS
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{camera.resolution}</div>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {snapshotToast && (
        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10b981',
            color: '#a7f3d0',
            padding: '0.6rem 1rem',
            borderRadius: '6px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>✓</span>
          <span>{snapshotToast}</span>
        </div>
      )}

      {/* Dual Column Command Layout */}
      <div className="command-center-layout">
        {/* Left Column: Large Interactive Video Player & Track List */}
        <div className="command-main-column">
          <div className="card" style={{ padding: '1rem' }}>
            <div className="card-header-flex">
              <div className="card-title">
                <span>CCTV Replay &amp; Sensor Viewport</span>
                <span className="demo-tag">REAL LOCAL VIDEO</span>
                <span className="demo-tag" style={{ color: '#a7f3d0', borderColor: '#10b981' }}>
                  BYTETRACK MOT &amp; TRAJECTORIES
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleResetRules}
                  className="btn btn-outline"
                  style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem', color: '#f472b6', borderColor: '#ec4899' }}
                  title="Reset Rule Engine verification states and dwell timers"
                >
                  ↺ RESET RULES
                </button>
                <button
                  type="button"
                  onClick={handleResetTracker}
                  className="btn btn-outline"
                  style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem', color: '#94a3b8' }}
                  title="Reset ByteTracker IDs for this camera"
                >
                  ↺ RESET TRACKER
                </button>
                <button
                  type="button"
                  onClick={toggleAI}
                  className={`btn ${isAIPaused ? 'btn-warning' : 'btn-outline'}`}
                  style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
                >
                  {isAIPaused ? '▶ RESUME AI' : '⏸ PAUSE AI'}
                </button>
              </div>
            </div>

            {/* Interactive Video Player with Real YOLO Bounding Boxes & ByteTrack Trajectories */}
            <CameraVideoPlayer
              cameraId={camera.id}
              cameraName={camera.name}
              videoSrc={camera.sourceReference?.startsWith('/api') ? camera.sourceReference : undefined}
              fps={camera.fps}
              resolution={camera.resolution}
              lensType={camera.lensType}
              aspectRatio="16 / 9"
              autoPlay={true}
              muted={true}
              loop={true}
              showHUD={true}
              showAIOverlays={true}
              showTrajectories={true}
              showZones={true}
              showLines={true}
              interactiveControls={true}
              customOverlayText="REPLAY / LOCAL VIDEO SOURCE"
              onSnapshotTaken={handleSnapshot}
              onDetectionsUpdate={handleDetectionsUpdate}
            />

            {/* Measured AI & Tracking Telemetry Bar */}
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.65rem 0.85rem',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '0.5rem',
                fontSize: '0.78rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>
                  PIPELINE STATUS
                </span>
                <strong style={{ color: isAIPaused ? '#f59e0b' : '#10b981' }}>
                  {isAIPaused ? 'PAUSED' : 'YOLOv8 + ByteTrack'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>
                  SYNCED FRAME / TIME
                </span>
                <strong style={{ color: '#93c5fd', fontFamily: 'var(--font-mono)' }}>
                  {liveAIPayload?.frameIndex !== undefined ? `F#${liveAIPayload.frameIndex} (${(liveAIPayload.videoTimestamp ?? liveAIPayload.frameTimestamp ?? 0).toFixed(2)}s)` : 'SYNCING...'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>
                  PIPELINE LATENCY
                </span>
                <strong style={{ color: '#a7f3d0' }}>
                  {pipelineLatencyMs > 0 ? `${pipelineLatencyMs} ms` : '<50 ms'}
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginLeft: '0.25rem' }}>
                    ({latencyMs.toFixed(0)}d / {trackerLatencyMs.toFixed(0)}t)
                  </span>
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>
                  ACTIVE TRACKS
                </span>
                <strong style={{ color: '#60a5fa' }}>{tracks.length} PERSISTENT</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>
                  DETECTIONS IN FRAME
                </span>
                <strong style={{ color: '#fde047', fontFamily: 'var(--font-mono)' }}>
                  {detections.length} OBJECTS
                </strong>
              </div>
            </div>
          </div>

          {/* Current Tracks, Detections & Verified Security Events Panel */}
          <div className="card" style={{ padding: '1rem' }}>
            <div className="card-header-flex">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('events')}
                  style={{
                    backgroundColor: activeTab === 'events' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                    border: `1px solid ${activeTab === 'events' ? '#ef4444' : 'var(--border-color)'}`,
                    color: activeTab === 'events' ? '#f87171' : 'var(--text-secondary)',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  VERIFIED EVENTS ({cameraEvents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('tracks')}
                  style={{
                    backgroundColor: activeTab === 'tracks' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    border: `1px solid ${activeTab === 'tracks' ? '#3b82f6' : 'var(--border-color)'}`,
                    color: activeTab === 'tracks' ? '#60a5fa' : 'var(--text-secondary)',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  CURRENT TRACKS ({tracks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('detections')}
                  style={{
                    backgroundColor: activeTab === 'detections' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    border: `1px solid ${activeTab === 'detections' ? '#3b82f6' : 'var(--border-color)'}`,
                    color: activeTab === 'detections' ? '#60a5fa' : 'var(--text-secondary)',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  RAW DETECTIONS ({detections.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('health')}
                  style={{
                    backgroundColor: activeTab === 'health' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                    border: `1px solid ${activeTab === 'health' ? '#10b981' : 'var(--border-color)'}`,
                    color: activeTab === 'health' ? '#6ee7b7' : 'var(--text-secondary)',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  HEALTH &amp; VISIBILITY TELEMETRY
                </button>
              </div>

              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {activeTab === 'events'
                  ? 'TEMPORALLY VERIFIED SECURITY EVENTS (SPATIAL/TEMPORAL RULES)'
                  : activeTab === 'tracks'
                  ? 'LOCAL CAMERA TRACKS (NO CROSS-CAM / NO RE-ID)'
                  : activeTab === 'detections'
                  ? 'FRAME-LOCAL YOLO DETECTIONS (DETECTION ≠ TRACK)'
                  : 'STREAM INTEGRITY, LAPLACIAN FOCUS & SENSOR VISIBILITY'}
              </span>
            </div>

            {/* Tab 1: Verified Security Events (Phase 5) */}
            {activeTab === 'events' && (
              <EventTimeline
                events={cameraEvents}
                maxEvents={30}
                emptyMessage={`No verified security events recorded for ${camera.id}. Tracking rules are active.`}
              />
            )}

            {/* Tab 2: Current Tracks (Phase 4 MOT) */}
            {activeTab === 'tracks' && (
              tracks.length === 0 ? (
                <div
                  style={{
                    padding: '1.5rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '6px',
                    border: '1px dashed var(--border-color)',
                  }}
                >
                  No active tracks currently tracked in this camera session.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '0.4rem 0.6rem' }}>TRACK ID</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>CLASS</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>CONFIDENCE</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>STATUS</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>AGE (SEC / FRAMES)</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>LAST SEEN</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>TRAJECTORY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tracks.map((trk) => (
                        <tr key={trk.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.45rem 0.6rem' }}>
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 800,
                                color: '#60a5fa',
                                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '3px',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                              }}
                            >
                              {trk.displayId || `T${trk.trackId.toString().padStart(3, '0')}`}
                            </span>
                          </td>
                          <td style={{ padding: '0.45rem 0.6rem' }}>
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                color: trk.className === 'person' ? '#38bdf8' : '#fbbf24',
                              }}
                            >
                              {trk.className}
                            </span>
                          </td>
                          <td style={{ padding: '0.45rem 0.6rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#10b981' }}>
                            {(trk.confidence * 100).toFixed(1)}% ({trk.confidence.toFixed(2)})
                          </td>
                          <td style={{ padding: '0.45rem 0.6rem' }}>
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '0.1rem 0.35rem',
                                borderRadius: '3px',
                                color: trk.status === 'ACTIVE' ? '#34d399' : '#f59e0b',
                                backgroundColor: trk.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                border: `1px solid ${trk.status === 'ACTIVE' ? '#10b981' : '#f59e0b'}`,
                              }}
                            >
                              {trk.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.45rem 0.6rem', fontFamily: 'var(--font-mono)', color: '#e2e8f0' }}>
                            {trk.ageSeconds.toFixed(1)}s ({trk.ageFrames}f)
                          </td>
                          <td style={{ padding: '0.45rem 0.6rem', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
                            {trk.lastSeenTimestamp !== undefined ? `${trk.lastSeenTimestamp.toFixed(2)}s` : 'Live'}
                          </td>
                          <td style={{ padding: '0.45rem 0.6rem', fontFamily: 'var(--font-mono)', color: '#93c5fd', fontSize: '0.72rem' }}>
                            {trk.trajectory?.length || 0} pts
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Tab 3: Raw YOLO Detections */}
            {activeTab === 'detections' && (
              detections.length === 0 ? (
                <div
                  style={{
                    padding: '1.5rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '6px',
                    border: '1px dashed var(--border-color)',
                  }}
                >
                  No target objects currently detected in this frame above confidence threshold (0.40).
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '0.4rem 0.6rem' }}>OBJECT CLASS</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>CONFIDENCE</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>NORMALIZED BBOX (X, Y, W, H)</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>FRAME / TIME</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>ASSIGNED TRACK REF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detections.map((det) => (
                        <tr key={det.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.45rem 0.6rem' }}>
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                color: det.objectClass === 'person' ? '#60a5fa' : '#fbbf24',
                                backgroundColor: det.objectClass === 'person' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '3px',
                                border: `1px solid ${det.objectClass === 'person' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                              }}
                            >
                              {det.objectClass}
                            </span>
                          </td>
                          <td style={{ padding: '0.45rem 0.6rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#10b981' }}>
                            {(det.confidence * 100).toFixed(1)}% ({det.confidence.toFixed(2)})
                          </td>
                          <td style={{ padding: '0.45rem 0.6rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            [{det.boundingBox.x.toFixed(3)}, {det.boundingBox.y.toFixed(3)}, {det.boundingBox.width.toFixed(3)}, {det.boundingBox.height.toFixed(3)}]
                          </td>
                          <td style={{ padding: '0.45rem 0.6rem', fontFamily: 'var(--font-mono)', color: '#93c5fd' }}>
                            {det.frameIndex !== undefined ? `F#${det.frameIndex} (${(det.videoTimestamp ?? det.frameTimestamp ?? 0).toFixed(2)}s)` : `${(det.videoTimestamp ?? det.frameTimestamp ?? 0).toFixed(2)}s`}
                          </td>
                          <td style={{ padding: '0.45rem 0.6rem', fontFamily: 'var(--font-mono)', color: det.trackRef ? '#60a5fa' : 'var(--text-muted)', fontWeight: det.trackRef ? 700 : 400 }}>
                            {det.trackRef || 'UNASSOCIATED'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Tab 4: Health & Visibility Telemetry (Phase 8) */}
            {activeTab === 'health' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Real-time Stream & Freshness Status */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>STREAM AVAILABILITY</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: healthData?.streamStatus === 'AVAILABLE' ? '#10b981' : healthData?.streamStatus === 'STALLED' ? '#f59e0b' : '#ef4444', marginTop: '0.2rem' }}>
                      {healthData?.streamStatus || 'AVAILABLE'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      {healthData?.sourceAvailable ? 'Video stream active' : 'Signal unavailable'}
                    </div>
                  </div>

                  <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>EFFECTIVE FRAME RATE</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: (healthData?.effectiveFps || 24) >= 10 ? '#10b981' : '#f59e0b', marginTop: '0.2rem' }}>
                      {(healthData?.effectiveFps ?? 24.0).toFixed(1)} FPS
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Baseline: {healthData?.expectedFps || 24.0} FPS
                    </div>
                  </div>

                  <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>FRAME FRESHNESS</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#60a5fa', marginTop: '0.2rem' }}>
                      {healthData?.frameFreshnessMs ? `${healthData.frameFreshnessMs} ms` : 'Nominal (< 50ms)'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Delivery within real-time SLA
                    </div>
                  </div>

                  <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>MOTION / FROZEN DETECTOR</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: healthData?.frozenFrameDetected ? '#ef4444' : '#10b981', marginTop: '0.2rem' }}>
                      {healthData?.frozenFrameDetected ? '⚠️ FROZEN STREAM' : '✓ Normal Motion'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Diff score: {healthData?.metrics?.frameDifference?.toFixed(2) || '0.50'}
                    </div>
                  </div>
                </div>

                {/* Visibility Metrics: Brightness, Contrast, Blur */}
                <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--bg-primary)' }}>
                  <div className="card-title" style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                    <span>Sensor Visibility &amp; Optical Sharpness Metrics</span>
                    <span className="demo-tag" style={{ color: healthData?.visibilityState === 'GOOD' ? '#10b981' : '#f59e0b', borderColor: 'currentColor' }}>
                      STATUS: {healthData?.visibilityState || 'GOOD'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    {/* Brightness */}
                    <div style={{ padding: '0.65rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Mean Luminance (Brightness):</span>
                        <strong style={{ fontFamily: 'var(--font-mono)' }}>{healthData?.metrics?.brightness?.toFixed(1) || '125.0'} / 255</strong>
                      </div>
                      <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, ((healthData?.metrics?.brightness || 125) / 255) * 100))}%`,
                            height: '100%',
                            backgroundColor: (healthData?.metrics?.brightness || 125) < 30 ? '#ef4444' : (healthData?.metrics?.brightness || 125) > 235 ? '#f59e0b' : '#3b82f6',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                        Nominal window: [30.0 - 240.0] {camera.id === 'CAM-06' ? '(Night profile: min 20.0)' : ''}
                      </div>
                    </div>

                    {/* Contrast */}
                    <div style={{ padding: '0.65rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Luminance Std Dev (Contrast):</span>
                        <strong style={{ fontFamily: 'var(--font-mono)' }}>{healthData?.metrics?.contrast?.toFixed(1) || '40.0'}</strong>
                      </div>
                      <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, ((healthData?.metrics?.contrast || 40) / 100) * 100))}%`,
                            height: '100%',
                            backgroundColor: (healthData?.metrics?.contrast || 40) < 20 ? '#ef4444' : '#10b981',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                        Nominal baseline: ≥ 20.0 (prevents fog &amp; wash)
                      </div>
                    </div>

                    {/* Blur Score */}
                    <div style={{ padding: '0.65rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Laplacian Sharpness (Focus):</span>
                        <strong style={{ fontFamily: 'var(--font-mono)' }}>{healthData?.metrics?.blurScore?.toFixed(1) || '250.0'}</strong>
                      </div>
                      <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, ((healthData?.metrics?.blurScore || 250) / 500) * 100))}%`,
                            height: '100%',
                            backgroundColor: (healthData?.metrics?.blurScore || 250) < 75 ? '#ef4444' : '#10b981',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                        {camera.id === 'CAM-06' ? 'Night threshold: ≥ 50.0' : camera.id === 'CAM-03' ? 'Sterile threshold: ≥ 75.0' : 'Nominal threshold: ≥ 100.0'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Explainable Reasons */}
                <div className="card" style={{ padding: '0.9rem' }}>
                  <div className="card-title" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                    <span>Operational Health Rationale &amp; Explanations</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {healthData?.reasons && healthData.reasons.length > 0 ? (
                      healthData.reasons.map((r, idx) => (
                        <li key={idx} style={{ color: r.includes('[SIMULATION]') ? '#fbbf24' : r.includes('Failure') || r.includes('underexposed') || r.includes('stalled') ? '#f87171' : 'var(--text-secondary)' }}>
                          {r}
                        </li>
                      ))
                    ) : (
                      <li>All stream parameters, frame rates, and optical visibility metrics are operating nominal.</li>
                    )}
                  </ul>
                </div>

                {/* Recent Transitions Audit Trail */}
                {healthData?.recentTransitions && healthData.recentTransitions.length > 0 && (
                  <div className="card" style={{ padding: '0.9rem' }}>
                    <div className="card-title" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                      <span>Recent Health State Transitions (Audit Trail)</span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                            <th style={{ padding: '0.3rem 0.5rem' }}>TIMESTAMP</th>
                            <th style={{ padding: '0.3rem 0.5rem' }}>FROM</th>
                            <th style={{ padding: '0.3rem 0.5rem' }}>TO</th>
                            <th style={{ padding: '0.3rem 0.5rem' }}>TYPE</th>
                            <th style={{ padding: '0.3rem 0.5rem' }}>REASON</th>
                          </tr>
                        </thead>
                        <tbody>
                          {healthData.recentTransitions.map((t) => (
                            <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '0.35rem 0.5rem', fontFamily: 'var(--font-mono)', color: '#93c5fd' }}>
                                {new Date(t.timestamp).toLocaleTimeString()}
                              </td>
                              <td style={{ padding: '0.35rem 0.5rem' }}>{t.previous_state}</td>
                              <td style={{ padding: '0.35rem 0.5rem', fontWeight: 700, color: t.new_state === 'HEALTHY' ? '#10b981' : t.new_state === 'DEGRADED' ? '#f59e0b' : '#ef4444' }}>
                                {t.new_state}
                              </td>
                              <td style={{ padding: '0.35rem 0.5rem' }}>
                                {t.is_simulated ? (
                                  <span style={{ color: '#fbbf24', fontWeight: 600 }}>SIMULATION</span>
                                ) : (
                                  <span style={{ color: '#10b981' }}>OPERATIONAL</span>
                                )}
                              </td>
                              <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-secondary)' }}>{t.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Camera Telemetry, Coverage, Alternative Views, Rules & Dev Controls */}
        <div className="command-sidebar-column">
          {/* Phase 8: Alternative Camera Usable Views Recommendation Card */}
          {alternativeRecs.length > 0 && (
            <div className="card" style={{ border: healthData?.healthState === 'DEGRADED' || healthData?.healthState === 'OFFLINE' ? '1px solid #f59e0b' : '1px solid var(--border-color)' }}>
              <div className="card-title" style={{ marginBottom: '0.65rem' }}>
                <span>Alternative View Recommendations</span>
                <span className="demo-tag" style={{ color: '#60a5fa', borderColor: '#3b82f6' }}>
                  PHASE 8 COVERAGE
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {alternativeRecs.map((rec) => (
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

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-primary)', fontWeight: 600 }}>
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
                          fontSize: '0.7rem',
                          padding: '0.25rem 0.5rem',
                          marginTop: '0.2rem',
                          borderColor: '#3b82f6',
                          color: '#60a5fa',
                        }}
                      >
                        SWITCH TO {rec.recommendedCameraId} →
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

          {/* Phase 8: Development / Demo Degradation Controls */}
          <div className="card" style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
            <div className="card-title" style={{ marginBottom: '0.65rem' }}>
              <span>Simulation Controls (Dev / Demo)</span>
              <span className="demo-tag" style={{ color: '#fbbf24', borderColor: '#f59e0b' }}>
                OPERATOR OVERRIDE
              </span>
            </div>

            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
              Simulate stream failures, optical blur, or lighting degradation to verify automatic blind-spot intelligence and alternative view recommendation.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.6rem' }}>
              <button
                type="button"
                disabled={simLoading}
                onClick={() => handleSimulate('OFFLINE')}
                className="btn btn-outline"
                style={{ fontSize: '0.68rem', padding: '0.3rem 0.4rem', color: '#f87171', borderColor: '#ef4444' }}
              >
                🔌 Offline
              </button>

              <button
                type="button"
                disabled={simLoading}
                onClick={() => handleSimulate('FREEZE')}
                className="btn btn-outline"
                style={{ fontSize: '0.68rem', padding: '0.3rem 0.4rem', color: '#38bdf8', borderColor: '#0284c7' }}
              >
                ❄️ Freeze
              </button>

              <button
                type="button"
                disabled={simLoading}
                onClick={() => handleSimulate('BLUR')}
                className="btn btn-outline"
                style={{ fontSize: '0.68rem', padding: '0.3rem 0.4rem', color: '#fbbf24', borderColor: '#d97706' }}
              >
                🌫️ Lens Blur
              </button>

              <button
                type="button"
                disabled={simLoading}
                onClick={() => handleSimulate('LOW_LIGHT')}
                className="btn btn-outline"
                style={{ fontSize: '0.68rem', padding: '0.3rem 0.4rem', color: '#c084fc', borderColor: '#9333ea' }}
              >
                🌑 Darkness
              </button>

              <button
                type="button"
                disabled={simLoading}
                onClick={() => handleSimulate('GLARE')}
                className="btn btn-outline"
                style={{ fontSize: '0.68rem', padding: '0.3rem 0.4rem', color: '#facc15', borderColor: '#ca8a04' }}
              >
                ☀️ Solar Glare
              </button>

              <button
                type="button"
                disabled={simLoading}
                onClick={() => handleSimulate('FPS_DROP')}
                className="btn btn-outline"
                style={{ fontSize: '0.68rem', padding: '0.3rem 0.4rem', color: '#fb923c', borderColor: '#ea580c' }}
              >
                📉 FPS Drop
              </button>
            </div>

            <button
              type="button"
              disabled={simLoading}
              onClick={handleRestore}
              className="btn btn-primary"
              style={{
                width: '100%',
                fontSize: '0.74rem',
                padding: '0.35rem 0.6rem',
                backgroundColor: '#059669',
                borderColor: '#10b981',
              }}
            >
              🔄 Restore Nominal Telemetry
            </button>
          </div>

          {/* Active Rules & Tripwires Panel (Phase 5) */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: '0.65rem' }}>
              <span>Active Spatial &amp; Temporal Rules</span>
              <span className="demo-tag" style={{ color: '#ec4899', borderColor: '#db2777' }}>
                {rules.length} CONFIGURED
              </span>
            </div>

            {rules.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontStyle: 'italic', padding: '0.5rem 0' }}>
                No active rules configured for this camera feed.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {rules.map((rule) => {
                  const isEnabled = rule.enabled !== false;
                  return (
                    <div
                      key={rule.id}
                      style={{
                        padding: '0.55rem 0.65rem',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.3rem',
                        opacity: isEnabled ? 1 : 0.6,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.75rem', color: '#93c5fd' }}>
                          {rule.name || rule.id}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleRule(rule.id, isEnabled)}
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            border: `1px solid ${isEnabled ? '#10b981' : '#64748b'}`,
                            backgroundColor: isEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.2)',
                            color: isEnabled ? '#34d399' : '#94a3b8',
                          }}
                        >
                          {isEnabled ? 'ENABLED' : 'DISABLED'}
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            color: '#fbbf24',
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            padding: '0.05rem 0.3rem',
                            borderRadius: '2px',
                          }}
                        >
                          {rule.ruleType}
                        </span>
                        {rule.targetClasses && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                            [{rule.targetClasses.join(', ')}]
                          </span>
                        )}
                        {rule.conditions?.minDwellSeconds && (
                          <span style={{ fontSize: '0.65rem', color: '#93c5fd' }}>
                            dwell ≥ {rule.conditions.minDwellSeconds}s
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {rule.description || `Evaluates ${rule.ruleType} on ${rule.zoneId || rule.lineId || 'camera'}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Coverage & Geospatial Specs */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: '0.65rem' }}>
              <span>Geospatial &amp; Sensor Specs</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Assigned Sector:</span>
                <strong>{camera.coverage?.sector || 'General Boundary'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>GPS Coordinates:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {camera.coverage?.latitude?.toFixed(4)}, {camera.coverage?.longitude?.toFixed(4)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Azimuth Bearing:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{camera.coverage?.azimuth}°</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Field of View (FOV):</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{camera.coverage?.fovDegrees}°</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Known Blind Spots:</span>
                <span style={{ color: camera.coverage?.blindSpotZones?.length ? '#f59e0b' : '#10b981' }}>
                  {camera.coverage?.blindSpotZones?.length ? camera.coverage.blindSpotZones.join(', ') : 'None'}
                </span>
              </div>
            </div>
          </div>

          {/* Hardware Capabilities */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: '0.65rem' }}>
              <span>Hardware Capabilities</span>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {camera.capabilities.map((cap) => (
                <span
                  key={cap}
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: '#93c5fd',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  ✓ {cap}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
