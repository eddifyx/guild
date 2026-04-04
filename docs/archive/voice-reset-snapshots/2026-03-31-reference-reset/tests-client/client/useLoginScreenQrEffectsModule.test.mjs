import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('login screen qr effects own QR-session startup and teardown wiring', async () => {
  const qrEffectsSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenQrEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(qrEffectsSource, /function useLoginScreenQrEffects\(/);
  assert.match(qrEffectsSource, /startLoginScreenQrSession\(/);
  assert.match(qrEffectsSource, /createNostrConnectSession/);
  assert.match(qrEffectsSource, /clearNip46Trace/);
  assert.match(qrEffectsSource, /qrConnectionTimeoutMs: QR_CONNECTION_TIMEOUT_MS/);
});
