import { useState, useEffect } from 'react';

export default function UpdateOverlay({ serverUrl, onDismiss }) {
  const [progress, setProgress] = useState({ phase: 'downloading', downloadedBytes: 0, totalBytes: 0 });
  const [error, setError] = useState(null);

  useEffect(() => {
    const cleanup = window.electronAPI?.onUpdateProgress?.((data) => {
      setProgress(data);
    });

    (async () => {
      try {
        const result = await window.electronAPI.downloadUpdate(serverUrl);
        await window.electronAPI.applyUpdate(result);
      } catch (err) {
        setError(err.message || 'Update failed');
      }
    })();

    return () => cleanup?.();
  }, [serverUrl]);

  const formatBytes = (bytes) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatSpeed = (bytesPerSec) => {
    if (!bytesPerSec || bytesPerSec <= 0) return '';
    if (bytesPerSec < 1024 * 1024) return ` (${(bytesPerSec / 1024).toFixed(0)} KB/s)`;
    return ` (${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s)`;
  };

  const pct = progress.totalBytes > 0 ? (progress.downloadedBytes / progress.totalBytes) * 100 : 0;

  const phaseLabel = {
    downloading: progress.totalBytes > 0
      ? `Downloading... ${formatBytes(progress.downloadedBytes)} / ${formatBytes(progress.totalBytes)}${formatSpeed(progress.speed)}`
      : 'Downloading...',
    extracting: 'Extracting files...',
    applying: 'Applying update...',
  }[progress.phase] || 'Updating...';

  return (
    <>
      <style>{`
        @keyframes byz-spin-cw {
          from { transform: rotate(45deg) translateZ(0); }
          to { transform: rotate(405deg) translateZ(0); }
        }
        @keyframes byz-spin-ccw {
          from { transform: rotate(45deg) translateZ(0); }
          to { transform: rotate(-315deg) translateZ(0); }
        }
        @keyframes byz-pulse {
          0%, 100% { opacity: 0.7; transform: rotate(45deg) scale(1) translateZ(0); }
          50% { opacity: 1; transform: rotate(45deg) scale(1.2) translateZ(0); }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(10, 10, 10, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
      }}>
        {/* Animated /guild diamond logo */}
        <div style={{ position: 'relative', width: 120, height: 120 }}>
          {/* Outer diamond — spins clockwise */}
          <div style={{
            position: 'absolute',
            top: 10, left: 10,
            width: 100, height: 100,
            border: '2px solid rgba(64, 255, 64, 0.4)',
            borderRadius: 4,
            animation: 'byz-spin-cw 4s linear infinite',
            willChange: 'transform',
          }} />
          {/* Middle diamond — spins counter-clockwise */}
          <div style={{
            position: 'absolute',
            top: 25, left: 25,
            width: 70, height: 70,
            border: '2px solid rgba(64, 255, 64, 0.6)',
            borderRadius: 3,
            animation: 'byz-spin-ccw 3s linear infinite',
            willChange: 'transform',
          }} />
          {/* Inner diamond — pulses */}
          <div style={{
            position: 'absolute',
            top: 42, left: 42,
            width: 36, height: 36,
            background: 'rgba(64, 255, 64, 0.8)',
            borderRadius: 2,
            animation: 'byz-pulse 2s ease-in-out infinite',
            willChange: 'transform',
          }} />
        </div>

        {error ? (
          <>
            <div style={{ color: '#e94560', fontSize: 14, fontWeight: 500 }}>{error}</div>
            <button
              onClick={onDismiss}
              style={{
                background: 'rgba(233, 69, 96, 0.15)',
                border: '1px solid rgba(233, 69, 96, 0.3)',
                color: '#e94560',
                padding: '8px 24px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Dismiss
            </button>
          </>
        ) : (
          <>
            <div style={{
              color: '#40FF40',
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: 1,
            }}>
              {phaseLabel}
            </div>

            {progress.phase === 'downloading' && progress.totalBytes > 0 && (
              <div style={{
                width: 240,
                height: 4,
                background: 'rgba(64, 255, 64, 0.15)',
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: '#40FF40',
                  borderRadius: 2,
                  transition: 'width 0.6s ease-out',
                  willChange: 'width',
                }} />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
