import { useState, useEffect } from 'react';
import logoGeometry from '../../branding/logoGeometry.json';

const LOGO_SIZE = 120;
const LOGO_SCALE = LOGO_SIZE / logoGeometry.baseSize;
const OUTER_STROKE = roundToTenth(logoGeometry.outerStroke * LOGO_SCALE);
const MIDDLE_STROKE = roundToTenth(logoGeometry.middleStroke * LOGO_SCALE);
const MIDDLE_INSET = roundToTenth(logoGeometry.middleInset * LOGO_SCALE);
const INNER_INSET = roundToTenth(logoGeometry.innerInset * LOGO_SCALE);
const LOGO_TILT = logoGeometry.tilt;
const INITIAL_PROGRESS = { phase: 'downloading', downloadedBytes: 0, totalBytes: 0 };

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

function normalizePatchNotes(patchNotes) {
  if (!patchNotes) {
    return { headline: null, summary: null, sections: [] };
  }

  if (typeof patchNotes === 'string') {
    return { headline: null, summary: patchNotes, sections: [] };
  }

  if (Array.isArray(patchNotes)) {
    return {
      headline: null,
      summary: null,
      sections: [{ title: 'Highlights', items: patchNotes }],
    };
  }

  const headline = typeof patchNotes.headline === 'string' ? patchNotes.headline.trim() : null;
  const summary = typeof patchNotes.summary === 'string' ? patchNotes.summary.trim() : null;
  const sections = Array.isArray(patchNotes.sections)
    ? patchNotes.sections
      .map((section) => {
        const title = typeof section?.title === 'string' ? section.title.trim() : '';
        const items = Array.isArray(section?.items)
          ? section.items.filter((item) => {
            if (typeof item === 'string') return item.trim().length > 0;
            return Boolean(item?.title || item?.body);
          })
          : [];

        if (!title && items.length === 0) return null;
        return { title, items };
      })
      .filter(Boolean)
    : [];

  return { headline, summary, sections };
}

function renderPatchNoteItem(item, index) {
  if (typeof item === 'string') {
    return (
      <li key={`note-${index}`} style={styles.patchNoteBullet}>
        {item}
      </li>
    );
  }

  const title = typeof item?.title === 'string' ? item.title.trim() : '';
  const body = typeof item?.body === 'string' ? item.body.trim() : '';

  return (
    <li key={`note-${index}`} style={styles.patchNoteBullet}>
      {title && (
        <div style={{ color: 'rgba(231, 239, 231, 0.96)', fontWeight: 600, marginBottom: body ? 4 : 0 }}>
          {title}
        </div>
      )}
      {body && (
        <div style={{ color: 'rgba(231, 239, 231, 0.72)', lineHeight: 1.55 }}>
          {body}
        </div>
      )}
    </li>
  );
}

export default function UpdateOverlay({ serverUrl, onDismiss, updateInfo = null }) {
  const [progress, setProgress] = useState(INITIAL_PROGRESS);
  const [error, setError] = useState(null);
  const [updateStarted, setUpdateStarted] = useState(false);
  const [showPatchNotes, setShowPatchNotes] = useState(false);

  const isManualInstall = updateInfo?.updateStrategy === 'manual-install';
  const primaryDownloadUrl = updateInfo?.platformDownload?.installerUrl
    || updateInfo?.platformDownload?.archiveUrl
    || updateInfo?.downloadPageUrl
    || null;
  const secondaryDownloadUrl = updateInfo?.downloadPageUrl || null;
  const patchNotes = normalizePatchNotes(updateInfo?.patchNotes);
  const hasPatchNotes = Boolean(
    patchNotes.headline
    || patchNotes.summary
    || patchNotes.sections.length > 0
  );

  const openExternal = (url) => {
    if (!url) return;
    window.electronAPI?.openExternal?.(url);
  };

  useEffect(() => {
    if (isManualInstall || !updateStarted) {
      return undefined;
    }

    const cleanup = window.electronAPI?.onUpdateProgress?.((data) => {
      setProgress(data);
    });

    let active = true;

    (async () => {
      try {
        const result = await window.electronAPI.downloadUpdate({
          serverUrl,
          archiveUrl: updateInfo?.platformDownload?.archiveUrl || null,
          platformDownload: updateInfo?.platformDownload || null,
        });
        await window.electronAPI.applyUpdate(result);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Update failed');
        setUpdateStarted(false);
      }
    })();

    return () => {
      active = false;
      cleanup?.();
    };
  }, [serverUrl, isManualInstall, updateStarted]);

  const formatBytes = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatSpeed = (bytesPerSec) => {
    if (!bytesPerSec || bytesPerSec <= 0) return '';
    if (bytesPerSec < 1024 * 1024) return ` (${(bytesPerSec / 1024).toFixed(0)} KB/s)`;
    return ` (${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s)`;
  };

  const startUpdate = () => {
    setError(null);
    setProgress(INITIAL_PROGRESS);

    if (isManualInstall) {
      openExternal(primaryDownloadUrl || secondaryDownloadUrl);
      return;
    }

    setUpdateStarted(true);
  };

  const pct = progress.totalBytes > 0 ? (progress.downloadedBytes / progress.totalBytes) * 100 : 0;

  const phaseLabel = {
    downloading: progress.totalBytes > 0
      ? `Downloading... ${formatBytes(progress.downloadedBytes)} / ${formatBytes(progress.totalBytes)}${formatSpeed(progress.speed)}`
      : 'Downloading...',
    extracting: 'Extracting files...',
    applying: 'Applying update...',
  }[progress.phase] || 'Updating...';

  const actionTitle = updateInfo?.remoteVersion
    ? `Update v${updateInfo.remoteVersion} available`
    : 'Update available';

  const actionSummary = isManualInstall
    ? (updateInfo?.manualInstallReason || 'Direct download is required for this release.')
    : 'Install the latest release now, or review the patch notes first.';

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
      <div style={styles.backdrop}>
        <div style={styles.card}>
          {(!updateStarted || isManualInstall || error) && (
            <button onClick={onDismiss} style={styles.closeButton} aria-label="Dismiss update dialog">
              ×
            </button>
          )}

          <div style={{ position: 'relative', width: LOGO_SIZE, height: LOGO_SIZE, perspective: 960 }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              transform: `rotateX(${LOGO_TILT}deg) rotateY(${(LOGO_TILT * -1.15).toFixed(2)}deg)`,
              transformStyle: 'preserve-3d',
              willChange: 'transform',
            }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                border: `${OUTER_STROKE}px solid rgba(64, 255, 64, 0.4)`,
                borderRadius: 4,
                animation: 'byz-spin-cw 4s linear infinite',
                willChange: 'transform',
              }} />
              <div style={{
                position: 'absolute',
                inset: MIDDLE_INSET,
                border: `${MIDDLE_STROKE}px solid rgba(64, 255, 64, 0.58)`,
                borderRadius: 3,
                animation: 'byz-spin-ccw 3s linear infinite',
                willChange: 'transform',
              }} />
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
              <div style={styles.title}>Update failed</div>
              <div style={styles.errorBanner}>{error}</div>
              <div style={styles.bodyText}>
                Try the update again, or download the latest build directly if you need to install this release manually.
              </div>
              <div style={styles.buttonRow}>
                <button onClick={startUpdate} style={styles.primaryButton}>
                  {isManualInstall ? 'Download latest build' : 'Retry update'}
                </button>
                {hasPatchNotes && (
                  <button
                    onClick={() => setShowPatchNotes((current) => !current)}
                    style={styles.secondaryButton}
                  >
                    {showPatchNotes ? 'Hide patch notes' : 'View patch notes'}
                  </button>
                )}
                <button onClick={onDismiss} style={styles.ghostButton}>
                  Dismiss
                </button>
              </div>
            </>
          ) : updateStarted && !isManualInstall ? (
            <>
              <div style={styles.title}>Installing update</div>
              <div style={styles.bodyText}>
                {phaseLabel}
              </div>
              {progress.phase === 'downloading' && progress.totalBytes > 0 && (
                <div style={styles.progressTrack}>
                  <div style={{ ...styles.progressFill, width: `${pct}%` }} />
                </div>
              )}
            </>
          ) : (
            <>
              <div style={styles.title}>{actionTitle}</div>
              <div style={styles.versionMeta}>
                {updateInfo?.localVersion ? `Current v${updateInfo.localVersion}` : 'Current version detected'}
                {updateInfo?.remoteVersion ? ` • New v${updateInfo.remoteVersion}` : ''}
                {updateInfo?.releasedAt ? ` • ${updateInfo.releasedAt}` : ''}
              </div>
              <div style={styles.bodyText}>{actionSummary}</div>

              <div style={styles.buttonRow}>
                <button onClick={startUpdate} style={styles.primaryButton}>
                  Update now
                </button>
                {hasPatchNotes && (
                  <button
                    onClick={() => setShowPatchNotes((current) => !current)}
                    style={styles.secondaryButton}
                  >
                    {showPatchNotes ? 'Hide patch notes' : 'View patch notes'}
                  </button>
                )}
                <button onClick={onDismiss} style={styles.ghostButton}>
                  Later
                </button>
              </div>

              {isManualInstall && secondaryDownloadUrl && secondaryDownloadUrl !== primaryDownloadUrl && (
                <button onClick={() => openExternal(secondaryDownloadUrl)} style={styles.textLink}>
                  View all downloads
                </button>
              )}
            </>
          )}

          {showPatchNotes && hasPatchNotes && !updateStarted && (
            <div style={styles.patchNotesPanel}>
              {patchNotes.headline && (
                <div style={styles.patchNotesHeadline}>{patchNotes.headline}</div>
              )}
              {patchNotes.summary && (
                <div style={styles.patchNotesSummary}>{patchNotes.summary}</div>
              )}
              {patchNotes.sections.map((section, sectionIndex) => (
                <div key={`section-${sectionIndex}`} style={styles.patchNotesSection}>
                  {section.title && (
                    <div style={styles.patchNotesSectionTitle}>{section.title}</div>
                  )}
                  {section.items.length > 0 && (
                    <ul style={styles.patchNotesList}>
                      {section.items.map((item, itemIndex) => renderPatchNoteItem(item, `${sectionIndex}-${itemIndex}`))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'rgba(10, 10, 10, 0.68)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: 'min(680px, 100%)',
    maxHeight: 'min(88vh, 920px)',
    overflowY: 'auto',
    background: 'linear-gradient(180deg, rgba(9, 16, 10, 0.98) 0%, rgba(6, 10, 7, 0.98) 100%)',
    border: '1px solid rgba(64, 255, 64, 0.12)',
    borderRadius: 24,
    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.58)',
    padding: '32px 30px 28px',
    color: '#e7efe7',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 18,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 999,
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: 'rgba(231, 239, 231, 0.72)',
    fontSize: 22,
    lineHeight: 1,
    cursor: 'pointer',
  },
  title: {
    color: '#40FF40',
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  versionMeta: {
    color: 'rgba(231, 239, 231, 0.52)',
    fontSize: 12,
    letterSpacing: 0.35,
    textAlign: 'center',
    marginTop: -8,
  },
  bodyText: {
    maxWidth: 520,
    color: 'rgba(231, 239, 231, 0.78)',
    fontSize: 14,
    lineHeight: 1.6,
    textAlign: 'center',
  },
  buttonRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  primaryButton: {
    background: 'rgba(64, 255, 64, 0.14)',
    border: '1px solid rgba(64, 255, 64, 0.32)',
    color: '#40FF40',
    padding: '11px 22px',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    minWidth: 150,
  },
  secondaryButton: {
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    color: 'rgba(231, 239, 231, 0.92)',
    padding: '11px 22px',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    minWidth: 170,
  },
  ghostButton: {
    background: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: 'rgba(231, 239, 231, 0.72)',
    padding: '11px 22px',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 13,
  },
  textLink: {
    marginTop: -4,
    background: 'transparent',
    border: 'none',
    color: '#9fe0b1',
    cursor: 'pointer',
    fontSize: 12,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  progressTrack: {
    width: 'min(320px, 100%)',
    height: 6,
    background: 'rgba(64, 255, 64, 0.15)',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    background: '#40FF40',
    borderRadius: 999,
    transition: 'width 0.6s ease-out',
    willChange: 'width',
  },
  errorBanner: {
    width: '100%',
    maxWidth: 520,
    padding: '12px 14px',
    borderRadius: 12,
    background: 'rgba(233, 69, 96, 0.12)',
    border: '1px solid rgba(233, 69, 96, 0.26)',
    color: '#ffb4bf',
    fontSize: 13,
    lineHeight: 1.55,
    textAlign: 'center',
  },
  patchNotesPanel: {
    width: '100%',
    maxWidth: 560,
    marginTop: 6,
    padding: '18px 18px 6px',
    borderRadius: 16,
    border: '1px solid rgba(64, 255, 64, 0.12)',
    background: 'rgba(11, 18, 12, 0.92)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.02)',
  },
  patchNotesHeadline: {
    color: '#e7efe7',
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 8,
  },
  patchNotesSummary: {
    color: 'rgba(231, 239, 231, 0.78)',
    fontSize: 14,
    lineHeight: 1.6,
    marginBottom: 16,
  },
  patchNotesSection: {
    marginBottom: 16,
  },
  patchNotesSectionTitle: {
    color: '#8ef7a8',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  patchNotesList: {
    margin: 0,
    paddingLeft: 18,
    display: 'grid',
    gap: 10,
  },
  patchNoteBullet: {
    color: 'rgba(231, 239, 231, 0.82)',
    fontSize: 13,
    lineHeight: 1.6,
  },
};
