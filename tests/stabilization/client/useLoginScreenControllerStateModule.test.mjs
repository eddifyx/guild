import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('login screen controller delegates local state ownership to a dedicated state hook', async () => {
  const controllerSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenController.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenControllerState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerSource, /from '\.\/useLoginScreenControllerState\.mjs'/);
  assert.match(controllerSource, /useLoginScreenControllerState\(/);
  assert.doesNotMatch(controllerSource, /const \[view, setView\] = useState\(/);
  assert.doesNotMatch(controllerSource, /const abortRef = useRef\(/);

  assert.match(stateSource, /function useLoginScreenControllerState\(/);
  assert.match(stateSource, /const abortRef = useRef\(null\)/);
  assert.match(stateSource, /const createImageInputRef = useRef\(null\)/);
  assert.match(stateSource, /const \[view, setView\] = useState\('welcome'\)/);
  assert.match(stateSource, /const \[server, setServer\] = useState\(getServerUrl\(\)\)/);
});
