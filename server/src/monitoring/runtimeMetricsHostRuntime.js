function toMs(nanoseconds) {
  if (!Number.isFinite(nanoseconds)) return null;
  return nanoseconds / 1e6;
}

function readDiskUsage(targetPath, {
  statfsSyncFn,
  onError = null,
} = {}) {
  if (typeof statfsSyncFn !== 'function') return null;

  try {
    const stats = statfsSyncFn(targetPath);
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    const usedBytes = totalBytes - freeBytes;

    return {
      path: targetPath,
      totalBytes,
      freeBytes,
      usedBytes,
      usedPct: totalBytes > 0 ? usedBytes / totalBytes : 0,
    };
  } catch (error) {
    onError?.(error);
    return null;
  }
}

function summarizeNetworkInterfaces({
  networkInterfacesFn,
} = {}) {
  const interfaces = networkInterfacesFn?.() || {};
  const results = [];

  for (const [name, entries] of Object.entries(interfaces)) {
    for (const entry of entries || []) {
      if (!entry) continue;
      results.push({
        name,
        family: entry.family,
        address: entry.address,
        cidr: entry.cidr || null,
        internal: !!entry.internal,
        mac: entry.mac || null,
      });
    }
  }

  return results;
}

function buildHostSnapshot({
  osModule,
  processMemory,
  diskProbePath,
  safePctFn,
  readDiskUsageFn = readDiskUsage,
  summarizeNetworkInterfacesFn = summarizeNetworkInterfaces,
  onDiskError = null,
}) {
  const hostMemoryTotal = osModule.totalmem();
  const hostMemoryFree = osModule.freemem();
  const hostMemoryUsed = hostMemoryTotal - hostMemoryFree;
  const disk = readDiskUsageFn(diskProbePath, {
    statfsSyncFn: osModule?.statfsSync || null,
    onError: onDiskError,
  });

  return {
    host: {
      hostname: osModule.hostname(),
      platform: osModule.platform(),
      release: osModule.release(),
      arch: osModule.arch(),
      uptimeSec: osModule.uptime(),
      loadAverage: osModule.loadavg(),
      cpus: osModule.cpus().length,
      memory: {
        totalBytes: hostMemoryTotal,
        freeBytes: hostMemoryFree,
        usedBytes: hostMemoryUsed,
        usedPct: safePctFn(hostMemoryUsed, hostMemoryTotal),
      },
      disk,
      networkInterfaces: summarizeNetworkInterfacesFn({
        networkInterfacesFn: () => osModule.networkInterfaces(),
      }),
    },
    hostMemoryTotal,
  };
}

function buildProcessSnapshot({
  processObj = process,
  processMemory,
  hostMemoryTotal,
  eventLoopHistogram,
  safePctFn,
  toMsFn = toMs,
}) {
  return {
    pid: processObj.pid,
    node: processObj.version,
    uptimeSec: processObj.uptime(),
    memory: {
      rssBytes: processMemory.rss,
      heapTotalBytes: processMemory.heapTotal,
      heapUsedBytes: processMemory.heapUsed,
      externalBytes: processMemory.external,
      arrayBuffersBytes: processMemory.arrayBuffers,
      rssPctOfHost: safePctFn(processMemory.rss, hostMemoryTotal),
    },
    eventLoopDelayMs: {
      mean: toMsFn(eventLoopHistogram.mean) || 0,
      p50: toMsFn(eventLoopHistogram.percentile(50)) || 0,
      p95: toMsFn(eventLoopHistogram.percentile(95)) || 0,
      max: toMsFn(eventLoopHistogram.max) || 0,
    },
  };
}

module.exports = {
  toMs,
  readDiskUsage,
  summarizeNetworkInterfaces,
  buildHostSnapshot,
  buildProcessSnapshot,
};
