import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('invite guild modal delegates tab and panel rendering to dedicated guild modules', async () => {
  const modalSource = await readFile(
    new URL('../../../client/src/components/Guild/InviteGuildModal.jsx', import.meta.url),
    'utf8'
  );
  const panelsSource = await readFile(
    new URL('../../../client/src/components/Guild/InviteGuildModalPanels.jsx', import.meta.url),
    'utf8'
  );

  assert.match(modalSource, /from '\.\/InviteGuildModalPanels\.jsx'/);
  assert.match(panelsSource, /export function InviteGuildModalTabs/);
  assert.match(panelsSource, /export function InviteGuildModalCodePanel/);
  assert.match(panelsSource, /export function InviteGuildModalNostrPanel/);
});
