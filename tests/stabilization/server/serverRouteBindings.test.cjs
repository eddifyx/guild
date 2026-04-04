const test = require('node:test');
const assert = require('node:assert/strict');

const {
  attachApiRoutes,
  bindRealtimeProviders,
  bindRouteIo,
} = require('../../../server/src/startup/serverRouteBindings');

function createFakeApp() {
  const uses = [];
  return {
    app: {
      use(path, route) {
        uses.push([path, route]);
      },
    },
    uses,
  };
}

test('server route bindings attach canonical api route prefixes', () => {
  const { app, uses } = createFakeApp();
  const routes = {
    devDashboardRoutes: { name: 'dev' },
    authRoutes: { name: 'auth' },
    roomRoutes: { name: 'rooms' },
    messageRoutes: { name: 'messages' },
    userRoutes: { name: 'users' },
    uploadRoutes: { name: 'upload' },
    fileRoutes: { name: 'files' },
    dmRoutes: { name: 'dm' },
    voiceRoutes: { name: 'voice' },
    assetRoutes: { name: 'assets' },
    addonRoutes: { name: 'addons' },
    keyRoutes: { name: 'keys' },
    guildRoutes: { name: 'guilds' },
  };

  attachApiRoutes(app, routes);

  assert.deepEqual(
    uses.map(([path]) => path),
    [
      '/api/dev',
      '/api/auth',
      '/api/rooms',
      '/api/messages',
      '/api/users',
      '/api/upload',
      '/api/files',
      '/api/dm',
      '/api/voice',
      '/api/assets',
      '/api/addons',
      '/api/keys',
      '/api/guilds',
    ],
  );
});

test('server route bindings reuse setIO when available and fall back to route._io', () => {
  const withSetter = {
    seen: null,
    setIO(io) {
      this.seen = io;
    },
  };
  const withoutSetter = {};
  const io = { id: 'io' };

  bindRouteIo(withSetter, io);
  bindRouteIo(withoutSetter, io);

  assert.equal(withSetter.seen, io);
  assert.equal(withoutSetter._io, io);
});

test('server route bindings wire online-provider and io-backed routes together', () => {
  const io = { id: 'io' };
  const userRoutes = {
    provider: null,
    setOnlineProvider(fn) {
      this.provider = fn;
    },
  };
  const roomRoutes = {};
  const voiceRoutes = {};
  const assetRoutes = {};
  const addonRoutes = {};
  const guildRoutes = {};
  const getOnlineUserIds = () => ['user-1'];

  bindRealtimeProviders({
    io,
    getOnlineUserIds,
    userRoutes,
    roomRoutes,
    voiceRoutes,
    assetRoutes,
    addonRoutes,
    guildRoutes,
  });

  assert.equal(userRoutes.provider, getOnlineUserIds);
  assert.equal(userRoutes._io, io);
  assert.equal(roomRoutes._io, io);
  assert.equal(voiceRoutes._io, io);
  assert.equal(assetRoutes._io, io);
  assert.equal(addonRoutes._io, io);
  assert.equal(guildRoutes._io, io);
});
