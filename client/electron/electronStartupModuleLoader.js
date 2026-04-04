function requireFirstExistingModule({ candidates, errorMessage, fs, requireFn }) {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return requireFn(candidate);
    }
  }

  throw new Error(`${errorMessage}. Checked: ${candidates.join(', ')}`);
}

function loadAppFlavorConfig({ baseDir, fs, path, requireFn }) {
  return requireFirstExistingModule({
    candidates: [
      path.join(baseDir, '..', '..', 'config', 'appFlavor.js'),
      path.join(baseDir, '..', 'config', 'appFlavor.js'),
      path.join(baseDir, 'config', 'appFlavor.js'),
    ],
    errorMessage: 'Unable to locate appFlavor.js',
    fs,
    requireFn,
  });
}

function loadSignalBridge({ baseDir, fs, path, requireFn }) {
  return requireFirstExistingModule({
    candidates: [
      path.join(baseDir, '..', '..', 'electron', 'crypto', 'signalBridge.js'),
      path.join(baseDir, 'client', 'electron', 'crypto', 'signalBridge.js'),
      path.join(baseDir, 'crypto', 'signalBridge.js'),
    ],
    errorMessage: 'Unable to locate signalBridge.js',
    fs,
    requireFn,
  });
}

module.exports = {
  loadAppFlavorConfig,
  loadSignalBridge,
  requireFirstExistingModule,
};
