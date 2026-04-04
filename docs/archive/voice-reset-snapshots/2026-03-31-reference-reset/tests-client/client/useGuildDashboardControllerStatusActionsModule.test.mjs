import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild dashboard status actions own status editing, submission, and popover handlers', async () => {
  const statusActionsSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildDashboardControllerStatusActions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(statusActionsSource, /function useGuildDashboardControllerStatusActions\(/);
  assert.match(statusActionsSource, /buildGuildDashboardStatusSubmit\(/);
  assert.match(statusActionsSource, /buildGuildDashboardStatusPopover\(/);
  assert.match(statusActionsSource, /socket\?\.emit\('status:update'/);
  assert.doesNotMatch(statusActionsSource, /buildGuildDashboardProfileCardPayload\(/);
  assert.doesNotMatch(statusActionsSource, /other_user_id/);
});
