import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild dashboard controller delegates roster, header, and status draft derivation to a dedicated view-state hook', async () => {
  const viewStateSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildDashboardControllerViewState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(viewStateSource, /function useGuildDashboardControllerViewState\(/);
  assert.match(viewStateSource, /enrichGuildDashboardMembers\(/);
  assert.match(viewStateSource, /buildGuildDashboardRosterState\(/);
  assert.match(viewStateSource, /buildGuildDashboardHeaderState\(/);
  assert.match(viewStateSource, /buildGuildDashboardStatusDraft\(/);
  assert.match(viewStateSource, /GUILD_DASHBOARD_STATUS_MAX_LENGTH/);
});
