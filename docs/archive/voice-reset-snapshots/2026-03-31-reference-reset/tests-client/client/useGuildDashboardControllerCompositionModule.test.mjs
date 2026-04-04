import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild dashboard controller composition owns effect wiring and action handlers', async () => {
  const compositionSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildDashboardControllerComposition.mjs', import.meta.url),
    'utf8'
  );
  const actionsSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildDashboardControllerActions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(compositionSource, /function useGuildDashboardControllerComposition\(/);
  assert.match(compositionSource, /useGuildDashboardControllerEffects\(/);
  assert.match(compositionSource, /useGuildDashboardControllerActions\(/);
  assert.doesNotMatch(compositionSource, /buildGuildDashboardStatusSubmit\(/);
  assert.doesNotMatch(compositionSource, /buildGuildDashboardStatusPopover\(/);
  assert.doesNotMatch(compositionSource, /buildGuildDashboardProfileCardPayload\(/);
  assert.doesNotMatch(compositionSource, /socket\?\.emit\('status:update'/);
  assert.match(actionsSource, /useGuildDashboardControllerStatusActions\(/);
  assert.match(actionsSource, /useGuildDashboardControllerRosterActions\(/);
  assert.doesNotMatch(actionsSource, /buildGuildDashboardStatusSubmit\(/);
  assert.doesNotMatch(actionsSource, /buildGuildDashboardStatusPopover\(/);
  assert.doesNotMatch(actionsSource, /buildGuildDashboardProfileCardPayload\(/);
  assert.doesNotMatch(actionsSource, /socket\?\.emit\('status:update'/);
});
