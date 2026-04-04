import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice hook core runtime controller inputs export the canonical builders', async () => {
  const source = await readFile(
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

  assert.match(source, /voiceHookScreenShareRuntimeInput/);
  assert.match(source, /voiceHookSecurityRuntimeInput/);
  assert.match(source, /voiceHookCaptureRuntimeInput/);
  assert.match(source, /voiceHookMediaTransportRuntimeInput/);
  assert.match(source, /voiceHookCoreRuntimeDepsSync/);
  assert.match(source, /voiceHookCoreRuntimeValue/);
  assert.match(screenShareSource, /export function buildUseVoiceHookScreenShareRuntimeInput/);
  assert.match(securitySource, /export function buildUseVoiceHookSecurityRuntimeInput/);
  assert.match(captureSource, /export function buildUseVoiceHookCaptureRuntimeInput/);
  assert.match(mediaTransportSource, /export function buildUseVoiceHookMediaTransportRuntimeInput/);
  assert.match(depsSyncSource, /export function syncUseVoiceHookCoreRuntimeDeps/);
  assert.match(valueSource, /export function buildUseVoiceHookCoreRuntimeValue/);
});

test('voice hook core runtime controller inputs preserve sub-controller wiring contracts', async () => {
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

  assert.match(mediaTransportSource, /currentUserId: userId/);
  assert.match(depsSyncSource, /screenShare\.syncScreenShareRuntimeDeps\?\.\(\{/);
  assert.match(depsSyncSource, /ensureSecureMediaReadyFn: security\.ensureSecureMediaReady/);
  assert.match(depsSyncSource, /ensureVoiceKeyForParticipantsFn: security\.ensureVoiceKeyForParticipants/);
  assert.match(valueSource, /return\s+\{[\s\S]*\.\.\.screenShare,[\s\S]*\.\.\.security,[\s\S]*\.\.\.capture,[\s\S]*\.\.\.mediaTransport,[\s\S]*\}/);
});
