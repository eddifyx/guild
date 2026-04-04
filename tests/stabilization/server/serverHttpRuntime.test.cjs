const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const {
  createRequestMetricsMiddleware,
  createGlobalRateLimitMiddleware,
  pruneRateLimitStore,
  scheduleRateLimitCleanup,
  createHttpRedirectServer,
} = require('../../../server/src/startup/serverHttpRuntime');

test('server http runtime records request metrics once and skips dev dashboard requests', () => {
  const calls = [];
  let clock = 0n;
  const runtimeMetrics = {
    beginHttpRequest() {
      calls.push(['begin']);
    },
    endHttpRequest(payload) {
      calls.push(['end', payload]);
    },
  };
  const middleware = createRequestMetricsMiddleware(runtimeMetrics, {
    timeSourceFn: () => {
      clock += 10_000_000n;
      return clock;
    },
  });

  const req = { method: 'GET', originalUrl: '/api/messages', url: '/api/messages' };
  const res = new EventEmitter();
  res.statusCode = 200;
  let nextCalled = 0;

  middleware(req, res, () => { nextCalled += 1; });
  res.emit('finish');
  res.emit('close');

  assert.equal(nextCalled, 1);
  assert.deepEqual(calls[0], ['begin']);
  assert.equal(calls[1][0], 'end');
  assert.equal(calls[1][1].url, '/api/messages');
  assert.equal(calls[1][1].statusCode, 200);
  assert.equal(calls[1][1].durationMs, 10);

  const skippedCalls = [];
  createRequestMetricsMiddleware({
    beginHttpRequest() { skippedCalls.push('begin'); },
    endHttpRequest() { skippedCalls.push('end'); },
  })(
    { method: 'GET', originalUrl: '/api/dev/metrics', url: '/api/dev/metrics' },
    new EventEmitter(),
    () => { skippedCalls.push('next'); },
  );
  assert.deepEqual(skippedCalls, ['next']);
});

test('server http runtime enforces the shared global rate-limit policy and prunes expired entries', () => {
  const store = new Map();
  let now = 1_000;
  const middleware = createGlobalRateLimitMiddleware({
    store,
    windowMs: 100,
    maxRequests: 2,
    isLoopbackIpFn: (ip) => ip === '127.0.0.1',
    nowFn: () => now,
  });

  const allowReq = { ip: '10.0.0.5' };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
    },
  };
  let nextCount = 0;

  middleware(allowReq, res, () => { nextCount += 1; });
  middleware(allowReq, res, () => { nextCount += 1; });
  middleware(allowReq, res, () => { nextCount += 1; });

  assert.equal(nextCount, 2);
  assert.equal(res.statusCode, 429);
  assert.deepEqual(res.payload, { error: 'Too many requests. Try again later.' });

  middleware({ ip: '127.0.0.1' }, res, () => { nextCount += 1; });
  assert.equal(nextCount, 3);

  now = 1_200;
  pruneRateLimitStore(store, now);
  assert.equal(store.size, 0);
});

test('server http runtime schedules rate-limit cleanup and builds redirect servers canonically', async () => {
  const store = new Map([
    ['10.0.0.5', { count: 3, resetTime: 900 }],
  ]);
  const intervals = [];
  scheduleRateLimitCleanup({
    store,
    nowFn: () => 1_000,
    setIntervalFn: (handler, intervalMs) => {
      intervals.push(intervalMs);
      handler();
      return { intervalMs };
    },
  });
  assert.deepEqual(intervals, [120_000]);
  assert.equal(store.size, 0);

  assert.equal(createHttpRedirectServer({
    httpsEnabled: false,
    httpRedirectPort: 80,
    appPort: 443,
  }), null);

  let listener = null;
  const redirectServer = createHttpRedirectServer({
    httpsEnabled: true,
    httpRedirectPort: 80,
    appPort: 443,
    httpModule: {
      createServer(fn) {
        listener = fn;
        return { listener: fn };
      },
    },
  });
  assert.ok(redirectServer);

  let redirected = null;
  await new Promise((resolve) => {
    listener(
      { headers: { host: 'guild.test:80' }, url: '/download' },
      {
        writeHead(statusCode, headers) {
          redirected = { statusCode, headers };
        },
        end() {
          resolve();
        },
      },
    );
  });

  assert.deepEqual(redirected, {
    statusCode: 308,
    headers: {
      Location: 'https://guild.test/download',
    },
  });
});
