import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild chat dock controller delegates local state ownership to a dedicated state hook', async () => {
  const controllerSource = await readFile(
    new URL('../../../client/src/features/messaging/useGuildChatDockController.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/messaging/useGuildChatDockControllerState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerSource, /from '\.\/useGuildChatDockControllerState\.mjs'/);
  assert.match(controllerSource, /useGuildChatDockControllerState\(/);
  assert.doesNotMatch(controllerSource, /const \[draft, setDraft\] = useState\(/);
  assert.doesNotMatch(controllerSource, /const feedRef = useRef\(/);

  assert.match(stateSource, /function useGuildChatDockControllerState\(/);
  assert.match(stateSource, /const \[draft, setDraft\] = useState\(''\)/);
  assert.match(stateSource, /const \[pendingFiles, setPendingFiles\] = useState\(\[\]\)/);
  assert.match(stateSource, /const feedRef = useRef\(null\)/);
  assert.match(stateSource, /pendingFilesRef\.current = pendingFiles/);
});
