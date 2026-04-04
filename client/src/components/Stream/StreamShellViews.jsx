import React, { useEffect, useRef } from 'react';

export function StreamVideo({ stream, muted = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.srcObject = stream || null;
    videoRef.current.muted = muted;

    if (stream) {
      const tryPlay = () => {
        const playPromise = videoRef.current?.play?.();
        playPromise?.catch?.(() => {});
      };

      videoRef.current.onloadedmetadata = tryPlay;
      videoRef.current.oncanplay = tryPlay;
      tryPlay();

      return () => {
        if (!videoRef.current) {
          return;
        }
        videoRef.current.onloadedmetadata = null;
        videoRef.current.oncanplay = null;
      };
    }

    return undefined;
  }, [stream, muted]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      style={{
        width: '100%',
        height: '100%',
        background: '#000',
        objectFit: 'contain',
      }}
    />
  );
}

const placeholderStyle = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: 12,
  color: 'var(--text-muted)',
};

function MonitorIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

export function NoStreamPlaceholder() {
  return (
    <div style={placeholderStyle}>
      <MonitorIcon size={48} />
      <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)' }}>
        No Active Stream
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        When someone shares their screen, it will appear here
      </span>
    </div>
  );
}

export function StreamShell({ immersive = false, onToggleImmersive, children }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000', minHeight: 0, position: 'relative' }}>
      {typeof onToggleImmersive === 'function' && (
        <button
          type="button"
          onClick={onToggleImmersive}
          title={immersive ? 'Restore guild layout' : 'Expand stream'}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 3,
            width: 32,
            height: 32,
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(6, 10, 6, 0.72)',
            color: '#d7ffd7',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 10px 24px rgba(0,0,0,0.22)',
          }}
        >
          {immersive ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <polyline points="21 15 21 21 15 21" />
              <polyline points="3 9 3 3 9 3" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
              <line x1="14" y1="14" x2="21" y2="21" />
              <line x1="3" y1="3" x2="10" y2="10" />
            </svg>
          )}
        </button>
      )}
      {children}
    </div>
  );
}
