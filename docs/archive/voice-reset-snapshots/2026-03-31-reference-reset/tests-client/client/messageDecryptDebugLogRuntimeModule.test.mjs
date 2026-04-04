import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message decrypt debug log runtime owns sanitized Electron debug-log bridging for decrypt diagnostics', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageDecryptDebugLogRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /LANE_DIAGNOSTIC_EVENT_NAME/);
  assert.match(source, /electronAPI\.debugLog/);
  assert.match(source, /entry\?\.lane !== 'message-decrypt'/);
  assert.match(source, /buildMessageDecryptDebugLogPayload/);
});
