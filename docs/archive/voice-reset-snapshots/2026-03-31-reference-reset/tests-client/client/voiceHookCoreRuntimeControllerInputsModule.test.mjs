import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice hook core runtime controller input hub delegates to dedicated owner modules', async () => {
  const hubSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookCoreRuntimeControllerInputs.mjs', import.meta.url),
    'utf8'
  );
  const screenShareSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookScreenShareRuntimeInput.mjs', import.meta.url),
    'utf8'
  );
  const securitySource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookSecurityRuntimeInput.mjs', import.meta.url),
    'utf8'
  );
  const captureSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookCaptureRuntimeInput.mjs', import.meta.url),
    'utf8'
  );
  const mediaTransportSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookMediaTransportRuntimeInput.mjs', import.meta.url),
    'utf8'
  );
  const depsSyncSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookCoreRuntimeDepsSync.mjs', import.meta.url),
    'utf8'
  );
  const valueSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookCoreRuntimeValue.mjs', import.meta.url),
    'utf8'
  );

  assert.match(hubSource, /voiceHookScreenShareRuntimeInput/);
  assert.match(hubSource, /voiceHookSecurityRuntimeInput/);
  assert.match(hubSource, /voiceHookCaptureRuntimeInput/);
  assert.match(hubSource, /voiceHookMediaTransportRuntimeInput/);
  assert.match(hubSource, /voiceHookCoreRuntimeDepsSync/);
  assert.match(hubSource, /voiceHookCoreRuntimeValue/);
  assert.match(screenShareSource, /export function buildUseVoiceHookScreenShareRuntimeInput/);
  assert.match(securitySource, /export function buildUseVoiceHookSecurityRuntimeInput/);
  assert.match(captureSource, /export function buildUseVoiceHookCaptureRuntimeInput/);
  assert.match(mediaTransportSource, /export function buildUseVoiceHookMediaTransportRuntimeInput/);
  assert.match(depsSyncSource, /export function syncUseVoiceHookCoreRuntimeDeps/);
  assert.match(valueSource, /export function buildUseVoiceHookCoreRuntimeValue/);
});
