import {
  buildAddonDownloadNoticeLabel,
  buildAddonFileViewState,
  buildAddonViewEmptyState,
} from './addonViewModel.mjs';

export function getAddonFileIconVariant(fileType = '') {
  if (fileType.startsWith('image/')) return 'image';
  if (fileType.startsWith('video/')) return 'video';
  if (fileType.startsWith('audio/')) return 'audio';
  if (
    fileType.includes('zip')
    || fileType.includes('rar')
    || fileType.includes('7z')
    || fileType.includes('tar')
    || fileType.includes('gz')
  ) {
    return 'archive';
  }

  return 'file';
}

export function buildAddonCardPanelState({
  addon = null,
  currentUserId = null,
  getFileUrlFn = (value) => value,
} = {}) {
  const fileViewState = buildAddonFileViewState({
    addon,
    currentUserId,
    getFileUrlFn,
  });

  return {
    ...fileViewState,
    iconVariant: getAddonFileIconVariant(fileViewState.fileType),
    canDelete: fileViewState.isOwner,
  };
}

export function buildAddonGridPanelState({
  loading = false,
  addons = [],
  pendingUpload = null,
} = {}) {
  return buildAddonViewEmptyState({
    loading,
    addonCount: addons.length,
    hasPendingFile: !!pendingUpload,
  });
}

export function buildAddonUploadSectionState({
  uploading = false,
  dragOver = false,
  uploadError = null,
} = {}) {
  return {
    uploadButtonLabel: uploading ? 'Uploading...' : 'Upload Addon',
    uploadButtonDisabled: uploading,
    uploadButtonCursor: uploading ? 'not-allowed' : 'pointer',
    uploadButtonBackground: uploading ? 'var(--bg-tertiary)' : 'var(--accent)',
    uploadButtonColor: uploading ? 'var(--text-muted)' : '#050705',
    dropZoneLabel: dragOver ? 'Drop file here' : 'Drag & drop files here',
    dropZoneBorderColor: dragOver ? 'var(--accent)' : 'var(--border)',
    dropZoneColor: dragOver ? 'var(--accent)' : 'var(--text-muted)',
    dropZoneCursor: uploading ? 'not-allowed' : 'pointer',
    dropZoneBackground: dragOver ? 'rgba(64, 255, 64, 0.06)' : 'transparent',
    showUploadError: Boolean(uploadError),
  };
}

export function buildPendingAddonCardState({
  pendingUpload = null,
} = {}) {
  if (!pendingUpload) return null;

  return {
    ...pendingUpload,
    iconVariant: getAddonFileIconVariant(pendingUpload.type || ''),
  };
}

export function buildAddonDownloadNoticeState({
  fileName = '',
} = {}) {
  return {
    label: buildAddonDownloadNoticeLabel(fileName),
  };
}
