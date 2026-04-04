const test = require('node:test');
const assert = require('node:assert/strict');

const {
  loadTlsOptions,
  readClientVersion,
  normalizePlatform,
  resolveVersionInfoForPlatform,
  getRequestProtocol,
  buildHttpsRedirectUrl,
  isAllowedOrigin,
  isLoopbackIp,
  canAccessUploadedFile,
  buildAbsoluteUrl,
  buildUpdateDownloads,
  resolveUpdateDelivery,
} = require('../../../server/src/startup/serverRuntimeModel');

function createRequest({
  host = 'guild.test',
  forwardedHost = null,
  forwardedProto = null,
  secure = false,
  encrypted = false,
  url = '/api/version',
} = {}) {
  return {
    secure,
    socket: { encrypted },
    url,
    get(header) {
      if (header === 'host') return host;
      if (header === 'x-forwarded-host') return forwardedHost;
      if (header === 'x-forwarded-proto') return forwardedProto;
      return undefined;
    },
  };
}

test('server runtime model loads tls options and client version metadata through injected fs contracts', () => {
  const reads = [];
  const tls = loadTlsOptions({
    keyPath: '/tls/key.pem',
    certPath: '/tls/cert.pem',
    caPath: '/tls/ca.pem',
    readFileSyncFn: (filePath) => {
      reads.push(filePath);
      return `file:${filePath}`;
    },
  });
  assert.deepEqual(tls, {
    key: 'file:/tls/key.pem',
    cert: 'file:/tls/cert.pem',
    ca: 'file:/tls/ca.pem',
  });
  assert.deepEqual(reads, ['/tls/key.pem', '/tls/cert.pem', '/tls/ca.pem']);

  const versionInfo = readClientVersion({
    clientVersionPath: '/tmp/client-version.json',
    readFileSyncFn: () => JSON.stringify({ version: '1.2.3' }),
  });
  assert.deepEqual(versionInfo, { version: '1.2.3' });
  assert.deepEqual(
    readClientVersion({
      clientVersionPath: '/tmp/missing.json',
      readFileSyncFn: () => { throw new Error('missing'); },
    }),
    { version: '0.0.0' },
  );
});

test('server runtime model normalizes platforms, version overrides, protocols, and redirect urls', () => {
  assert.equal(normalizePlatform('macOS'), 'darwin-arm64');
  assert.equal(normalizePlatform('windows'), 'win32-x64');
  assert.equal(normalizePlatform('linux-x64'), 'linux-x64');

  assert.deepEqual(
    resolveVersionInfoForPlatform({
      version: '1.0.0',
      notes: 'base',
      platformOverrides: {
        'win32-x64': { version: '1.0.1', notes: 'windows' },
      },
    }, 'windows'),
    { version: '1.0.1', notes: 'windows' },
  );

  const req = createRequest({
    host: 'guild.test:3001',
    forwardedHost: 'prod.guild.test:80',
    forwardedProto: 'https,http',
    url: '/download',
  });
  assert.equal(getRequestProtocol(req), 'https');
  assert.equal(buildAbsoluteUrl(req, '/updates/file.zip'), 'https://guild.test:3001/updates/file.zip');
  assert.equal(buildHttpsRedirectUrl(req, {
    httpRedirectPort: 80,
    appPort: 443,
  }), 'https://prod.guild.test/download');
});

test('server runtime model enforces allowed origins, loopback detection, and upload access policy', () => {
  assert.equal(isAllowedOrigin(undefined, { allowedOrigins: [] }), true);
  assert.equal(isAllowedOrigin('https://localhost:5173', { allowedOrigins: [] }), true);
  assert.equal(isAllowedOrigin('app://guild', { allowedOrigins: [] }), true);
  assert.equal(isAllowedOrigin('https://prod.guild.test', { allowedOrigins: ['https://prod.guild.test'] }), true);
  assert.equal(isAllowedOrigin('https://evil.test', { allowedOrigins: [] }), false);

  assert.equal(isLoopbackIp('127.0.0.1'), true);
  assert.equal(isLoopbackIp('::ffff:127.0.0.1'), true);
  assert.equal(isLoopbackIp('10.0.0.5'), false);

  assert.equal(canAccessUploadedFile({
    uploaded_by: 'user-1',
    message_id: 'msg-1',
  }, 'user-1'), true);
  assert.equal(canAccessUploadedFile({
    uploaded_by: 'user-2',
    message_id: 'msg-2',
    room_id: 'room-1',
  }, 'user-1', {
    isRoomMemberFn: (roomId, userId) => roomId === 'room-1' && userId === 'user-1',
  }), true);
  assert.equal(canAccessUploadedFile({
    uploaded_by: 'user-2',
    message_id: 'msg-3',
    dm_user_a: 'user-1',
    dm_user_b: 'user-2',
  }, 'user-1', {
    usersShareGuildFn: (userA, userB) => userA === 'user-1' && userB === 'user-2',
  }), true);
  assert.equal(canAccessUploadedFile({
    uploaded_by: 'user-2',
    message_id: 'msg-4',
    dm_user_a: 'user-2',
    dm_user_b: 'user-3',
  }, 'user-1', {
    usersShareGuildFn: () => true,
  }), false);
});

test('server runtime model builds download urls and update delivery policy from published artifacts', () => {
  const req = createRequest({
    host: 'guild.test',
    forwardedProto: 'https',
  });
  const downloads = buildUpdateDownloads(req, '1.2.3', {
    updatesDir: '/updates-root',
    existsSyncFn: (absolutePath) => absolutePath.endsWith('guild-darwin-arm64-1.2.3.zip')
      || absolutePath.endsWith('guild-win32-x64-1.2.3.zip'),
  });

  assert.deepEqual(downloads, {
    'darwin-arm64': {
      label: 'Mac Apple Silicon',
      installerUrl: null,
      archiveUrl: 'https://guild.test/updates/guild-darwin-arm64-1.2.3.zip',
    },
    'win32-x64': {
      label: 'Windows 10 x64',
      installerUrl: 'https://guild.test/updates/guild-win32-x64-1.2.3.zip',
      archiveUrl: 'https://guild.test/updates/guild-win32-x64-1.2.3.zip',
    },
  });

  assert.deepEqual(resolveUpdateDelivery('darwin-arm64', downloads), {
    updateStrategy: 'native',
    manualInstallReason: null,
  });
  assert.deepEqual(resolveUpdateDelivery('linux-x64', downloads), {
    updateStrategy: 'manual-install',
    manualInstallReason: 'Direct download is required until an auto-update archive is published for this platform.',
  });
});
