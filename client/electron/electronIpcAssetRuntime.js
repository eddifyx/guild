function isSafeExternalHttpUrl(url) {
  try {
    const parsed = new URL(String(url || ''));
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function createElectronIpcAssetRuntime({
  assetSuffix,
  baseDir,
  fs,
  openExternal,
  path,
}) {
  function resolveAssetPath(...segments) {
    const candidates = [
      path.join(baseDir, '..', ...segments),
      path.join(baseDir, '..', '..', 'assets', segments[segments.length - 1]),
      path.join(baseDir, '..', '..', ...segments),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return candidates[0];
  }

  function resolveFlavorAssetPath(assetStem, extension) {
    const candidates = [];

    if (assetSuffix) {
      candidates.push(resolveAssetPath('assets', `${assetStem}-${assetSuffix}.${extension}`));
    }
    candidates.push(resolveAssetPath('assets', `${assetStem}.${extension}`));

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return candidates[candidates.length - 1];
  }

  function openExternalHttpUrl(url) {
    if (!isSafeExternalHttpUrl(url)) {
      return false;
    }

    void openExternal(url);
    return true;
  }

  return {
    openExternalHttpUrl,
    resolveFlavorAssetPath,
  };
}

module.exports = {
  createElectronIpcAssetRuntime,
  isSafeExternalHttpUrl,
};
