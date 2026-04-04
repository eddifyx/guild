function createElectronIpcPerfRuntime({
  fs,
  logger = console,
  os,
  path,
  perfSampleLimit = 200,
  processEnv = process.env,
  productSlug,
}) {
  const perfSamples = [];
  const debugLogPath = path.join(os.tmpdir(), `${productSlug}-debug.log`);

  function recordPerfSample(sample) {
    if (!sample || processEnv.NODE_ENV === 'production') return;

    const normalized = {
      ...sample,
      receivedAt: new Date().toISOString(),
    };

    perfSamples.push(normalized);
    if (perfSamples.length > perfSampleLimit) {
      perfSamples.splice(0, perfSamples.length - perfSampleLimit);
    }

    try {
      logger.info('[Perf]', JSON.stringify(normalized));
    } catch {
      logger.info('[Perf]', normalized);
    }
  }

  function getPerfSamples() {
    return perfSamples.slice();
  }

  function appendDebugLog(scope, details) {
    try {
      fs.appendFileSync(
        debugLogPath,
        `[${new Date().toISOString()}] [${scope}] ${details}\n`,
        'utf8'
      );
    } catch {}
  }

  function readDebugLogTail({ scope = null, limit = 50 } = {}) {
    const boundedLimit = Number.isInteger(limit) && limit > 0
      ? Math.min(limit, 200)
      : 50;

    try {
      const raw = fs.readFileSync(debugLogPath, 'utf8');
      const lines = String(raw)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const normalizedScope = typeof scope === 'string' && scope.trim()
        ? scope.trim()
        : null;
      const filtered = normalizedScope
        ? lines.filter((line) => line.includes(`[${normalizedScope}]`))
        : lines;
      return filtered.slice(-boundedLimit);
    } catch {
      return [];
    }
  }

  return {
    appendDebugLog,
    getPerfSamples,
    recordPerfSample,
    readDebugLogTail,
  };
}

module.exports = {
  createElectronIpcPerfRuntime,
};
