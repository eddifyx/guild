import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message decrypt diagnostics runtime owns sanitized debug surface shaping for messaging decrypt state', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageDecryptDiagnosticsRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function buildActiveDecryptMessageRecord/);
  assert.match(source, /windowObj\.__guildMessagesDebug/);
  assert.match(source, /readMessageDecryptDiagnostics/);
  assert.match(source, /summarizeMessageDecryptDiagnostics/);
  assert.match(source, /readMessageDecryptElectronLog/);
  assert.match(source, /parseMessageDecryptDebugLogLines/);
  assert.match(source, /clearLaneDiagnostics/);
});
