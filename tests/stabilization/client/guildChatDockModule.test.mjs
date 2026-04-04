import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild chat dock controller modules import cleanly and expose hook factories', async () => {
  const { useGuildChatDockControllerRuntime } = await import('../../../client/src/features/messaging/useGuildChatDockControllerRuntime.mjs');
  const { useGuildChatDockRuntimeEffects } = await import('../../../client/src/features/messaging/useGuildChatDockRuntimeEffects.mjs');
  assert.equal(typeof useGuildChatDockControllerRuntime, 'function');
  assert.equal(typeof useGuildChatDockRuntimeEffects, 'function');
});

test('guild chat dock gates hookful content behind a guild-state wrapper', async () => {
  const dockSource = await readFile(
    new URL('../../../client/src/components/GuildChat/GuildChatDock.jsx', import.meta.url),
    'utf8',
  );

  assert.match(
    dockSource,
    /function GuildChatDockContent[\s\S]*useLayoutEffect\([\s\S]*useEffect\([\s\S]*export default function GuildChatDock[\s\S]*if \(!currentGuildData\) return null;[\s\S]*<GuildChatDockContent/,
  );
});
