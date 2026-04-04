function createAppleVoiceHelperRuntime({
  app,
  fs,
  path,
  spawn,
  processRef = process,
  baseDir = __dirname,
  helperRelativeDir,
  sourceName,
  binaryName,
}) {
  function isAppleVoiceCapturePlatformSupported() {
    return processRef.platform === 'darwin' && processRef.arch === 'arm64';
  }

  function isAppleVoiceCaptureSupported(disabledReason) {
    return isAppleVoiceCapturePlatformSupported() && !disabledReason;
  }

  function shouldDisableAppleVoiceCaptureForMessage(message = '') {
    const normalized = String(message || '').toLowerCase();
    return normalized.includes('could not initialize the audio unit')
      || normalized.includes('could not create the audio unit')
      || normalized.includes('could not configure')
      || normalized.includes('voiceprocessingi/o is unavailable')
      || normalized.includes('voiceprocessingio is unavailable');
  }

  function getAppleVoiceHelperSourceCandidates() {
    return [
      path.join(baseDir, '..', '..', helperRelativeDir, sourceName),
      path.join(baseDir, helperRelativeDir.replace(/^electron\//, ''), sourceName),
    ];
  }

  function getAppleVoiceHelperBinaryCandidates() {
    return [
      path.join(baseDir, '..', '..', helperRelativeDir, 'bin', binaryName),
      path.join(baseDir, helperRelativeDir.replace(/^electron\//, ''), 'bin', binaryName),
    ];
  }

  function findExistingPath(candidates) {
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  function normalizeAppleVoiceCaptureOwnerId(ownerId) {
    if (typeof ownerId !== 'string') {
      return 'default';
    }
    const normalized = ownerId.trim();
    return normalized || 'default';
  }

  async function ensureAppleVoiceHelperBinary() {
    if (!isAppleVoiceCapturePlatformSupported()) {
      throw new Error('Apple voice processing is only available on Apple silicon Macs.');
    }

    const sourcePath = findExistingPath(getAppleVoiceHelperSourceCandidates());
    if (!sourcePath) {
      throw new Error('Apple voice helper source is missing from the app bundle.');
    }

    const packagedBinaryPath = findExistingPath(getAppleVoiceHelperBinaryCandidates());
    if (app.isPackaged) {
      if (!packagedBinaryPath) {
        throw new Error('Apple voice helper binary is missing from the packaged app.');
      }
      return packagedBinaryPath;
    }

    const binaryDir = path.join(path.dirname(sourcePath), 'bin');
    const binaryPath = packagedBinaryPath || path.join(binaryDir, binaryName);
    const shouldCompile =
      !fs.existsSync(binaryPath)
      || fs.statSync(binaryPath).mtimeMs < fs.statSync(sourcePath).mtimeMs;

    if (!shouldCompile) {
      return binaryPath;
    }

    fs.mkdirSync(binaryDir, { recursive: true });
    const moduleCachePath = path.join(binaryDir, '.swift-module-cache');
    const tempDir = path.join(binaryDir, '.swift-tmp');
    fs.mkdirSync(moduleCachePath, { recursive: true });
    fs.mkdirSync(tempDir, { recursive: true });

    await new Promise((resolve, reject) => {
      const compile = spawn(
        'swiftc',
        ['-module-cache-path', moduleCachePath, '-O', sourcePath, '-o', binaryPath],
        {
          env: {
            ...processRef.env,
            SWIFT_MODULECACHE_PATH: moduleCachePath,
            TMPDIR: tempDir,
          },
        }
      );
      let stderr = '';

      compile.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      compile.on('error', (error) => {
        reject(error);
      });

      compile.on('close', (code) => {
        if (code === 0) {
          fs.chmodSync(binaryPath, 0o755);
          resolve();
          return;
        }

        reject(new Error(stderr.trim() || `swiftc exited with code ${code}`));
      });
    });

    return binaryPath;
  }

  return {
    ensureAppleVoiceHelperBinary,
    findExistingPath,
    getAppleVoiceHelperBinaryCandidates,
    getAppleVoiceHelperSourceCandidates,
    isAppleVoiceCapturePlatformSupported,
    isAppleVoiceCaptureSupported,
    normalizeAppleVoiceCaptureOwnerId,
    shouldDisableAppleVoiceCaptureForMessage,
  };
}

module.exports = {
  createAppleVoiceHelperRuntime,
};
