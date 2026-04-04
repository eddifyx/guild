import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('main layout controller delegates local state and refs to a dedicated state hook', async () => {
  const controllerSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutController.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutControllerState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerSource, /from '\.\/useMainLayoutControllerState\.mjs'/);
  assert.match(controllerSource, /useMainLayoutControllerState\(/);
  assert.doesNotMatch(controllerSource, /const \[conversation, setConversation\] = useState\(/);
  assert.doesNotMatch(controllerSource, /const guildChatInitialFocusAppliedRef = useRef\(/);
  assert.match(stateSource, /function useMainLayoutControllerState\(/);
  assert.match(stateSource, /const \[conversation, setConversation\] = useState\(/);
  assert.match(stateSource, /const guildChatInitialFocusAppliedRef = useRef\(/);
});
