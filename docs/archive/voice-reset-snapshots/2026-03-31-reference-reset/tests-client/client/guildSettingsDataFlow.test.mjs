import test from 'node:test';
import assert from 'node:assert/strict';

import {
  loadGuildSettingsResource,
  selectGuildSettingsTab,
} from '../../../client/src/features/guild/guildSettingsDataFlow.mjs';

test('guild settings data flow loads a resource once and respects the shared loading gate', async () => {
  const loadingRef = { current: { members: false } };
  const calls = [];
  let committed = null;

  const first = await loadGuildSettingsResource({
    currentGuild: 'guild-1',
    loadingRef,
    loadingKey: 'members',
    fetchFn: async (guildId) => {
      calls.push(guildId);
      return ['member-1'];
    },
    commitFn: (value) => {
      committed = value;
    },
    emptyValue: [],
  });

  const second = await loadGuildSettingsResource({
    currentGuild: 'guild-1',
    isLoaded: true,
    loadingRef,
    loadingKey: 'members',
    fetchFn: async () => {
      calls.push('unexpected');
      return [];
    },
    commitFn: () => {},
    emptyValue: [],
  });

  assert.deepEqual(first, ['member-1']);
  assert.deepEqual(second, []);
  assert.deepEqual(calls, ['guild-1']);
  assert.deepEqual(committed, ['member-1']);
  assert.equal(loadingRef.current.members, false);
});

test('guild settings data flow switches tabs through the shared perf-traced transition', () => {
  const calls = [];

  const traceId = selectGuildSettingsTab({
    currentTab: 'Overview',
    nextTab: 'Members',
    startPerfTraceFn: (...args) => {
      calls.push(['start', ...args]);
      return 'trace-1';
    },
    startTabTransitionFn: (callback) => {
      calls.push(['transition']);
      callback();
    },
    setTabFn: (value) => {
      calls.push(['set', value]);
    },
    endPerfTraceAfterNextPaintFn: (...args) => {
      calls.push(['end', ...args]);
    },
  });

  assert.equal(traceId, 'trace-1');
  assert.deepEqual(calls, [
    ['start', 'guild-settings-tab-switch', { fromTab: 'Overview', toTab: 'Members', surface: 'guild-settings' }],
    ['transition'],
    ['set', 'Members'],
    ['end', 'trace-1', { status: 'ready', surface: 'guild-settings', tab: 'Members' }],
  ]);

  assert.equal(selectGuildSettingsTab({
    currentTab: 'Members',
    nextTab: 'Members',
  }), null);
});
