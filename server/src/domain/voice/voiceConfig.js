const os = require('os');

function isPrivateIpv4(address) {
  if (typeof address !== 'string') return false;
  if (address.startsWith('10.')) return true;
  if (address.startsWith('192.168.')) return true;
  const match = address.match(/^172\.(\d+)\./);
  if (!match) return false;
  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function resolveAnnouncedIp({
  announcedIp = process.env.ANNOUNCED_IP,
  interfaces = os.networkInterfaces(),
  fallbackIp = '127.0.0.1',
  nodeEnv = process.env.NODE_ENV || 'development',
  preferLoopback = nodeEnv !== 'production'
    && process.env.MEDIASOUP_PREFER_NETWORK_ANNOUNCED_IP !== '1',
} = {}) {
  if (announcedIp) return announcedIp;
  if (preferLoopback) return fallbackIp;

  const candidates = [];
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (!entry || entry.internal || entry.family !== 'IPv4') continue;
      candidates.push(entry.address);
    }
  }

  const privateAddress = candidates.find(isPrivateIpv4);
  if (privateAddress) return privateAddress;
  if (candidates.length > 0) return candidates[0];
  return fallbackIp;
}

function parseRtcPortRange({
  minPort = process.env.MEDIASOUP_RTC_MIN_PORT || 10000,
  maxPort = process.env.MEDIASOUP_RTC_MAX_PORT || 10100,
} = {}) {
  const rtcMinPort = Number(minPort);
  const rtcMaxPort = Number(maxPort);

  if (
    !Number.isInteger(rtcMinPort)
    || !Number.isInteger(rtcMaxPort)
    || rtcMinPort <= 0
    || rtcMaxPort < rtcMinPort
  ) {
    throw new Error(`Invalid mediasoup RTP port range: ${rtcMinPort}-${rtcMaxPort}`);
  }

  return {
    rtcMinPort,
    rtcMaxPort,
  };
}

function buildWorkerSettings({ minPort, maxPort, logLevel = 'warn' } = {}) {
  const { rtcMinPort, rtcMaxPort } = parseRtcPortRange({ minPort, maxPort });
  return {
    logLevel,
    rtcMinPort,
    rtcMaxPort,
  };
}

function buildRouterMediaCodecs({
  enableExperimentalScreenCodecs = false,
  enableExperimentalAv1 = false,
} = {}) {
  const codecs = [
    {
      kind: 'audio',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
    },
    {
      kind: 'video',
      mimeType: 'video/VP8',
      clockRate: 90000,
    },
  ];

  if (enableExperimentalScreenCodecs) {
    codecs.push({
      kind: 'video',
      mimeType: 'video/H264',
      clockRate: 90000,
      parameters: {
        'level-asymmetry-allowed': 1,
        'packetization-mode': 1,
        'profile-level-id': '42e01f',
      },
    });
  }

  if (enableExperimentalScreenCodecs && enableExperimentalAv1) {
    codecs.push({
      kind: 'video',
      mimeType: 'video/AV1',
      clockRate: 90000,
      parameters: {},
    });
  }

  return codecs;
}

function buildWebRtcTransportOptions({
  announcedIp,
  initialAvailableOutgoingBitrate,
} = {}) {
  return {
    listenIps: [
      {
        ip: '0.0.0.0',
        announcedIp,
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate,
  };
}

function resolveTargetWorkerCount({
  cpuCount = os.cpus().length,
  maxWorkerCount = 2,
} = {}) {
  return Math.max(1, Math.min(cpuCount, maxWorkerCount));
}

module.exports = {
  buildRouterMediaCodecs,
  buildWebRtcTransportOptions,
  buildWorkerSettings,
  isPrivateIpv4,
  parseRtcPortRange,
  resolveAnnouncedIp,
  resolveTargetWorkerCount,
};
