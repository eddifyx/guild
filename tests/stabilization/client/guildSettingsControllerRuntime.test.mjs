import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createGuildSettingsFlash,
  createGuildSettingsResourceLoader,
} from '../../../client/src/features/guild/guildSettingsControllerRuntime.mjs';

test('guild settings controller runtime creates canonical resource loaders', async () => {
  const calls = [];
  const loadingRef = { current: { members: false } };
  let committed = null;

  const loadMembers = createGuildSettingsResourceLoader({
    currentGuild: 'guild-1',
    isLoaded: false,
    loadingRef,
    loadingKey: 'members',
    fetchFn: async (guildId) => {
      calls.push(['fetch', guildId]);
      return ['member-1'];
    },
    commitFn: (value) => {
      committed = value;
    },
    emptyValue: [],
  });

  const result = await loadMembers({ force: true });

  assert.deepEqual(result, ['member-1']);
  assert.deepEqual(committed, ['member-1']);
  assert.deepEqual(calls, [['fetch', 'guild-1']]);
  assert.equal(loadingRef.current.members, false);
});

test('guild settings controller runtime builds the shared flash handler', () => {
  const calls = [];
  const flash = createGuildSettingsFlash({
    setErrorFn: (value) => calls.push(['error', value]),
    setSuccessFn: (value) => calls.push(['success', value]),
    setTimeoutFn: (callback, delayMs) => {
      calls.push(['timeout', delayMs]);
      callback();
    },
    clearDelayMs: 1234,
  });

  flash('Saved', false);
  flash('Failed', true);

  assert.deepEqual(calls, [
    ['success', 'Saved'],
    ['error', ''],
    ['timeout', 1234],
    ['error', ''],
    ['success', ''],
    ['error', 'Failed'],
    ['success', ''],
    ['timeout', 1234],
    ['error', ''],
    ['success', ''],
  ]);
});
