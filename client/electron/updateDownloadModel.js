const DEFAULT_PROGRESS_INTERVAL_MS = 500;
const DOWNLOAD_ARCHIVE_FILE_NAME = 'update.zip';
const EXTRACTED_UPDATE_DIR_NAME = 'extracted';

function buildUpdatePlatformSlug({ platform, arch }) {
  return platform === 'darwin' ? `darwin-${arch}` : `${platform}-${arch}`;
}

function resolveUpdateArchiveUrl(updateSource, {
  legacyUpdateSlug,
  platform = process.platform,
  arch = process.arch,
} = {}) {
  if (!legacyUpdateSlug) return null;

  if (updateSource && typeof updateSource === 'object') {
    if (typeof updateSource.archiveUrl === 'string' && updateSource.archiveUrl.trim()) {
      return updateSource.archiveUrl.trim();
    }
    if (typeof updateSource?.platformDownload?.archiveUrl === 'string' && updateSource.platformDownload.archiveUrl.trim()) {
      return updateSource.platformDownload.archiveUrl.trim();
    }
    if (typeof updateSource.serverUrl === 'string' && updateSource.serverUrl.trim()) {
      const normalized = updateSource.serverUrl.trim().replace(/\/+$/, '');
      return `${normalized}/updates/${legacyUpdateSlug}-latest-${buildUpdatePlatformSlug({ platform, arch })}.zip`;
    }
  }

  if (typeof updateSource === 'string' && updateSource.trim()) {
    const normalized = updateSource.trim().replace(/\/+$/, '');
    return `${normalized}/updates/${legacyUpdateSlug}-latest-${buildUpdatePlatformSlug({ platform, arch })}.zip`;
  }

  return null;
}

module.exports = {
  DEFAULT_PROGRESS_INTERVAL_MS,
  DOWNLOAD_ARCHIVE_FILE_NAME,
  EXTRACTED_UPDATE_DIR_NAME,
  buildUpdatePlatformSlug,
  resolveUpdateArchiveUrl,
};
