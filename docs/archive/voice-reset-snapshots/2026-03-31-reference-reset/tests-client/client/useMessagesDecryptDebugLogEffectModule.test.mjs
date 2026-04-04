import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('messages decrypt debug-log effect delegates Electron bridge registration to the dedicated runtime', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/useMessagesDecryptDebugLogEffect.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/messageDecryptDebugLogRuntime\.mjs'/);
  assert.match(source, /useEffect\(/);
  assert.match(source, /installMessageDecryptDebugLogBridgeFn\(/);
});
