export function formatAddonSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildAddonFileViewState({
  addon = null,
  currentUserId = null,
  getFileUrlFn = (value) => value,
} = {}) {
  const fileType = addon?.file_type || '';

  return {
    isOwner: addon?.uploaded_by === currentUserId,
    url: getFileUrlFn(addon?.file_url),
    isImage: fileType.startsWith('image/'),
    fileType,
    formattedSize: formatAddonSize(addon?.file_size || 0),
  };
}

export function buildPendingAddonUploadState({
  pendingFile = null,
  uploadProgress = 0,
} = {}) {
  if (!pendingFile) {
    return null;
  }

  return {
    ...pendingFile,
    formattedSize: formatAddonSize(pendingFile.size || 0),
    statusLabel: uploadProgress < 100 ? 'Uploading...' : 'Processing...',
    uploadProgress,
  };
}

export function buildAddonViewEmptyState({
  loading = false,
  addonCount = 0,
  hasPendingFile = false,
} = {}) {
  return {
    showLoading: loading,
    showEmpty: !loading && addonCount === 0 && !hasPendingFile,
    showGrid: !loading && (addonCount > 0 || hasPendingFile),
  };
}

export function buildAddonDownloadNoticeLabel(fileName = '') {
  return `Downloading ${fileName} to your Downloads folder`;
}
