import React, { useState } from 'react';
import { Correlation, CorrelationState } from '@ibvap/shared';

interface CorrelationCardProps {
  correlation: Correlation;
  onAccept?: (id: string, note?: string) => Promise<void>;
  onReject?: (id: string, note?: string) => Promise<void>;
  onAddNote?: (id: string, note: string) => Promise<void>;
  compact?: boolean;
}

export const CorrelationCard: React.FC<CorrelationCardProps> = ({
  correlation,
  onAccept,
  onReject,
  onAddNote,
  compact = false,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');

  const scorePct = Math.round((correlation.score ?? correlation.confidence ?? 0) * 100);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 65) return '#f59e0b'; // Amber
    return '#94a3b8'; // Muted
  };

  const getStateBadgeStyle = (state: CorrelationState) => {
    switch (state) {
      case 'accepted':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.4)' };
      case 'rejected':
        return { bg: 'rgba(239, 68, 68, 0.12)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
      case 'candidate':
      default:
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.4)' };
    }
  };

  const handleAccept = async () => {
    if (!onAccept) return;
    setIsProcessing(true);
    try {
      await onAccept(correlation.id, noteText.trim() || undefined);
      setShowNoteInput(false);
      setNoteText('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    setIsProcessing(true);
    try {
      await onReject(correlation.id, noteText.trim() || undefined);
      setShowNoteInput(false);
      setNoteText('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveNote = async () => {
    if (!onAddNote || !noteText.trim()) return;
    setIsProcessing(true);
    try {
      await onAddNote(correlation.id, noteText.trim());
      setShowNoteInput(false);
      setNoteText('');
    } finally {
      setIsProcessing(false);
    }
  };

  const stateStyle = getStateBadgeStyle(correlation.state);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card, #1e293b)',
        border: '1px solid var(--border-color, #334155)',
        borderRadius: '8px',
        padding: compact ? '0.75rem' : '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Card Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Path Badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#93c5fd',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.78rem',
              fontFamily: 'monospace',
              fontWeight: 'bold',
            }}
          >
            <span>{correlation.sourceCameraId}</span>
            <span style={{ color: '#60a5fa' }}>→</span>
            <span>{correlation.targetCameraId}</span>
          </span>

          {/* Relationship Type */}
          {correlation.relationshipType && (
            <span
              style={{
                backgroundColor: 'rgba(148, 163, 184, 0.1)',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                color: '#cbd5e1',
                padding: '0.2rem 0.45rem',
                borderRadius: '4px',
                fontSize: '0.72rem',
                fontFamily: 'monospace',
              }}
            >
              {correlation.relationshipType}
            </span>
          )}

          {/* Travel Delta */}
          <span
            style={{
              backgroundColor: 'rgba(100, 116, 139, 0.15)',
              color: '#94a3b8',
              padding: '0.2rem 0.45rem',
              borderRadius: '4px',
              fontSize: '0.72rem',
              fontFamily: 'monospace',
            }}
          >
            +{correlation.timeDeltaSeconds}s travel time
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Score Badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              border: `1px solid ${getScoreColor(scorePct)}`,
              padding: '0.2rem 0.55rem',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: getScoreColor(scorePct),
            }}
          >
            <span>CORRELATION SCORE:</span>
            <span>{scorePct}%</span>
          </span>

          {/* State Badge */}
          <span
            style={{
              backgroundColor: stateStyle.bg,
              border: `1px solid ${stateStyle.border}`,
              color: stateStyle.text,
              padding: '0.2rem 0.55rem',
              borderRadius: '4px',
              fontSize: '0.72rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {correlation.state}
          </span>
        </div>
      </div>

      {/* Side-by-Side Event Flow */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: '0.75rem',
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          padding: '0.65rem 0.85rem',
          borderRadius: '6px',
          border: '1px solid rgba(51, 65, 85, 0.6)',
        }}
      >
        {/* Source Event */}
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', fontWeight: 600 }}>
            Source Observation Event
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.15rem' }}>
            {correlation.factors?.sourceEventType || 'SECURITY_EVENT'}
          </div>
          <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#93c5fd', marginTop: '0.1rem' }}>
            {correlation.sourceCameraId} • {correlation.sourceEventId}
          </div>
        </div>

        {/* Transition Indicator */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 0.5rem' }}>
          <div style={{ fontSize: '1.1rem', color: '#60a5fa' }}>➔</div>
          <div style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: 'var(--text-muted, #94a3b8)' }}>
            +{correlation.timeDeltaSeconds}s
          </div>
        </div>

        {/* Target Event */}
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', fontWeight: 600 }}>
            Target Incursion Event
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.15rem' }}>
            {correlation.factors?.targetEventType || 'SECURITY_EVENT'}
          </div>
          <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#93c5fd', marginTop: '0.1rem' }}>
            {correlation.targetCameraId} • {correlation.targetEventId}
          </div>
        </div>
      </div>

      {/* Factor Breakdown Checklist */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.4rem',
          fontSize: '0.74rem',
          backgroundColor: 'rgba(30, 41, 59, 0.5)',
          padding: '0.5rem 0.65rem',
          borderRadius: '4px',
          border: '1px solid rgba(51, 65, 85, 0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ color: correlation.factors?.topologyMatch ? '#34d399' : '#f87171' }}>
            {correlation.factors?.topologyMatch ? '✓' : '✗'}
          </span>
          <span style={{ color: '#cbd5e1' }}>Topology Edge</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ color: correlation.factors?.temporalMatch ? '#34d399' : '#f87171' }}>
            {correlation.factors?.temporalMatch ? '✓' : '✗'}
          </span>
          <span style={{ color: '#cbd5e1' }}>
            Travel Window [{correlation.factors?.minAllowedTimeSeconds ?? 2}s–{correlation.factors?.maxAllowedTimeSeconds ?? 15}s]
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ color: correlation.factors?.directionMatch ? '#34d399' : '#f87171' }}>
            {correlation.factors?.directionMatch ? '✓' : '✗'}
          </span>
          <span style={{ color: '#cbd5e1' }}>Direction Consistent</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ color: correlation.factors?.eventTypeMatch ? '#34d399' : '#f87171' }}>
            {correlation.factors?.eventTypeMatch ? '✓' : '✗'}
          </span>
          <span style={{ color: '#cbd5e1' }}>Event Type Compatible</span>
        </div>
      </div>

      {/* Human-Readable Explanation */}
      <div
        style={{
          fontSize: '0.78rem',
          color: '#cbd5e1',
          lineHeight: '1.4',
          backgroundColor: 'rgba(15, 23, 42, 0.3)',
          padding: '0.5rem 0.65rem',
          borderRadius: '4px',
          borderLeft: '3px solid #3b82f6',
        }}
      >
        <strong>Rationale:</strong> {correlation.explanation || correlation.reason}
      </div>

      {/* Review Information / Audit Note */}
      {correlation.reviewedAt && (
        <div
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted, #94a3b8)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
            backgroundColor: 'rgba(30, 41, 59, 0.3)',
            padding: '0.4rem 0.6rem',
            borderRadius: '4px',
          }}
        >
          <div>
            <strong>Reviewed by:</strong> {correlation.reviewedBy || 'Operator'} •{' '}
            {new Date(correlation.reviewedAt).toLocaleString()}
          </div>
          {correlation.reviewNote && (
            <div>
              <strong>Note:</strong> <em>"{correlation.reviewNote}"</em>
            </div>
          )}
        </div>
      )}

      {/* Note Input Box */}
      {showNoteInput && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add operator triage note or correlation rationale..."
            rows={2}
            style={{
              width: '100%',
              padding: '0.45rem',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '4px',
              color: '#f8fafc',
              fontSize: '0.75rem',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
            <button
              onClick={() => setShowNoteInput(false)}
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.72rem',
                backgroundColor: 'transparent',
                border: '1px solid #475569',
                color: '#cbd5e1',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNote}
              disabled={isProcessing || !noteText.trim()}
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.72rem',
                backgroundColor: '#2563eb',
                border: 'none',
                color: '#ffffff',
                borderRadius: '4px',
                cursor: isProcessing || !noteText.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              Save Note
            </button>
          </div>
        </div>
      )}

      {/* Operator Action Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          paddingTop: '0.4rem',
          borderTop: '1px solid rgba(51, 65, 85, 0.4)',
        }}
      >
        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
          Correlation ID: <span style={{ fontFamily: 'monospace' }}>{correlation.id}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {!showNoteInput && (
            <button
              onClick={() => setShowNoteInput(true)}
              style={{
                padding: '0.3rem 0.6rem',
                fontSize: '0.72rem',
                backgroundColor: 'transparent',
                border: '1px solid #475569',
                color: '#cbd5e1',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              + Note
            </button>
          )}

          {correlation.state === 'candidate' && (
            <>
              <button
                onClick={handleReject}
                disabled={isProcessing}
                style={{
                  padding: '0.3rem 0.75rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  borderRadius: '4px',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                }}
              >
                Reject Correlation
              </button>
              <button
                onClick={handleAccept}
                disabled={isProcessing}
                style={{
                  padding: '0.3rem 0.75rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  backgroundColor: '#10b981',
                  border: '1px solid #059669',
                  color: '#ffffff',
                  borderRadius: '4px',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                }}
              >
                Accept Correlation
              </button>
            </>
          )}

          {correlation.state === 'accepted' && (
            <button
              onClick={handleReject}
              disabled={isProcessing}
              style={{
                padding: '0.3rem 0.6rem',
                fontSize: '0.72rem',
                backgroundColor: 'transparent',
                border: '1px solid #475569',
                color: '#94a3b8',
                borderRadius: '4px',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
              }}
            >
              Revert to Rejected
            </button>
          )}

          {correlation.state === 'rejected' && (
            <button
              onClick={handleAccept}
              disabled={isProcessing}
              style={{
                padding: '0.3rem 0.6rem',
                fontSize: '0.72rem',
                backgroundColor: 'transparent',
                border: '1px solid #10b981',
                color: '#34d399',
                borderRadius: '4px',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
              }}
            >
              Re-Accept Correlation
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
