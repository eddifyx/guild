import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('profile settings modal delegates panel rendering and styles to dedicated modules', async () => {
  const modalSource = await readFile(
    new URL('../../../client/src/components/Profile/ProfileSettingsModal.jsx', import.meta.url),
    'utf8'
  );
  const panelsSource = await readFile(
    new URL('../../../client/src/components/Profile/ProfileSettingsModalPanels.jsx', import.meta.url),
    'utf8'
  );
  const stylesSource = await readFile(
    new URL('../../../client/src/components/Profile/ProfileSettingsModalStyles.mjs', import.meta.url),
    'utf8'
  );

  assert.match(modalSource, /from '\.\/ProfileSettingsModalPanels\.jsx'/);
  assert.match(modalSource, /from '\.\/ProfileSettingsModalStyles\.mjs'/);
  assert.match(panelsSource, /export function ProfileSettingsHeader/);
  assert.match(panelsSource, /export function ProfileSettingsForm/);
  assert.match(stylesSource, /export const styles =/);
});
