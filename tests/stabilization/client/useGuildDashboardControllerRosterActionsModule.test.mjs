import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild dashboard roster actions own roster toggles, about/profile cards, and dm selection', async () => {
  const rosterActionsSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildDashboardControllerRosterActions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(rosterActionsSource, /function useGuildDashboardControllerRosterActions\(/);
  assert.match(rosterActionsSource, /buildGuildDashboardProfileCardPayload\(/);
  assert.match(rosterActionsSource, /other_user_id/);
  assert.match(rosterActionsSource, /setShowExpandedRoster/);
  assert.match(rosterActionsSource, /setShowAbout/);
  assert.doesNotMatch(rosterActionsSource, /buildGuildDashboardStatusSubmit\(/);
  assert.doesNotMatch(rosterActionsSource, /buildGuildDashboardStatusPopover\(/);
  assert.doesNotMatch(rosterActionsSource, /socket\?\.emit\('status:update'/);
});
