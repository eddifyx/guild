export function formatAssetSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getAssetTimeRemaining(expiresAt) {
  const normalizedExpiry = expiresAt?.includes('T')
    ? expiresAt
    : `${String(expiresAt || '').replace(' ', 'T')}Z`;
  const diff = new Date(normalizedExpiry) - new Date();
  if (diff <= 0) return { text: 'Expired', urgent: true };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return { text: `${days}d ${hours}h left`, urgent: false };
  if (hours > 0) return { text: `${hours}h ${minutes}m left`, urgent: hours < 1 };
  return { text: `${minutes}m left`, urgent: true };
}

export function isAssetImageType(fileType = '') {
  return String(fileType || '').startsWith('image/');
}

export function buildPendingAssetView(pendingFile, uploadProgress) {
  if (!pendingFile) return null;
  return {
    ...pendingFile,
    uploadProgress,
    uploadLabel: uploadProgress < 100 ? 'Uploading...' : 'Processing...',
    sizeLabel: formatAssetSize(pendingFile.size || 0),
  };
}

export function buildAssetCardView({
  asset,
  currentUserId,
  getFileUrlFn,
} = {}) {
  const url = getFileUrlFn(asset.file_url);
  return {
    ...asset,
    url,
    isImage: isAssetImageType(asset.file_type || ''),
    isOwner: asset.uploaded_by === currentUserId,
    sizeLabel: formatAssetSize(asset.file_size || 0),
    remaining: getAssetTimeRemaining(asset.expires_at),
  };
}
