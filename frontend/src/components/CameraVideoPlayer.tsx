import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Detection, Track, CameraAIDetectionPayload, Zone, Line, Event } from '@ibvap/shared';

export interface CameraVideoPlayerProps {
  cameraId: string;
  cameraName?: string;
  videoSrc?: string;
  status?: string;
  fps?: number;
  resolution?: string;
  lensType?: string;
  aspectRatio?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  showHUD?: boolean;
  showAIOverlays?: boolean;
  showTrajectories?: boolean;
  showZones?: boolean;
  showLines?: boolean;
  showDebugHUD?: boolean;
  showRuleDebug?: boolean;
  zones?: Zone[];
  lines?: Line[];
  interactiveControls?: boolean;
  customOverlayText?: string;
  onSnapshotTaken?: (dataUrl: string) => void;
  onDetectionsUpdate?: (payload: CameraAIDetectionPayload) => void;
  className?: string;
}

// Lightweight Inline SVG Icons
const Icons = {
  Play: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  Pause: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  Volume: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  ),
  Mute: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  ),
  RotateCcw: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  ),
  Camera: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  Maximize: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Refresh: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Cpu: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </svg>
  ),
  Sliders: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  ),
};

const getClassColor = (cls: string): string => {
  const c = cls.toLowerCase();
  if (c.includes('person')) return '#3b82f6'; // Blue
  if (c.includes('car') || c.includes('vehicle')) return '#f59e0b'; // Amber
  if (c.includes('truck') || c.includes('bus')) return '#06b6d4'; // Cyan
  if (c.includes('motorcycle')) return '#10b981'; // Emerald
  return '#a855f7'; // Purple fallback
};

export const CameraVideoPlayer: React.FC<CameraVideoPlayerProps> = ({
  cameraId,
  cameraName,
  videoSrc,
  status = 'active',
  fps = 25,
  resolution = '1080p',
  lensType = 'OPTICAL HD',
  aspectRatio = '16 / 9',
  autoPlay = true,
  muted: initialMuted = true,
  loop = true,
  showHUD = true,
  showAIOverlays = true,
  showTrajectories = false,
  showZones = true,
  showLines = true,
  showDebugHUD = false,
  showRuleDebug = false,
  zones: propZones,
  lines: propLines,
  interactiveControls = false,
  customOverlayText = 'REPLAY / LOCAL VIDEO SOURCE',
  onSnapshotTaken,
  onDetectionsUpdate,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Video State
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);
  const [isMuted, setIsMuted] = useState<boolean>(initialMuted);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [snapshotFlash, setSnapshotFlash] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  // AI Multi-Object Tracking & Detection State (Phase 4 Persistent Local Tracks)
  const [displayedDetections, setDisplayedDetections] = useState<Detection[]>([]);
  const [displayedTracks, setDisplayedTracks] = useState<Track[]>([]);
  const [rawDetections, setRawDetections] = useState<Detection[]>([]);
  const [rawTracks, setRawTracks] = useState<Track[]>([]);
  const [candidateEvents, setCandidateEvents] = useState<Event[]>([]);
  const [aiState, setAiState] = useState<'running' | 'paused' | 'starting' | 'error' | 'offline'>('starting');
  const [aiLatencyMs, setAiLatencyMs] = useState<number>(0);
  const [trackerLatencyMs, setTrackerLatencyMs] = useState<number>(0);
  const [ruleLatencyMs, setRuleLatencyMs] = useState<number>(0);
  const [pipelineLatencyMs, setPipelineLatencyMs] = useState<number>(0);
  const [aiFps] = useState<number>(5.0);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number | null>(null);
  const [activeAITime, setActiveAITime] = useState<number | null>(null);
  const [syncDelta, setSyncDelta] = useState<number | null>(null);
  const [debugHUDOpen, setDebugHUDOpen] = useState<boolean>(showDebugHUD);
  const [ruleDebugOpen, setRuleDebugOpen] = useState<boolean>(showRuleDebug);
  const [zonesVisible, setZonesVisible] = useState<boolean>(showZones);
  const [linesVisible, setLinesVisible] = useState<boolean>(showLines);

  // Phase 5 Zones and Lines
  const [zones, setZones] = useState<Zone[]>(propZones || []);
  const [lines, setLines] = useState<Line[]>(propLines || []);

  // Fetch zones & lines if not passed as props
  useEffect(() => {
    if (propZones && propZones.length > 0) {
      setZones(propZones);
      return;
    }
    fetch(`/api/zones?cameraId=${encodeURIComponent(cameraId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setZones(data.data);
        }
      })
      .catch(() => {});
  }, [cameraId, propZones]);

  useEffect(() => {
    if (propLines && propLines.length > 0) {
      setLines(propLines);
      return;
    }
    fetch(`/api/lines?cameraId=${encodeURIComponent(cameraId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setLines(data.data);
        }
      })
      .catch(() => {});
  }, [cameraId, propLines]);

  // Rolling Time-Indexed Buffer of AI Payloads
  const detectionBufferRef = useRef<Map<number, CameraAIDetectionPayload>>(new Map());
  const lastVideoTimeRef = useRef<number>(0);

  // Active items to render
  const activeTracks = displayedTracks.length > 0 ? displayedTracks : rawTracks;
  const activeDetections = displayedDetections.length > 0 ? displayedDetections : rawDetections;

  // Compute resolved stream URL
  const resolvedSrc = videoSrc || `/api/cameras/${encodeURIComponent(cameraId)}/video`;
  const isThermal = lensType.toLowerCase().includes('thermal');

  // Format seconds to MM:SS
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const SYNC_TOLERANCE_SECONDS = 1.2;

  const syncDetectionsToTime = useCallback(
    (vTime: number) => {
      if (aiState === 'paused') {
        setDisplayedDetections([]);
        setDisplayedTracks([]);
        return;
      }

      const buffer = detectionBufferRef.current;
      if (buffer.size === 0) {
        return;
      }

      let closestPayload: CameraAIDetectionPayload | null = null;
      let minDiff = Infinity;

      for (const payload of buffer.values()) {
        const pTime = payload.videoTimestamp ?? payload.frameTimestamp ?? 0;
        const diff = Math.abs(pTime - vTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestPayload = payload;
        }
      }

      if (closestPayload && minDiff <= SYNC_TOLERANCE_SECONDS) {
        setDisplayedDetections(closestPayload.detections || []);
        setDisplayedTracks(closestPayload.tracks || []);
        setCandidateEvents(closestPayload.candidateEvents || []);
        setRuleLatencyMs(closestPayload.ruleLatencyMs || 0);
        setActiveFrameIndex(closestPayload.frameIndex ?? null);
        const pTime = closestPayload.videoTimestamp ?? closestPayload.frameTimestamp ?? 0;
        setActiveAITime(pTime);
        setSyncDelta(roundToDecimals(pTime - vTime, 2));
        if (onDetectionsUpdate) {
          onDetectionsUpdate(closestPayload);
        }
      } else if (closestPayload && (closestPayload.tracks?.length || closestPayload.detections?.length)) {
        setDisplayedDetections(closestPayload.detections || []);
        setDisplayedTracks(closestPayload.tracks || []);
        setCandidateEvents(closestPayload.candidateEvents || []);
        setRuleLatencyMs(closestPayload.ruleLatencyMs || 0);
        setActiveFrameIndex(closestPayload.frameIndex ?? null);
      }
    },
    [aiState, onDetectionsUpdate]
  );

  const roundToDecimals = (val: number, dec: number) => {
    const factor = Math.pow(10, dec);
    return Math.round(val * factor) / factor;
  };

  // Video event handlers
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
      setIsLoading(false);
      setHasError(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      // Detect video loop rewind
      if (lastVideoTimeRef.current > 2 && t < 0.8) {
        syncDetectionsToTime(t);
      }
      lastVideoTimeRef.current = t;
      setCurrentTime(t);
      syncDetectionsToTime(t);
    }
  };

  const handleWaiting = () => {
    setIsLoading(true);
  };

  const handlePlaying = () => {
    setIsLoading(false);
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    setErrorMessage(`Failed to stream CCTV feed for ${cameraId}`);
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const nextMuted = !videoRef.current.muted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  }, []);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
      syncDetectionsToTime(targetTime);
    }
  };

  const handleSpeedChange = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const handleRestart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      syncDetectionsToTime(0);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    setRetryCount((prev) => prev + 1);
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  };

  const toggleAIState = async () => {
    const nextAction = aiState === 'paused' ? 'resume' : 'pause';
    try {
      await fetch(`/api/detections/control/${encodeURIComponent(cameraId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: nextAction }),
      });
      const newState = nextAction === 'pause' ? 'paused' : 'running';
      setAiState(newState);
      if (newState === 'paused') {
        setDisplayedDetections([]);
        setDisplayedTracks([]);
      }
    } catch {
      setAiState((prev) => (prev === 'paused' ? 'running' : 'paused'));
    }
  };

  const captureSnapshot = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        setSnapshotFlash(true);
        setTimeout(() => setSnapshotFlash(false), 300);

        if (onSnapshotTaken) {
          onSnapshotTaken(dataUrl);
        } else {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `SNAPSHOT_${cameraId}_${Date.now()}.png`;
          a.click();
        }
      }
    } catch {
      // Fallback
    }
  };

  // Continuous animation frame sync ticker while video is playing
  useEffect(() => {
    if (!isPlaying) return;
    let animId: number;
    const tick = () => {
      if (videoRef.current) {
        syncDetectionsToTime(videoRef.current.currentTime);
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, syncDetectionsToTime]);

  // Initial timeline fetch
  useEffect(() => {
    let isMounted = true;
    const fetchTimeline = async () => {
      try {
        const res = await fetch(`/api/detections/timeline/${encodeURIComponent(cameraId)}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && isMounted) {
          for (const item of json.data) {
            const ts = item.videoTimestamp ?? item.frameTimestamp ?? 0;
            const key = Math.round(ts * 10) / 10;
            detectionBufferRef.current.set(key, item);
          }
          if (videoRef.current) {
            syncDetectionsToTime(videoRef.current.currentTime);
          }
        }
      } catch {
        // Fallback
      }
    };
    fetchTimeline();
    return () => {
      isMounted = false;
    };
  }, [cameraId, syncDetectionsToTime]);

  // Subscribe to Real-Time Detection & Tracking SSE Stream
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let isSubscribed = true;

    const addPayloadToBuffer = (payload: CameraAIDetectionPayload) => {
      if (!isSubscribed) return;
      if (payload.cameraId === cameraId || payload.cameraId === cameraId.toUpperCase()) {
        const dets = payload.detections || [];
        const trks = payload.tracks || [];
        setRawDetections(dets);
        setRawTracks(trks);
        setCandidateEvents(payload.candidateEvents || []);

        const ts = payload.videoTimestamp ?? payload.frameTimestamp ?? 0;
        const key = Math.round(ts * 10) / 10;
        detectionBufferRef.current.set(key, payload);

        if (detectionBufferRef.current.size > 500) {
          const oldestKey = detectionBufferRef.current.keys().next().value;
          if (oldestKey !== undefined) {
            detectionBufferRef.current.delete(oldestKey);
          }
        }

        setAiLatencyMs(payload.latencyMs || 0);
        setTrackerLatencyMs(payload.trackerLatencyMs || 0);
        setRuleLatencyMs(payload.ruleLatencyMs || 0);
        setPipelineLatencyMs(payload.pipelineLatencyMs || payload.latencyMs || 0);

        if (payload.cameraStatus) {
          setAiState(payload.cameraStatus as any);
        } else {
          setAiState('running');
        }

        if (videoRef.current) {
          syncDetectionsToTime(videoRef.current.currentTime);
        }
      }
    };

    const connectSSE = () => {
      try {
        eventSource = new EventSource(`/api/detections/stream?cameraId=${encodeURIComponent(cameraId)}`);

        eventSource.addEventListener('detection', (event: MessageEvent) => {
          try {
            const data: CameraAIDetectionPayload = JSON.parse(event.data);
            addPayloadToBuffer(data);
          } catch {
            // Ignore parse errors
          }
        });

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          startPolling();
        };
      } catch {
        startPolling();
      }
    };

    const fetchLiveDetections = async () => {
      try {
        const res = await fetch(`/api/detections/live/${encodeURIComponent(cameraId)}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data) {
          addPayloadToBuffer(json.data);
        }
      } catch {
        // AI service might be starting
      }
    };

    const startPolling = () => {
      if (pollInterval) return;
      fetchLiveDetections();
      pollInterval = setInterval(fetchLiveDetections, 350);
    };

    connectSSE();
    fetchLiveDetections();

    return () => {
      isSubscribed = false;
      if (eventSource) {
        eventSource.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [cameraId, syncDetectionsToTime]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = initialMuted;
      setIsMuted(initialMuted);
    }
  }, [initialMuted]);

  // Determine items to render: Prefer active tracks with persistent IDs, fallback to pure detections
  const renderItems = activeTracks.length > 0
    ? activeTracks.map((trk) => ({
        key: trk.id || `trk-${trk.trackId}`,
        className: trk.className,
        confidence: trk.confidence,
        boundingBox: trk.boundingBox,
        displayId: trk.displayId || `T${trk.trackId.toString().padStart(3, '0')}`,
        trackId: trk.trackId,
        status: trk.status,
        trajectory: trk.trajectory || [],
      }))
    : activeDetections.map((det) => ({
        key: det.id,
        className: det.objectClass,
        confidence: det.confidence,
        boundingBox: det.boundingBox,
        displayId: det.trackRef || undefined,
        trackId: undefined,
        status: 'ACTIVE' as const,
        trajectory: [],
      }));

  return (
    <div
      ref={containerRef}
      className={`cctv-player-container ${className}`}
      style={{
        position: 'relative',
        aspectRatio,
        backgroundColor: '#05080f',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
      }}
    >
      {/* HTML5 Local Video Element */}
      <video
        ref={videoRef}
        key={`${resolvedSrc}-${retryCount}`}
        src={resolvedSrc}
        autoPlay={autoPlay}
        muted={isMuted}
        loop={loop}
        playsInline
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onPause={handlePause}
        onError={handleError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: hasError ? 'none' : 'block',
          filter: isThermal ? 'contrast(1.2) hue-rotate(180deg) brightness(0.9)' : 'none',
        }}
      />

      {/* Phase 5 Spatial Overlays: Zones, Tripwire Lines & Track Anchors */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        <defs>
          {/* Arrow markers for directed tripwires */}
          <marker
            id="tripwire-arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#06b6d4" />
          </marker>
        </defs>

        {/* 1. Virtual Polygon Zones */}
        {zonesVisible &&
          zones.map((zone) => {
            const rawPts = zone.polygon || [];
            if (rawPts.length < 3) return null;
            const pts = rawPts.map((p) =>
              Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y }
            );
            const pointsStr = pts
              .map((p) => `${(p.x * 100).toFixed(2)}%,${(p.y * 100).toFixed(2)}%`)
              .join(' ');
            const zColor =
              zone.color ||
              (zone.type === 'RESTRICTED' || zone.type === 'sterile_zone'
                ? '#ef4444'
                : zone.type === 'MONITORED' || zone.type === 'warning_zone'
                ? '#f59e0b'
                : zone.type === 'EXIT'
                ? '#10b981'
                : '#3b82f6');
            const labelPt = pts[0];

            return (
              <g key={zone.id} className="virtual-zone-overlay">
                <polygon
                  points={pointsStr}
                  fill={`${zColor}22`}
                  stroke={zColor}
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  style={{ filter: `drop-shadow(0 0 4px ${zColor}66)` }}
                />
                {/* Zone Label Tag */}
                <rect
                  x={`${(labelPt.x * 100).toFixed(2)}%`}
                  y={`${(labelPt.y * 100).toFixed(2)}%`}
                  width="130"
                  height="16"
                  fill="rgba(5, 8, 15, 0.88)"
                  stroke={zColor}
                  strokeWidth="1"
                  rx="3"
                  transform="translate(4, 4)"
                />
                <text
                  x={`${(labelPt.x * 100).toFixed(2)}%`}
                  y={`${(labelPt.y * 100).toFixed(2)}%`}
                  fill={zColor}
                  fontSize="9"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                  transform="translate(8, 16)"
                >
                  {zone.name || zone.id} [{zone.type}]
                </text>
              </g>
            );
          })}

        {/* 2. Virtual Tripwires / Lines */}
        {linesVisible &&
          lines.map((line) => {
            const p1 = Array.isArray(line.start)
              ? { x: line.start[0], y: line.start[1] }
              : { x: line.start.x, y: line.start.y };
            const p2 = Array.isArray(line.end)
              ? { x: line.end[0], y: line.end[1] }
              : { x: line.end.x, y: line.end.y };
            const lColor = line.color || '#06b6d4';
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            return (
              <g key={line.id} className="virtual-line-overlay">
                <line
                  x1={`${(p1.x * 100).toFixed(2)}%`}
                  y1={`${(p1.y * 100).toFixed(2)}%`}
                  x2={`${(p2.x * 100).toFixed(2)}%`}
                  y2={`${(p2.y * 100).toFixed(2)}%`}
                  stroke={lColor}
                  strokeWidth="2.5"
                  strokeDasharray="6 3"
                  markerEnd="url(#tripwire-arrow)"
                  style={{ filter: `drop-shadow(0 0 4px ${lColor}88)` }}
                />
                {/* Tripwire Direction Badge */}
                <rect
                  x={`${(midX * 100).toFixed(2)}%`}
                  y={`${(midY * 100).toFixed(2)}%`}
                  width="110"
                  height="16"
                  fill="rgba(5, 8, 15, 0.88)"
                  stroke={lColor}
                  strokeWidth="1"
                  rx="3"
                  transform="translate(-55, -8)"
                />
                <text
                  x={`${(midX * 100).toFixed(2)}%`}
                  y={`${(midY * 100).toFixed(2)}%`}
                  fill={lColor}
                  fontSize="9"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                  textAnchor="middle"
                  transform="translate(0, 4)"
                >
                  TRIPWIRE: A→B ({line.labelA || 'OUT'} → {line.labelB || 'IN'})
                </text>
              </g>
            );
          })}

        {/* 3. Track Ground Contact Anchors (Bottom-Center: x + w/2, y + h) */}
        {showAIOverlays &&
          aiState !== 'paused' &&
          renderItems.map((item) => {
            const anchorX = item.boundingBox.x + item.boundingBox.width / 2;
            const anchorY = item.boundingBox.y + item.boundingBox.height;
            const color = getClassColor(item.className);

            return (
              <g key={`anchor-${item.key}`}>
                {/* Anchor pulse ring */}
                <circle
                  cx={`${(anchorX * 100).toFixed(2)}%`}
                  cy={`${(anchorY * 100).toFixed(2)}%`}
                  r="6"
                  fill="none"
                  stroke={color}
                  strokeWidth="1.5"
                  strokeOpacity="0.75"
                />
                {/* Anchor core dot */}
                <circle
                  cx={`${(anchorX * 100).toFixed(2)}%`}
                  cy={`${(anchorY * 100).toFixed(2)}%`}
                  r="3"
                  fill="#ffffff"
                  stroke={color}
                  strokeWidth="1.5"
                />
              </g>
            );
          })}
      </svg>

      {/* Real Multi-Object Tracking Bounding Boxes & Persistent Track IDs (Phase 4) */}
      {showAIOverlays && aiState !== 'paused' && renderItems.length > 0 && (
        <div
          className="ai-detections-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 3,
          }}
        >
          {/* Subtle Rolling Trajectories Overlay (When enabled) */}
          {showTrajectories && (
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            >
              {renderItems.map((item) => {
                if (!item.trajectory || item.trajectory.length < 2) return null;
                const color = getClassColor(item.className);
                const pointsStr = item.trajectory
                  .map((p) => `${(p.x * 100).toFixed(2)}%,${(p.y * 100).toFixed(2)}%`)
                  .join(' ');

                return (
                  <g key={`traj-${item.key}`}>
                    {/* Polyline path */}
                    <polyline
                      points={pointsStr}
                      fill="none"
                      stroke={color}
                      strokeWidth="2"
                      strokeDasharray="3 3"
                      strokeOpacity="0.75"
                    />
                    {/* Trajectory dots */}
                    {item.trajectory.map((pt, idx) => (
                      <circle
                        key={`pt-${idx}`}
                        cx={`${(pt.x * 100).toFixed(2)}%`}
                        cy={`${(pt.y * 100).toFixed(2)}%`}
                        r={idx === item.trajectory.length - 1 ? '3' : '2'}
                        fill={color}
                        fillOpacity={(0.3 + (idx / item.trajectory.length) * 0.7).toFixed(2)}
                      />
                    ))}
                  </g>
                );
              })}
            </svg>
          )}

          {/* Track Bounding Boxes */}
          {renderItems.map((item) => {
            const color = getClassColor(item.className);
            const { x, y, width, height } = item.boundingBox;
            const labelText = item.displayId
              ? `${item.className} · ${item.displayId} · ${(item.confidence * 100).toFixed(0)}%`
              : `${item.className} ${(item.confidence * 100).toFixed(0)}%`;

            return (
              <div
                key={item.key}
                className="ai-bounding-box"
                style={{
                  position: 'absolute',
                  top: `${(y * 100).toFixed(2)}%`,
                  left: `${(x * 100).toFixed(2)}%`,
                  width: `${(width * 100).toFixed(2)}%`,
                  height: `${(height * 100).toFixed(2)}%`,
                  border: `2px solid ${color}`,
                  backgroundColor: `${color}18`,
                  borderRadius: '2px',
                  boxShadow: `0 0 8px ${color}88`,
                  transition: 'all 0.05s linear',
                }}
              >
                <div
                  className="ai-bbox-badge"
                  style={{
                    position: 'absolute',
                    top: '-18px',
                    left: '-2px',
                    backgroundColor: color,
                    color: '#ffffff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.35rem',
                    borderRadius: '2px 2px 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    whiteSpace: 'nowrap',
                    textTransform: 'uppercase',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.8)',
                  }}
                >
                  <span>{labelText}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI TRACKING SYNC & RULE ENGINE DEBUG HUD OVERLAY */}
      {(debugHUDOpen || showDebugHUD || ruleDebugOpen) && (
        <div
          className="ai-debug-hud-overlay"
          style={{
            position: 'absolute',
            top: '38px',
            right: '10px',
            backgroundColor: 'rgba(5, 8, 15, 0.94)',
            border: '1px solid rgba(59, 130, 246, 0.5)',
            borderRadius: '4px',
            padding: '0.5rem 0.7rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.62rem',
            color: '#e2e8f0',
            zIndex: 8,
            maxWidth: '260px',
            backdropFilter: 'blur(4px)',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.22rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.8)',
          }}
        >
          <div style={{ color: '#60a5fa', fontWeight: 800, borderBottom: '1px solid rgba(59, 130, 246, 0.2)', paddingBottom: '0.15rem' }}>
            AI &amp; BYTETRACK DEBUG HUD
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem' }}>
            <span style={{ color: '#94a3b8' }}>FRAME:</span>
            <span style={{ color: '#93c5fd' }}>{activeFrameIndex !== null ? `#${activeFrameIndex}` : 'WAITING'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem' }}>
            <span style={{ color: '#94a3b8' }}>VIDEO TIME:</span>
            <span style={{ color: '#f8fafc', fontWeight: 700 }}>{currentTime.toFixed(2)}s</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem' }}>
            <span style={{ color: '#94a3b8' }}>AI TIME:</span>
            <span style={{ color: '#34d399', fontWeight: 700 }}>
              {activeAITime !== null ? `${activeAITime.toFixed(2)}s` : 'SYNCING...'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem' }}>
            <span style={{ color: '#94a3b8' }}>SYNC DELTA:</span>
            <span style={{ color: syncDelta !== null && Math.abs(syncDelta) < 0.3 ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
              {syncDelta !== null ? `${syncDelta > 0 ? '+' : ''}${syncDelta.toFixed(2)}s` : 'N/A'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem' }}>
            <span style={{ color: '#94a3b8' }}>ACTIVE TRACKS:</span>
            <span style={{ color: '#60a5fa', fontWeight: 800 }}>{activeTracks.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem' }}>
            <span style={{ color: '#94a3b8' }}>YOLO / TRACKER:</span>
            <span style={{ color: '#cbd5e1' }}>
              {aiLatencyMs > 0 ? `${aiLatencyMs.toFixed(0)}ms` : '<45ms'} / {trackerLatencyMs > 0 ? `${trackerLatencyMs.toFixed(0)}ms` : '<3ms'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem' }}>
            <span style={{ color: '#94a3b8' }}>RULE LATENCY:</span>
            <span style={{ color: '#34d399', fontWeight: 700 }}>
              {ruleLatencyMs > 0 ? `${ruleLatencyMs.toFixed(2)}ms` : '<0.25ms'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem' }}>
            <span style={{ color: '#94a3b8' }}>ZONES / LINES:</span>
            <span style={{ color: '#fde047' }}>
              {zones.length} zones / {lines.length} lines
            </span>
          </div>

          {/* Candidate Events List */}
          {candidateEvents.length > 0 && (
            <div style={{ marginTop: '0.2rem', paddingTop: '0.2rem', borderTop: '1px dashed rgba(59, 130, 246, 0.3)' }}>
              <div style={{ color: '#fbbf24', fontWeight: 800, marginBottom: '0.15rem' }}>
                CANDIDATE EVENTS ({candidateEvents.length}):
              </div>
              {candidateEvents.map((cand, idx) => (
                <div key={cand.id || idx} style={{ color: '#e2e8f0', fontSize: '0.58rem' }}>
                  • {cand.eventType} ({cand.trackDisplayId || `T${cand.trackId}`}): {cand.explanation || 'Verifying...'}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Snapshot Flash Overlay */}
      {snapshotFlash && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#ffffff',
            opacity: 0.8,
            zIndex: 10,
            pointerEvents: 'none',
            transition: 'opacity 0.3s ease-out',
          }}
        />
      )}

      {/* Tactical HUD Scanline Texture */}
      <div className="video-scanlines" />

      {/* CCTV Reticle & Crosshair */}
      <div className="video-reticle" />
      <div className="video-center-crosshair" />

      {/* HUD Telemetry Header */}
      {showHUD && (
        <div className="video-overlay-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontWeight: 800, color: '#60a5fa' }}>{cameraId}</span>
            <span>{lensType}</span>
            {cameraName && (
              <span style={{ opacity: 0.8, fontSize: '0.65rem', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                • {cameraName}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: status === 'active' ? '#34d399' : '#fbbf24' }}>
              [{status}]
            </span>
            <span>{resolution}</span>
            <span>{fps} FPS</span>
            <div className="rec-indicator">
              <span className="rec-dot" />
              <span>REC</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading Buffering Indicator */}
      {isLoading && !hasError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(5, 8, 15, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            zIndex: 4,
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid rgba(59, 130, 246, 0.2)',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: '#93c5fd',
              letterSpacing: '0.05em',
            }}
          >
            INGESTING CCTV STREAM...
          </span>
        </div>
      )}

      {/* Error / Offline Stream Banner */}
      {hasError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.85rem',
            padding: '1.5rem',
            textAlign: 'center',
            zIndex: 5,
          }}
        >
          <Icons.AlertTriangle />
          <div>
            <div style={{ fontWeight: 700, color: '#f87171', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              VIDEO FEED UNAVAILABLE
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '280px' }}>
              {errorMessage || `Unable to load stream for ${cameraId}`}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="btn btn-outline"
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Icons.Refresh />
            <span>RETRY FEED</span>
          </button>
        </div>
      )}

      {/* Bottom Tactical Metadata Bar (Local Video Source + Real ByteTrack AI Status) */}
      {showHUD && (
        <div
          style={{
            position: 'absolute',
            bottom: interactiveControls ? '44px' : '8px',
            left: '10px',
            right: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 4,
            pointerEvents: 'none',
          }}
        >
          {/* Replay Source Tag */}
          <div className="sim-feed-banner" style={{ position: 'static' }}>
            <span style={{ color: '#10b981' }}>●</span>
            <span>{customOverlayText}</span>
          </div>

          {/* Phase 4 Multi-Object Tracking Telemetry Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: '#cbd5e1',
              backgroundColor: 'rgba(15, 23, 42, 0.88)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              padding: '0.2rem 0.55rem',
              borderRadius: '3px',
              backdropFilter: 'blur(3px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span
                style={{
                  color:
                    aiState === 'running'
                      ? '#10b981'
                      : aiState === 'paused'
                      ? '#f59e0b'
                      : aiState === 'starting'
                      ? '#60a5fa'
                      : '#ef4444',
                }}
              >
                ●
              </span>
              <span style={{ fontWeight: 700 }}>
                {aiState === 'running'
                  ? 'YOLO + BYTETRACK'
                  : aiState === 'paused'
                  ? 'AI PAUSED'
                  : aiState === 'starting'
                  ? 'AI INITIALIZING'
                  : 'AI OFFLINE'}
              </span>
            </div>

            {aiState === 'running' && (
              <>
                <span style={{ color: '#475569' }}>|</span>
                <span style={{ color: '#93c5fd' }}>{aiFps.toFixed(1)} FPS</span>
                <span style={{ color: '#475569' }}>|</span>
                <span style={{ color: '#a7f3d0' }}>
                  {pipelineLatencyMs > 0 ? `${pipelineLatencyMs.toFixed(0)}ms` : '<50ms'}
                </span>
                {activeTracks.length > 0 && (
                  <>
                    <span style={{ color: '#475569' }}>|</span>
                    <span style={{ color: '#60a5fa', fontWeight: 700 }}>{activeTracks.length} TRACKS</span>
                  </>
                )}
                {activeFrameIndex !== null && (
                  <>
                    <span style={{ color: '#475569' }}>|</span>
                    <span style={{ color: '#94a3b8' }}>F#{activeFrameIndex}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Interactive Playback Control Bar (when enabled) */}
      {interactiveControls && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(11, 15, 25, 0.94)',
            borderTop: '1px solid var(--border-color)',
            padding: '0.4rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            zIndex: 6,
            backdropFilter: 'blur(4px)',
          }}
        >
          {/* Scrubber Timeline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                color: '#94a3b8',
                minWidth: '38px',
              }}
            >
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              style={{
                flex: 1,
                accentColor: '#3b82f6',
                cursor: 'pointer',
                height: '4px',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                color: '#64748b',
                minWidth: '38px',
              }}
            >
              {formatTime(duration)}
            </span>
          </div>

          {/* Action Buttons Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {/* Play / Pause */}
              <button
                type="button"
                onClick={togglePlay}
                className="btn btn-outline"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Icons.Pause /> : <Icons.Play />}
              </button>

              {/* Restart */}
              <button
                type="button"
                onClick={handleRestart}
                className="btn btn-outline"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                title="Restart Replay"
              >
                <Icons.RotateCcw />
              </button>

              {/* Mute / Unmute */}
              <button
                type="button"
                onClick={toggleMute}
                className="btn btn-outline"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <Icons.Mute /> : <Icons.Volume />}
              </button>

              {/* AI Inference Toggle */}
              <button
                type="button"
                onClick={toggleAIState}
                className="btn btn-outline"
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  borderColor: aiState === 'paused' ? '#f59e0b' : '#3b82f6',
                  color: aiState === 'paused' ? '#fbbf24' : '#93c5fd',
                }}
                title={aiState === 'paused' ? 'Resume AI Detection' : 'Pause AI Detection'}
              >
                <Icons.Cpu />
                <span style={{ fontSize: '0.65rem' }}>{aiState === 'paused' ? 'AI RESUME' : 'AI PAUSE'}</span>
              </button>

              {/* Debug HUD Toggle */}
              <button
                type="button"
                onClick={() => setDebugHUDOpen((prev) => !prev)}
                className="btn btn-outline"
                style={{
                  padding: '0.25rem 0.45rem',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  borderColor: debugHUDOpen ? '#34d399' : 'rgba(148, 163, 184, 0.3)',
                  color: debugHUDOpen ? '#34d399' : '#94a3b8',
                }}
                title="Toggle AI Sync Debug HUD"
              >
                <Icons.Sliders />
                <span style={{ fontSize: '0.65rem' }}>DEBUG</span>
              </button>

              {/* Zones Overlay Toggle */}
              <button
                type="button"
                onClick={() => setZonesVisible((prev) => !prev)}
                className="btn btn-outline"
                style={{
                  padding: '0.25rem 0.45rem',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  borderColor: zonesVisible ? '#3b82f6' : 'rgba(148, 163, 184, 0.3)',
                  color: zonesVisible ? '#60a5fa' : '#64748b',
                }}
                title="Toggle Spatial Zones Overlay"
              >
                <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>ZONES</span>
              </button>

              {/* Lines / Tripwires Overlay Toggle */}
              <button
                type="button"
                onClick={() => setLinesVisible((prev) => !prev)}
                className="btn btn-outline"
                style={{
                  padding: '0.25rem 0.45rem',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  borderColor: linesVisible ? '#06b6d4' : 'rgba(148, 163, 184, 0.3)',
                  color: linesVisible ? '#22d3ee' : '#64748b',
                }}
                title="Toggle Tripwires Overlay"
              >
                <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>LINES</span>
              </button>

              {/* Rule Debug HUD Toggle */}
              <button
                type="button"
                onClick={() => setRuleDebugOpen((prev) => !prev)}
                className="btn btn-outline"
                style={{
                  padding: '0.25rem 0.45rem',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  borderColor: ruleDebugOpen ? '#ec4899' : 'rgba(148, 163, 184, 0.3)',
                  color: ruleDebugOpen ? '#f472b6' : '#64748b',
                }}
                title="Toggle Rule Engine HUD"
              >
                <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>RULES</span>
              </button>

              {/* Playback Speed Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginLeft: '0.25rem' }}>
                {[0.5, 1, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => handleSpeedChange(rate)}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      padding: '0.15rem 0.35rem',
                      borderRadius: '3px',
                      border: '1px solid',
                      borderColor: playbackRate === rate ? '#3b82f6' : 'rgba(148, 163, 184, 0.2)',
                      backgroundColor: playbackRate === rate ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                      color: playbackRate === rate ? '#60a5fa' : '#94a3b8',
                      cursor: 'pointer',
                    }}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            {/* Right Tools: Snapshot & Fullscreen */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={captureSnapshot}
                className="btn btn-outline"
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
                title="Capture Snapshot Frame"
              >
                <Icons.Camera />
                <span style={{ fontSize: '0.65rem' }}>SNAPSHOT</span>
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="btn btn-outline"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                title="Fullscreen"
              >
                <Icons.Maximize />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
