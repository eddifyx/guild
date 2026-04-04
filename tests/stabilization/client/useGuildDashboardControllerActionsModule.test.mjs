import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild dashboard controller actions delegate status and roster interactions to dedicated owners', async () => {
  const actionsSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildDashboardControllerActions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(actionsSource, /function useGuildDashboardControllerActions\(/);
  assert.match(actionsSource, /from '\.\/useGuildDashboardControllerStatusActions\.mjs'/);
  assert.match(actionsSource, /from '\.\/useGuildDashboardControllerRosterActions\.mjs'/);
  assert.match(actionsSource, /useGuildDashboardControllerStatusActions\(/);
  assert.match(actionsSource, /useGuildDashboardControllerRosterActions\(/);
  assert.doesNotMatch(actionsSource, /buildGuildDashboardStatusSubmit\(/);
  assert.doesNotMatch(actionsSource, /buildGuildDashboardStatusPopover\(/);
  assert.doesNotMatch(actionsSource, /buildGuildDashboardProfileCardPayload\(/);
  assert.doesNotMatch(actionsSource, /socket\?\.emit\('status:update'/);
});
