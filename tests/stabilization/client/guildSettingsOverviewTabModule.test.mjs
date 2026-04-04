import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild settings overview tab delegates read-only and edit rendering to dedicated modules', async () => {
  const overviewTabSource = await readFile(
    new URL('../../../client/src/components/Guild/GuildSettingsOverviewTab.jsx', import.meta.url),
    'utf8'
  );
  const readOnlySource = await readFile(
    new URL('../../../client/src/components/Guild/GuildSettingsOverviewReadOnlyView.jsx', import.meta.url),
    'utf8'
  );
  const editSource = await readFile(
    new URL('../../../client/src/components/Guild/GuildSettingsOverviewEditView.jsx', import.meta.url),
    'utf8'
  );

  assert.match(overviewTabSource, /from '\.\/GuildSettingsOverviewReadOnlyView\.jsx'/);
  assert.match(overviewTabSource, /from '\.\/GuildSettingsOverviewEditView\.jsx'/);
  assert.match(readOnlySource, /export function GuildSettingsOverviewReadOnlyView/);
  assert.match(editSource, /export function GuildSettingsOverviewEditView/);
});
