import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice hook core controller wrappers export the expected controller factories', async () => {
  const securitySource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookSecurityController.mjs', import.meta.url),
    'utf8'
  );
  const captureSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookCaptureController.mjs', import.meta.url),
    'utf8'
  );
  const mediaTransportSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookMediaTransportController.mjs', import.meta.url),
    'utf8'
  );

  assert.match(securitySource, /export function useVoiceHookSecurityController/);
  assert.match(captureSource, /export function useVoiceHookCaptureController/);
  assert.match(mediaTransportSource, /export function useVoiceHookMediaTransportController/);
});
