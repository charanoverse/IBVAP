import React, { useState, useEffect } from 'react';
import { Evidence, IncidentEvidenceState } from '@ibvap/shared';
import { CameraVideoPlayer } from './CameraVideoPlayer';
import { incidentService } from '../services/incidentService';

interface EvidenceViewerProps {
  incidentId: string;
  cameraId: string;
  cameraName?: string;
  timestamp?: string;
  evidenceAvailable?: boolean;
  evidenceData?: Evidence | null;
  onEvidenceUpdated?: () => void;
}

type EvidenceSegment = 'PRE_EVENT' | 'EVENT' | 'POST_EVENT' | 'SNAPSHOT';

export const EvidenceViewer: React.FC<EvidenceViewerProps> = ({
  incidentId,
  cameraId,
  cameraName = 'Security Camera',
  timestamp = '',
  evidenceAvailable = false,
  evidenceData,
  onEvidenceUpdated,
}) => {
  const [activeSegment, setActiveSegment] = useState<EvidenceSegment>('EVENT');
  const [evidence, setEvidence] = useState<Evidence | null>(evidenceData || null);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);

  useEffect(() => {
    if (evidenceData) {
      setEvidence(evidenceData);
    } else {
      incidentService.getIncidentEvidence(incidentId).then((data) => {
        if (data) setEvidence(data);
      });
    }
  }, [incidentId, evidenceData]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const res = await incidentService.retryEvidence(incidentId);
      if (res) {
        setEvidence(res);
        if (onEvidenceUpdated) onEvidenceUpdated();
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    if (!evidence) return;
    setVerifyStatus('Verifying SHA-256 integrity...');
    try {
      const res = await incidentService.verifyEvidence(evidence.id);
      if (res && res.status === 'MATCH') {
        setVerifyStatus('✓ HASH MATCH: SHA-256 integrity verified');
      } else {
        setVerifyStatus('⚠ HASH MISMATCH: File integrity check failed');
      }
    } catch {
      setVerifyStatus('Error during hash verification');
    }
  };

  const getMediaSrc = () => {
    if (!evidence || evidence.status !== 'READY') {
      return `/api/cameras/${encodeURIComponent(cameraId)}/video`;
    }

    switch (activeSegment) {
      case 'PRE_EVENT':
        return `/api/evidence/${encodeURIComponent(evidence.id)}/file/pre-event.mp4`;
      case 'EVENT':
        return `/api/evidence/${encodeURIComponent(evidence.id)}/file/event.mp4`;
      case 'POST_EVENT':
        return `/api/evidence/${encodeURIComponent(evidence.id)}/file/post-event.mp4`;
      case 'SNAPSHOT':
        return `/api/evidence/${encodeURIComponent(evidence.id)}/file/snapshot.jpg`;
    }
  };

  const getCurrentHash = () => {
    if (!evidence?.hashes) return evidence?.evidenceHash || 'Pending calculation';
    switch (activeSegment) {
      case 'PRE_EVENT':
        return evidence.hashes.preEvent || 'N/A';
      case 'EVENT':
        return evidence.hashes.event || 'N/A';
      case 'POST_EVENT':
        return evidence.hashes.postEvent || 'N/A';
      case 'SNAPSHOT':
        return evidence.hashes.snapshot || 'N/A';
    }
  };

  const getSegmentOverlayText = () => {
    switch (activeSegment) {
      case 'PRE_EVENT':
        return `FORENSIC BUFFER (PRE-EVENT T - ${evidence?.timestamps?.preStartSeconds?.toFixed(1) || 10}s)`;
      case 'EVENT':
        return `FORENSIC CLIP (EVENT OCCURRENCE ${evidence?.timestamps?.eventStartSeconds?.toFixed(1) || 0}s → ${evidence?.timestamps?.eventEndSeconds?.toFixed(1) || 0}s)`;
      case 'POST_EVENT':
        return `FORENSIC BUFFER (POST-EVENT T + ${evidence?.timestamps?.postEndSeconds?.toFixed(1) || 10}s)`;
      case 'SNAPSHOT':
        return `VERIFIED FRAME SNAPSHOT (T = ${evidence?.timestamps?.snapshotTimestampSeconds?.toFixed(1) || 0}s)`;
    }
  };

  const evidenceStatus: IncidentEvidenceState = evidence?.status || (evidenceAvailable ? 'READY' : 'PROCESSING');

  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div className="card-header-flex">
        <div className="card-title">
          <span>Forensic Evidence Playback</span>
          <span
            className="demo-tag"
            style={{
              color: evidenceStatus === 'READY' ? '#6ee7b7' : evidenceStatus === 'FAILED' ? '#fca5a5' : '#fcd34d',
              borderColor: evidenceStatus === 'READY' ? '#059669' : evidenceStatus === 'FAILED' ? '#dc2626' : '#d97706',
              background: evidenceStatus === 'READY' ? 'rgba(6, 78, 59, 0.4)' : 'rgba(127, 29, 29, 0.4)',
            }}
          >
            {evidenceStatus === 'READY' ? 'EVIDENCE READY' : evidenceStatus === 'FAILED' ? 'EXTRACTION FAILED' : 'PROCESSING BUFFER'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {evidenceStatus === 'FAILED' ? (
            <button
              className="btn btn-danger"
              onClick={handleRetry}
              disabled={isRetrying}
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}
            >
              {isRetrying ? 'Retrying Extraction...' : '↻ RETRY EVIDENCE'}
            </button>
          ) : (
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
              {evidenceStatus === 'READY' ? '✓ FORENSIC PACKAGE ATTACHED' : '⏳ EXTRACTING TEMPORAL BUFFER'}
            </span>
          )}
        </div>
      </div>

      {/* Segment Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeSegment === 'PRE_EVENT' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSegment('PRE_EVENT')}
          style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
        >
          ⏮ PRE-EVENT (T - 10s)
        </button>

        <button
          className={`btn ${activeSegment === 'EVENT' ? 'btn-danger' : 'btn-secondary'}`}
          onClick={() => setActiveSegment('EVENT')}
          style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
        >
          🔴 EVENT FOCUS
        </button>

        <button
          className={`btn ${activeSegment === 'POST_EVENT' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSegment('POST_EVENT')}
          style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
        >
          ⏭ POST-EVENT (T + 10s)
        </button>

        <button
          className={`btn ${activeSegment === 'SNAPSHOT' ? 'btn-outline' : 'btn-secondary'}`}
          onClick={() => setActiveSegment('SNAPSHOT')}
          style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
        >
          📷 SNAPSHOT FRAME
        </button>
      </div>

      {/* Media Playback Area */}
      {activeSegment === 'SNAPSHOT' ? (
        <div style={{ position: 'relative', width: '100%', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#000', minHeight: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img
            src={getMediaSrc()}
            alt={`Incident ${incidentId} Snapshot Frame`}
            style={{ width: '100%', maxHeight: '420px', objectFit: 'contain', display: 'block' }}
            onError={(e) => {
              // Fallback
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              color: '#fff',
              fontSize: '0.72rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {getSegmentOverlayText()}
          </div>
        </div>
      ) : (
        <CameraVideoPlayer
          key={`${activeSegment}-${evidence?.id || 'live'}`}
          cameraId={cameraId}
          cameraName={cameraName}
          videoSrc={getMediaSrc()}
          customOverlayText={getSegmentOverlayText()}
          interactiveControls={true}
          autoPlay={true}
          muted={true}
          loop={true}
          showHUD={true}
        />
      )}

      {/* Forensic Integrity & Hash Bar */}
      <div
        style={{
          marginTop: '0.75rem',
          padding: '0.65rem 0.85rem',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          fontSize: '0.75rem',
        }}
      >
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Incident ID: </span>
          <strong style={{ fontFamily: 'var(--font-mono)', color: '#93c5fd' }}>#{incidentId}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Sensor Origin: </span>
          <strong style={{ color: 'var(--text-primary)' }}>{cameraId}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Timestamp: </span>
          <strong style={{ fontFamily: 'var(--font-mono)' }}>{timestamp}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Active Segment: </span>
          <span style={{ fontFamily: 'var(--font-mono)', color: '#60a5fa', fontWeight: 600 }}>{activeSegment}</span>
        </div>
        <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>SHA-256 Hash: </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: '#a7f3d0', fontSize: '0.72rem' }}>
              {getCurrentHash()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {verifyStatus && <span style={{ fontSize: '0.72rem', color: verifyStatus.includes('MATCH') ? '#34d399' : '#f87171', fontWeight: 600 }}>{verifyStatus}</span>}
            <button
              onClick={handleVerifyIntegrity}
              className="btn btn-outline"
              style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}
              title="Verify cryptographic integrity of evidence files against manifest"
            >
              Verify SHA-256
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
