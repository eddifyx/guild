import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('chat view runtime delegates local state and refs to a dedicated state hook', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewRuntime.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewRuntimeState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /from '\.\/useChatViewRuntimeState\.mjs'/);
  assert.match(runtimeSource, /useChatViewRuntimeState\(/);
  assert.doesNotMatch(runtimeSource, /const \[keyChanged, setKeyChanged\] = useState\(/);
  assert.doesNotMatch(runtimeSource, /const bottomRef = useRef\(/);
  assert.doesNotMatch(runtimeSource, /const completedOpenTraceIdsRef = useRef\(/);

  assert.match(stateSource, /function useChatViewRuntimeState\(/);
  assert.match(stateSource, /const \[keyChanged, setKeyChanged\] = useState\(/);
  assert.match(stateSource, /const \[trustSaving, setTrustSaving\] = useState\(/);
  assert.match(stateSource, /const bottomRef = useRef\(/);
  assert.match(stateSource, /const completedOpenTraceIdsRef = useRef\(new Set\(\)\)/);
});
