const test = require('node:test');
const assert = require('node:assert/strict');

const {
  toMs,
  readDiskUsage,
  summarizeNetworkInterfaces,
  buildHostSnapshot,
  buildProcessSnapshot,
} = require('../../../server/src/monitoring/runtimeMetricsHostRuntime');

test('runtime metrics host runtime converts nanoseconds and reads disk usage safely', () => {
  assert.equal(toMs(2_500_000), 2.5);
  assert.equal(toMs(Number.NaN), null);

  assert.deepEqual(readDiskUsage('/srv', {
    statfsSyncFn: () => ({
      blocks: 10,
      bsize: 100,
      bavail: 3,
    }),
  }), {
    path: '/srv',
    totalBytes: 1000,
    freeBytes: 300,
    usedBytes: 700,
    usedPct: 0.7,
  });

  let warned = null;
  assert.equal(readDiskUsage('/srv', {
    statfsSyncFn: () => { throw new Error('boom'); },
    onError: (error) => { warned = error.message; },
  }), null);
  assert.equal(warned, 'boom');
});

test('runtime metrics host runtime summarizes network interfaces and host/process snapshots', () => {
  const interfaces = summarizeNetworkInterfaces({
    networkInterfacesFn: () => ({
      lo0: [{ family: 'IPv4', address: '127.0.0.1', cidr: '127.0.0.1/8', internal: true, mac: '00' }],
      en0: [{ family: 'IPv4', address: '10.0.0.5', cidr: '10.0.0.5/24', internal: false, mac: '11' }],
    }),
  });
  assert.deepEqual(interfaces, [
    { name: 'lo0', family: 'IPv4', address: '127.0.0.1', cidr: '127.0.0.1/8', internal: true, mac: '00' },
    { name: 'en0', family: 'IPv4', address: '10.0.0.5', cidr: '10.0.0.5/24', internal: false, mac: '11' },
  ]);

  const processMemory = {
    rss: 200,
    heapTotal: 100,
    heapUsed: 50,
    external: 10,
    arrayBuffers: 5,
  };
  const osModule = {
    totalmem: () => 1000,
    freemem: () => 250,
    hostname: () => 'guild-host',
    platform: () => 'linux',
    release: () => '6.0',
    arch: () => 'x64',
    uptime: () => 42,
    loadavg: () => [0.1, 0.2, 0.3],
    cpus: () => [{}, {}],
    networkInterfaces: () => ({ en0: [{ family: 'IPv4', address: '10.0.0.5', internal: false, mac: '11' }] }),
  };

  const { host, hostMemoryTotal } = buildHostSnapshot({
    osModule,
    processMemory,
    diskProbePath: '/srv',
    safePctFn: (used, total) => used / total,
    readDiskUsageFn: () => ({ path: '/srv', totalBytes: 1000, freeBytes: 100, usedBytes: 900, usedPct: 0.9 }),
  });

  assert.equal(host.hostname, 'guild-host');
  assert.equal(host.memory.usedPct, 0.75);
  assert.equal(host.disk.usedPct, 0.9);
  assert.equal(host.networkInterfaces.length, 1);
  assert.equal(hostMemoryTotal, 1000);

  const processStats = buildProcessSnapshot({
    processObj: {
      pid: 123,
      version: 'v22',
      uptime: () => 84,
    },
    processMemory,
    hostMemoryTotal,
    eventLoopHistogram: {
      mean: 2_000_000,
      max: 8_000_000,
      percentile: (value) => (value === 50 ? 3_000_000 : 6_000_000),
    },
    safePctFn: (used, total) => used / total,
  });

  assert.equal(processStats.pid, 123);
  assert.equal(processStats.memory.rssPctOfHost, 0.2);
  assert.deepEqual(processStats.eventLoopDelayMs, {
    mean: 2,
    p50: 3,
    p95: 6,
    max: 8,
  });
});
