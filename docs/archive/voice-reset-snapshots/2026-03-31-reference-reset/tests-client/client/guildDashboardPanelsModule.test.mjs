import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild dashboard panels delegate header and roster views to dedicated modules', async () => {
  const panelsSource = await readFile(
    new URL('../../../client/src/components/Guild/GuildDashboardPanels.jsx', import.meta.url),
    'utf8'
  );
  const headerViewsSource = await readFile(
    new URL('../../../client/src/components/Guild/GuildDashboardHeaderViews.jsx', import.meta.url),
    'utf8'
  );
  const rosterViewsSource = await readFile(
    new URL('../../../client/src/components/Guild/GuildDashboardRosterViews.jsx', import.meta.url),
    'utf8'
  );
  const dashboardSource = await readFile(
    new URL('../../../client/src/components/Guild/GuildDashboard.jsx', import.meta.url),
    'utf8'
  );

  assert.match(panelsSource, /from '\.\/GuildDashboardHeaderViews\.jsx'/);
  assert.match(panelsSource, /from '\.\/GuildDashboardRosterViews\.jsx'/);
  assert.match(headerViewsSource, /export function GuildDashboardHeader/);
  assert.match(headerViewsSource, /export function GuildDashboardAboutModal/);
  assert.match(rosterViewsSource, /export function GuildDashboardRosterSection/);
  assert.match(rosterViewsSource, /export function StatusPopover/);
  assert.match(dashboardSource, /from '\.\/GuildDashboardPanels\.jsx'/);
});
