import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice hook core runtime controller exports the expected hook factory', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookCoreRuntimeController.mjs', import.meta.url),
    'utf8'
  );
  const inputsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookCoreRuntimeControllerInputs.mjs', import.meta.url),
    'utf8'
  );
  const screenShareInputSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookScreenShareRuntimeInput.mjs', import.meta.url),
    'utf8'
  );
  const securityInputSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookSecurityRuntimeInput.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /export function useVoiceHookCoreRuntimeController/);
  assert.match(source, /voiceHookCoreRuntimeControllerInputs/);
  assert.match(source, /buildUseVoiceHookScreenShareRuntimeInput/);
  assert.match(source, /buildUseVoiceHookSecurityRuntimeInput/);
  assert.match(source, /buildUseVoiceHookCaptureRuntimeInput/);
  assert.match(source, /buildUseVoiceHookMediaTransportRuntimeInput/);
  assert.match(source, /syncUseVoiceHookCoreRuntimeDeps/);
  assert.match(source, /buildUseVoiceHookCoreRuntimeValue/);
  assert.match(source, /useVoiceHookScreenShareController\(buildUseVoiceHookScreenShareRuntimeInput\(\{/);
  assert.match(source, /useVoiceHookSecurityController\(buildUseVoiceHookSecurityRuntimeInput\(\{/);
  assert.match(source, /useVoiceHookCaptureController\(buildUseVoiceHookCaptureRuntimeInput\(\{/);
  assert.match(source, /useVoiceHookMediaTransportController\(buildUseVoiceHookMediaTransportRuntimeInput\(\{/);
  assert.match(inputsSource, /voiceHookScreenShareRuntimeInput/);
  assert.match(inputsSource, /voiceHookSecurityRuntimeInput/);
  assert.match(screenShareInputSource, /export function buildUseVoiceHookScreenShareRuntimeInput/);
  assert.match(securityInputSource, /export function buildUseVoiceHookSecurityRuntimeInput/);
});
