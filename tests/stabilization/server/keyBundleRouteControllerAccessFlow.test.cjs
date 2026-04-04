const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createKeysRouteControllerAccessFlow,
} = require('../../../server/src/domain/keys/bundleRouteControllerAccessFlow');

test('bundle route controller access flow derives visibility from the canonical user visibility lists', () => {
  const access = createKeysRouteControllerAccessFlow({
    dbApi: {
      listVisibleGuildmateIds: {
        all: () => [{ user_id: 'user-2' }],
      },
      listVisibleContactUserIds: {
        all: () => [],
      },
    },
  });

  assert.equal(access.canRequesterAccessUserKeys('user-1', 'user-2'), true);
  assert.equal(access.canRequesterAccessUserKeys('user-1', 'user-9'), false);
});

test('bundle route controller access flow purges expired rate limits before consuming a request', () => {
  const bundleRateLimit = new Map([
    ['stale-bundle', { resetTime: 100 }],
  ]);
  const targetRateLimit = new Map([
    ['stale-target', { resetTime: 100 }],
  ]);
  const access = createKeysRouteControllerAccessFlow({
    dbApi: {
      listVisibleGuildmateIds: { all: () => [] },
      listVisibleContactUserIds: { all: () => [] },
    },
    nowFn: () => 1_000,
    bundleRateLimit,
    targetRateLimit,
    bundleMaxCount: 1,
    targetMaxCount: 1,
  });

  assert.deepEqual(access.consumeBundleAccess('user-a', 'user-b', null), { ok: true });
  assert.equal(bundleRateLimit.has('stale-bundle'), false);
  assert.equal(targetRateLimit.has('stale-target'), false);
});

test('bundle route controller access flow enforces bundle request limits with the canonical error shape', () => {
  const access = createKeysRouteControllerAccessFlow({
    dbApi: {
      listVisibleGuildmateIds: { all: () => [] },
      listVisibleContactUserIds: { all: () => [] },
    },
    bundleRateLimit: new Map(),
    targetRateLimit: new Map([
      ['user-b', { count: 1, resetTime: 5_000 }],
    ]),
    nowFn: () => 1_000,
    bundleMaxCount: 1,
    targetMaxCount: 1,
  });

  assert.deepEqual(access.consumeBundleAccess('user-a', 'user-b', null), {
    ok: false,
    status: 429,
    error: 'Too many bundle requests for this user. Try again later.',
  });
});
