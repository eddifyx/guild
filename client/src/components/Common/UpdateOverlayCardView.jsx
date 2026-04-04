import React from 'react';
import { UpdateOverlayLogo } from './UpdateOverlayLogoView.jsx';
import { UpdatePatchNotesPanel } from './UpdatePatchNotesPanelView.jsx';

export function UpdateOverlayCard({ controller, styles, logoMetrics }) {
  return (
    <div style={styles.card}>
      {controller.canDismiss && (
        <button onClick={controller.onDismiss} style={styles.closeButton} aria-label="Dismiss update dialog">
          ×
        </button>
      )}

      <UpdateOverlayLogo logoMetrics={logoMetrics} />

      {controller.showErrorState ? (
        <>
          <div style={styles.title}>Update failed</div>
          <div style={styles.errorBanner}>{controller.error}</div>
          <div style={styles.bodyText}>
            Try the update again, or download the latest build directly if you need to install this release manually.
          </div>
          <div style={styles.buttonRow}>
            <button onClick={controller.onStartUpdate} style={styles.primaryButton}>
              {controller.isManualInstall ? 'Download latest build' : 'Retry update'}
            </button>
            {controller.hasPatchNotes && (
              <button onClick={controller.onTogglePatchNotes} style={styles.secondaryButton}>
                {controller.showPatchNotesPanel ? 'Hide patch notes' : 'View patch notes'}
              </button>
            )}
            <button onClick={controller.onDismiss} style={styles.ghostButton}>
              Dismiss
            </button>
          </div>
        </>
      ) : controller.showInstallingState ? (
        <>
          <div style={styles.title}>Installing update</div>
          <div style={styles.bodyText}>{controller.phaseLabel}</div>
          {controller.showProgressBar && (
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${controller.progressPercent}%` }} />
            </div>
          )}
        </>
      ) : (
        <>
          <div style={styles.title}>{controller.actionTitle}</div>
          <div style={styles.versionMeta}>{controller.versionMeta}</div>
          <div style={styles.bodyText}>{controller.actionSummary}</div>

          <div style={styles.buttonRow}>
            <button onClick={controller.onStartUpdate} style={styles.primaryButton}>
              Update now
            </button>
            {controller.hasPatchNotes && (
              <button onClick={controller.onTogglePatchNotes} style={styles.secondaryButton}>
                {controller.showPatchNotesPanel ? 'Hide patch notes' : 'View patch notes'}
              </button>
            )}
            <button onClick={controller.onDismiss} style={styles.ghostButton}>
              Later
            </button>
          </div>

          {controller.isManualInstall
            && controller.secondaryDownloadUrl
            && controller.secondaryDownloadUrl !== controller.primaryDownloadUrl && (
              <button onClick={controller.onOpenSecondaryDownload} style={styles.textLink}>
                View all downloads
              </button>
            )}
        </>
      )}

      {controller.showPatchNotesPanel && (
        <UpdatePatchNotesPanel patchNotes={controller.patchNotes} styles={styles} />
      )}
    </div>
  );
}
