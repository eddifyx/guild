import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('stream view panels delegate HUD and shell rendering to dedicated stream modules', async () => {
  const panelsSource = await readFile(
    new URL('../../../client/src/components/Stream/StreamViewPanels.jsx', import.meta.url),
    'utf8'
  );
  const hudSource = await readFile(
    new URL('../../../client/src/components/Stream/StreamDebugHudView.jsx', import.meta.url),
    'utf8'
  );
  const shellSource = await readFile(
    new URL('../../../client/src/components/Stream/StreamShellViews.jsx', import.meta.url),
    'utf8'
  );

  assert.match(panelsSource, /from '\.\/StreamDebugHudView\.jsx'/);
  assert.match(panelsSource, /from '\.\/StreamShellViews\.jsx'/);
  assert.match(hudSource, /export function StreamDebugHud/);
  assert.match(shellSource, /export function StreamVideo/);
  assert.match(shellSource, /export function NoStreamPlaceholder/);
  assert.match(shellSource, /export function StreamShell/);
});
