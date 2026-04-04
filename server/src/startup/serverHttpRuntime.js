const http = require('http');

function createRequestMetricsMiddleware(runtimeMetrics, {
  shouldSkipFn = (requestUrl) => requestUrl.startsWith('/api/dev/'),
  timeSourceFn = () => process.hrtime.bigint(),
} = {}) {
  return function requestMetricsMiddleware(req, res, next) {
    const requestUrl = req.originalUrl || req.url || '';
    if (shouldSkipFn(requestUrl)) {
      next();
      return;
    }

    const startedAt = timeSourceFn();
    runtimeMetrics.beginHttpRequest();

    let finished = false;
    const finalize = () => {
      if (finished) return;
      finished = true;
      const durationMs = Number(timeSourceFn() - startedAt) / 1e6;
      runtimeMetrics.endHttpRequest({
        method: req.method,
        url: requestUrl,
        statusCode: res.statusCode,
        durationMs,
      });
    };

    res.on('finish', finalize);
    res.on('close', finalize);
    next();
  };
}

function createGlobalRateLimitMiddleware({
  store = new Map(),
  windowMs = 60_000,
  maxRequests = 1000,
  isLoopbackIpFn,
  nowFn = () => Date.now(),
} = {}) {
  return function globalRateLimitMiddleware(req, res, next) {
    const ip = req.ip;
    if (isLoopbackIpFn?.(ip)) {
      next();
      return;
    }

    const now = nowFn();
    const entry = store.get(ip);
    if (entry && now < entry.resetTime) {
      if (entry.count >= maxRequests) {
        res.status(429).json({ error: 'Too many requests. Try again later.' });
        return;
      }
      entry.count += 1;
      next();
      return;
    }

    store.set(ip, { count: 1, resetTime: now + windowMs });
    next();
  };
}

function pruneRateLimitStore(store, now = Date.now()) {
  for (const [ip, entry] of store) {
    if (now >= entry.resetTime) {
      store.delete(ip);
    }
  }
}

function scheduleRateLimitCleanup({
  store,
  setIntervalFn = setInterval,
  nowFn = () => Date.now(),
  cleanupIntervalMs = 120_000,
} = {}) {
  return setIntervalFn(() => {
    pruneRateLimitStore(store, nowFn());
  }, cleanupIntervalMs);
}

function createHttpRedirectServer({
  httpsEnabled,
  httpRedirectPort,
  appPort,
  httpModule = http,
} = {}) {
  if (!httpsEnabled || !httpRedirectPort || Number(httpRedirectPort) === Number(appPort)) {
    return null;
  }

  return httpModule.createServer((req, res) => {
    const hostHeader = req.headers.host || 'localhost';
    const redirectHost = Number(appPort) === 443
      ? hostHeader.replace(/:\d+$/, '')
      : hostHeader.replace(/:\d+$/, `:${appPort}`);
    res.writeHead(308, {
      Location: `https://${redirectHost}${req.url || '/'}`,
    });
    res.end();
  });
}

module.exports = {
  createRequestMetricsMiddleware,
  createGlobalRateLimitMiddleware,
  pruneRateLimitStore,
  scheduleRateLimitCleanup,
  createHttpRedirectServer,
};
