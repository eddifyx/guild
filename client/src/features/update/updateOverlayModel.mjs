export const INITIAL_UPDATE_PROGRESS = {
  phase: 'downloading',
  downloadedBytes: 0,
  totalBytes: 0,
};

export function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

export function buildUpdateOverlayLogoMetrics(logoGeometry, logoSize = 120) {
  const logoScale = logoSize / logoGeometry.baseSize;

  return {
    logoSize,
    logoTilt: logoGeometry.tilt,
    outerStroke: roundToTenth(logoGeometry.outerStroke * logoScale),
    middleStroke: roundToTenth(logoGeometry.middleStroke * logoScale),
    middleInset: roundToTenth(logoGeometry.middleInset * logoScale),
    innerInset: roundToTenth(logoGeometry.innerInset * logoScale),
  };
}

export function normalizeUpdatePatchNotes(patchNotes) {
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
            if (typeof item === 'string') {
              return item.trim().length > 0;
            }
            return Boolean(item?.title || item?.body);
          })
          : [];

        if (!title && items.length === 0) {
          return null;
        }

        return { title, items };
      })
      .filter(Boolean)
    : [];

  return { headline, summary, sections };
}

export function formatUpdateBytes(bytes) {
  if (!bytes) {
    return '0 KB';
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatUpdateSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) {
    return '';
  }
  if (bytesPerSec < 1024 * 1024) {
    return ` (${(bytesPerSec / 1024).toFixed(0)} KB/s)`;
  }
  return ` (${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s)`;
}

export function buildUpdateOverlayViewState({
  progress = INITIAL_UPDATE_PROGRESS,
  error = null,
  updateStarted = false,
  preparingUpdate = false,
  showPatchNotes = false,
  updateInfo = null,
} = {}) {
  const isManualInstall = updateInfo?.updateStrategy === 'manual-install';
  const primaryDownloadUrl = updateInfo?.platformDownload?.installerUrl
    || updateInfo?.platformDownload?.archiveUrl
    || updateInfo?.downloadPageUrl
    || null;
  const secondaryDownloadUrl = updateInfo?.downloadPageUrl || null;
  const patchNotes = normalizeUpdatePatchNotes(updateInfo?.patchNotes);
  const hasPatchNotes = Boolean(
    patchNotes.headline
    || patchNotes.summary
    || patchNotes.sections.length > 0
  );

  const progressPercent = progress.totalBytes > 0
    ? (progress.downloadedBytes / progress.totalBytes) * 100
    : 0;

  const phaseLabels = {
    preparing: 'Leaving voice channel...',
    downloading: progress.totalBytes > 0
      ? `Downloading... ${formatUpdateBytes(progress.downloadedBytes)} / ${formatUpdateBytes(progress.totalBytes)}${formatUpdateSpeed(progress.speed)}`
      : 'Downloading...',
    extracting: 'Extracting files...',
    applying: 'Applying update...',
  };

  return {
    isManualInstall,
    primaryDownloadUrl,
    secondaryDownloadUrl,
    patchNotes,
    hasPatchNotes,
    progressPercent,
    canDismiss: !updateStarted || isManualInstall || Boolean(error),
    showPatchNotesPanel: showPatchNotes && hasPatchNotes && !updateStarted,
    showProgressBar: !preparingUpdate && progress.phase === 'downloading' && progress.totalBytes > 0,
    showErrorState: Boolean(error),
    showInstallingState: (preparingUpdate || updateStarted) && !isManualInstall,
    actionTitle: updateInfo?.remoteVersion
      ? `Update v${updateInfo.remoteVersion} available`
      : 'Update available',
    actionSummary: isManualInstall
      ? (updateInfo?.manualInstallReason || 'Direct download is required for this release.')
      : 'Install the latest release now, or review the patch notes first.',
    versionMeta: [
      updateInfo?.localVersion ? `Current v${updateInfo.localVersion}` : 'Current version detected',
      updateInfo?.remoteVersion ? `New v${updateInfo.remoteVersion}` : '',
      updateInfo?.releasedAt || '',
    ].filter(Boolean).join(' • '),
    phaseLabel: preparingUpdate
      ? phaseLabels.preparing
      : (phaseLabels[progress.phase] || 'Updating...'),
  };
}
