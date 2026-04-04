import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild dashboard controller effects own member loading, focus, roster sync, and guild reset wiring', async () => {
  const effectsSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildDashboardControllerEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(effectsSource, /function useGuildDashboardControllerEffects\(/);
  assert.match(effectsSource, /fetchMembers\(currentGuild\)\.then\(setMembers\)/);
  assert.match(effectsSource, /onlineUsers\.find/);
  assert.match(effectsSource, /statusInputRef\.current\.focus\(\)/);
  assert.match(effectsSource, /onRosterViewChange\?\.\(isRosterExpanded\)/);
  assert.match(effectsSource, /setShowExpandedRoster\(false\)/);
  assert.match(effectsSource, /setGuildImgFailed\(false\)/);
});
