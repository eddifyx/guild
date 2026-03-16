import { useState, useEffect } from 'react';
import logoGeometry from '../../branding/logoGeometry.json';

const LOGO_SIZE = 120;
const LOGO_SCALE = LOGO_SIZE / logoGeometry.baseSize;
const OUTER_STROKE = roundToTenth(logoGeometry.outerStroke * LOGO_SCALE);
const MIDDLE_STROKE = roundToTenth(logoGeometry.middleStroke * LOGO_SCALE);
const MIDDLE_INSET = roundToTenth(logoGeometry.middleInset * LOGO_SCALE);
const INNER_INSET = roundToTenth(logoGeometry.innerInset * LOGO_SCALE);
const LOGO_TILT = logoGeometry.tilt;

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

export default function UpdateOverlay({ serverUrl, onDismiss, updateInfo = null }) {
  const [progress, setProgress] = useState({ phase: 'downloading', downloadedBytes: 0, totalBytes: 0 });
  const [error, setError] = useState(null);
  const isManualInstall = updateInfo?.updateStrategy === 'manual-install';
  const primaryDownloadUrl = updateInfo?.platformDownload?.installerUrl
    || updateInfo?.platformDownload?.archiveUrl
    || updateInfo?.downloadPageUrl
    || null;
  const secondaryDownloadUrl = updateInfo?.downloadPageUrl || null;

  const openExternal = (url) => {
    if (!url) return;
    window.electronAPI?.openExternal?.(url);
  };

  useEffect(() => {
    if (isManualInstall) {
      return undefined;
    }

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
  }, [serverUrl, isManualInstall]);

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
        <div style={{ position: 'relative', width: LOGO_SIZE, height: LOGO_SIZE, perspective: 960 }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            transform: `rotateX(${LOGO_TILT}deg) rotateY(${(LOGO_TILT * -1.15).toFixed(2)}deg)`,
            transformStyle: 'preserve-3d',
            willChange: 'transform',
          }}>
            {/* Outer diamond — spins clockwise */}
            <div style={{
              position: 'absolute',
              inset: 0,
              border: `${OUTER_STROKE}px solid rgba(64, 255, 64, 0.4)`,
              borderRadius: 4,
              animation: 'byz-spin-cw 4s linear infinite',
              willChange: 'transform',
            }} />
            {/* Middle diamond — spins counter-clockwise */}
            <div style={{
              position: 'absolute',
              inset: MIDDLE_INSET,
              border: `${MIDDLE_STROKE}px solid rgba(64, 255, 64, 0.58)`,
              borderRadius: 3,
              animation: 'byz-spin-ccw 3s linear infinite',
              willChange: 'transform',
            }} />
            {/* Inner diamond — pulses */}
            <div style={{
              position: 'absolute',
              inset: INNER_INSET,
              background: 'rgba(64, 255, 64, 0.8)',
              borderRadius: 2,
              boxShadow: '0 0 16px rgba(64, 255, 64, 0.2)',
              animation: 'byz-pulse 2s ease-in-out infinite',
              willChange: 'transform',
            }} />
          </div>
        </div>

        {error ? (
          <>
            <div style={{ color: '#e94560', fontSize: 14, fontWeight: 500 }}>{error}</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              {primaryDownloadUrl && (
                <button
                  onClick={() => openExternal(primaryDownloadUrl)}
                  style={{
                    background: 'rgba(64, 255, 64, 0.12)',
                    border: '1px solid rgba(64, 255, 64, 0.26)',
                    color: '#40FF40',
                    padding: '8px 24px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  Download latest build
                </button>
              )}
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
            </div>
          </>
        ) : isManualInstall ? (
          <>
            <div style={{
              color: '#40FF40',
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 0.4,
              textAlign: 'center',
            }}>
              Install this release directly
            </div>
            <div style={{
              maxWidth: 480,
              color: 'rgba(231, 239, 231, 0.78)',
              fontSize: 14,
              lineHeight: 1.55,
              textAlign: 'center',
            }}>
              {updateInfo?.manualInstallReason || 'This update should be installed from a direct download for the moment.'}
              {' '}Download the latest build, open it, and replace the existing app.
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              {primaryDownloadUrl && (
                <button
                  onClick={() => openExternal(primaryDownloadUrl)}
                  style={{
                    background: 'rgba(64, 255, 64, 0.12)',
                    border: '1px solid rgba(64, 255, 64, 0.26)',
                    color: '#40FF40',
                    padding: '10px 24px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Download for this device
                </button>
              )}
              {secondaryDownloadUrl && secondaryDownloadUrl !== primaryDownloadUrl && (
                <button
                  onClick={() => openExternal(secondaryDownloadUrl)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: 'rgba(231, 239, 231, 0.9)',
                    padding: '10px 24px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  View all downloads
                </button>
              )}
              <button
                onClick={onDismiss}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'rgba(231, 239, 231, 0.7)',
                  padding: '10px 24px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Dismiss
              </button>
            </div>
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
