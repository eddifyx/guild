import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('messages debug surface effect delegates active decrypt snapshot registration to the dedicated runtime', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/useMessagesDebugSurfaceEffect.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/messageDecryptDiagnosticsRuntime\.mjs'/);
  assert.match(source, /useEffect\(/);
  assert.match(source, /installMessageDecryptDebugSurfaceFn\(/);
  assert.match(source, /buildActiveConversationDecryptSnapshotFn\(/);
});
