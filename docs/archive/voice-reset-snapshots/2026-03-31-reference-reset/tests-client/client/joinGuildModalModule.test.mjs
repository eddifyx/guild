import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('join guild modal delegates browse and invite rendering to dedicated guild modules', async () => {
  const modalSource = await readFile(
    new URL('../../../client/src/components/Guild/JoinGuildModal.jsx', import.meta.url),
    'utf8'
  );
  const browseSource = await readFile(
    new URL('../../../client/src/components/Guild/JoinGuildBrowsePanel.jsx', import.meta.url),
    'utf8'
  );
  const inviteSource = await readFile(
    new URL('../../../client/src/components/Guild/JoinGuildInvitePanel.jsx', import.meta.url),
    'utf8'
  );

  assert.match(modalSource, /from '\.\/JoinGuildBrowsePanel\.jsx'/);
  assert.match(modalSource, /from '\.\/JoinGuildInvitePanel\.jsx'/);
  assert.match(browseSource, /export function JoinGuildBrowsePanel/);
  assert.match(inviteSource, /export function JoinGuildInvitePanel/);
});
