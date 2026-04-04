const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRouterMediaCodecs,
  buildWebRtcTransportOptions,
  buildWorkerSettings,
  isPrivateIpv4,
  parseRtcPortRange,
  resolveAnnouncedIp,
  resolveTargetWorkerCount,
} = require('../../../server/src/domain/voice/voiceConfig');

test('voice config resolves announced ip from explicit, private, public, and fallback candidates', () => {
  assert.equal(resolveAnnouncedIp({ announcedIp: '203.0.113.10' }), '203.0.113.10');
  assert.equal(
    resolveAnnouncedIp({
      interfaces: {
        en0: [{ address: '192.168.1.20', family: 'IPv4', internal: false }],
      },
      nodeEnv: 'development',
    }),
    '127.0.0.1'
  );
  assert.equal(
    resolveAnnouncedIp({
      interfaces: {
        en0: [{ address: '192.168.1.20', family: 'IPv4', internal: false }],
        lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      },
      nodeEnv: 'production',
    }),
    '192.168.1.20'
  );
  assert.equal(
    resolveAnnouncedIp({
      interfaces: {
        en0: [{ address: '198.51.100.20', family: 'IPv4', internal: false }],
      },
      nodeEnv: 'production',
    }),
    '198.51.100.20'
  );
  assert.equal(resolveAnnouncedIp({ interfaces: {}, fallbackIp: '127.0.0.1' }), '127.0.0.1');
  assert.equal(
    resolveAnnouncedIp({
      interfaces: {
        en0: [{ address: '192.168.1.20', family: 'IPv4', internal: false }],
      },
      nodeEnv: 'development',
      preferLoopback: false,
    }),
    '192.168.1.20'
  );
  assert.equal(isPrivateIpv4('172.16.5.9'), true);
  assert.equal(isPrivateIpv4('203.0.113.9'), false);
});

test('voice config builds validated worker, transport, and codec settings', () => {
  assert.deepEqual(parseRtcPortRange({ minPort: 10000, maxPort: 10100 }), {
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  });
  assert.throws(
    () => parseRtcPortRange({ minPort: 20000, maxPort: 10000 }),
    /Invalid mediasoup RTP port range/
  );

  assert.deepEqual(buildWorkerSettings({ minPort: 12000, maxPort: 12100 }), {
    logLevel: 'warn',
    rtcMinPort: 12000,
    rtcMaxPort: 12100,
  });

  assert.deepEqual(
    buildWebRtcTransportOptions({
      announcedIp: '203.0.113.10',
      initialAvailableOutgoingBitrate: 2_000_000,
    }),
    {
      listenIps: [{ ip: '0.0.0.0', announcedIp: '203.0.113.10' }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 2_000_000,
    }
  );

  assert.deepEqual(
    buildRouterMediaCodecs({
      enableExperimentalScreenCodecs: true,
      enableExperimentalAv1: true,
    }).map((codec) => codec.mimeType),
    ['audio/opus', 'video/VP8', 'video/H264', 'video/AV1']
  );

  assert.equal(resolveTargetWorkerCount({ cpuCount: 8 }), 2);
  assert.equal(resolveTargetWorkerCount({ cpuCount: 1 }), 1);
});
