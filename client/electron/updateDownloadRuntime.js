const {
  DEFAULT_PROGRESS_INTERVAL_MS,
  DOWNLOAD_ARCHIVE_FILE_NAME,
  resolveUpdateArchiveUrl,
} = require('./updateDownloadModel');
const { createUpdateExtractRuntime } = require('./updateExtractRuntime');

function emitUpdateProgress(sendUpdateProgress, payload) {
  if (typeof sendUpdateProgress === 'function') {
    sendUpdateProgress(payload);
  }
}

function createUpdateDownloadRuntime({
  fs,
  http,
  https,
  isSafeExternalHttpUrl,
  legacyUpdateSlug,
  nowFn = () => Date.now(),
  os,
  path,
  processRef = process,
  productSlug,
  sendUpdateProgress,
  spawn,
}) {
  const extractRuntime = createUpdateExtractRuntime({
    fs,
    path,
    processRef,
    spawn,
  });

  function resolveArchiveUrl(updateSource) {
    return resolveUpdateArchiveUrl(updateSource, {
      legacyUpdateSlug,
      platform: processRef.platform,
      arch: processRef.arch,
    });
  }

  async function downloadUpdate(updateSource) {
    const tempDir = path.join(os.tmpdir(), `${productSlug}-update-${nowFn()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    const zipPath = path.join(tempDir, DOWNLOAD_ARCHIVE_FILE_NAME);
    const zipUrl = resolveArchiveUrl(updateSource);

    if (!zipUrl || !isSafeExternalHttpUrl(zipUrl)) {
      throw new Error('No update archive URL is available for this device.');
    }

    return new Promise((resolve, reject) => {
      const client = zipUrl.startsWith('https') ? https : http;
      const req = client.get(zipUrl, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }

        const totalBytes = parseInt(res.headers['content-length'], 10) || 0;
        let downloadedBytes = 0;
        let lastProgressTime = 0;
        let lastProgressBytes = 0;
        const speedSamples = [];
        const file = fs.createWriteStream(zipPath, { highWaterMark: 1024 * 1024 });

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          const now = nowFn();
          const elapsed = now - lastProgressTime;
          if (elapsed >= DEFAULT_PROGRESS_INTERVAL_MS || downloadedBytes === totalBytes) {
            const instantSpeed = elapsed > 0
              ? ((downloadedBytes - lastProgressBytes) / (elapsed / 1000))
              : 0;
            speedSamples.push(instantSpeed);
            if (speedSamples.length > 5) speedSamples.shift();
            const avgSpeed = speedSamples.reduce((sum, speed) => sum + speed, 0) / speedSamples.length;

            lastProgressTime = now;
            lastProgressBytes = downloadedBytes;
            emitUpdateProgress(sendUpdateProgress, {
              phase: 'downloading',
              downloadedBytes,
              totalBytes,
              speed: avgSpeed,
            });
          }
        });

        res.pipe(file);
        file.on('finish', () => {
          file.close();
          emitUpdateProgress(sendUpdateProgress, {
            phase: 'downloading',
            downloadedBytes,
            totalBytes,
          });
          resolve({ zipPath, tempDir });
        });
        file.on('error', (error) => {
          fs.unlink(zipPath, () => {});
          reject(error);
        });
      });
      req.on('error', reject);
    });
  }

  return {
    downloadUpdate,
    extractUpdateArchive: extractRuntime.extractUpdateArchive,
    resolveUpdateArchiveUrl: resolveArchiveUrl,
  };
}

module.exports = {
  createUpdateDownloadRuntime,
  resolveUpdateArchiveUrl,
};
