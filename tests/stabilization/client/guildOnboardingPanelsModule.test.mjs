import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild onboarding panels delegate chrome, header, actions, discover, and confirmation rendering to dedicated modules', async () => {
  const panelsSource = await readFile(
    new URL('../../../client/src/components/Guild/GuildOnboardingPanels.jsx', import.meta.url),
    'utf8'
  );
  const chromeSource = await readFile(
    new URL('../../../client/src/components/Guild/GuildOnboardingChrome.jsx', import.meta.url),
    'utf8'
  );
  const headerSource = await readFile(
    new URL('../../../client/src/components/Guild/GuildOnboardingHeader.jsx', import.meta.url),
    'utf8'
  );
  const actionsSource = await readFile(
    new URL('../../../client/src/components/Guild/GuildOnboardingActions.jsx', import.meta.url),
    'utf8'
  );
  const discoverSource = await readFile(
    new URL('../../../client/src/components/Guild/GuildOnboardingDiscoverSection.jsx', import.meta.url),
    'utf8'
  );
  const confirmSource = await readFile(
    new URL('../../../client/src/components/Guild/GuildJoinConfirmationDialog.jsx', import.meta.url),
    'utf8'
  );

  assert.match(panelsSource, /from '\.\/GuildOnboardingChrome\.jsx'/);
  assert.match(panelsSource, /from '\.\/GuildOnboardingHeader\.jsx'/);
  assert.match(panelsSource, /from '\.\/GuildOnboardingActions\.jsx'/);
  assert.match(panelsSource, /from '\.\/GuildOnboardingDiscoverSection\.jsx'/);
  assert.match(panelsSource, /from '\.\/GuildJoinConfirmationDialog\.jsx'/);
  assert.match(chromeSource, /export function GuildOnboardingChrome/);
  assert.match(headerSource, /export function GuildOnboardingHeader/);
  assert.match(actionsSource, /export function GuildOnboardingActions/);
  assert.match(discoverSource, /export function GuildOnboardingDiscoverSection/);
  assert.match(confirmSource, /export function GuildJoinConfirmationDialog/);
});
