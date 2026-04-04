import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice hook action session controller options compose dedicated state, core-runtime, and environment helpers', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionControllerOptions.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionStateOptions.mjs', import.meta.url),
    'utf8'
  );
  const coreRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionCoreRuntimeOptions.mjs', import.meta.url),
    'utf8'
  );
  const environmentSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionEnvironment.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /buildUseVoiceHookActionSessionStateOptions/);
  assert.match(source, /buildUseVoiceHookActionSessionCoreRuntimeOptions/);
  assert.match(source, /buildUseVoiceHookActionSessionEnvironment/);
  assert.match(source, /setVoiceChannelIdFn,/);
  assert.match(source, /buildUseVoiceHookActionSessionStateOptions\(\{\s*state,\s*refs,\s*setVoiceChannelIdFn,\s*\}\)/);
  assert.match(stateSource, /export function buildUseVoiceHookActionSessionStateOptions/);
  assert.match(stateSource, /setVoiceChannelIdFn = null/);
  assert.match(stateSource, /setVoiceChannelIdFn: typeof setVoiceChannelIdFn === 'function' \? setVoiceChannelIdFn : setChannelId/);
  assert.match(coreRuntimeSource, /export function buildUseVoiceHookActionSessionCoreRuntimeOptions/);
  assert.match(environmentSource, /export function buildUseVoiceHookActionSessionEnvironment/);
});

test('voice hook action session controller helper modules keep the shared session wiring contracts intact', async () => {
  const coreRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionCoreRuntimeOptions.mjs', import.meta.url),
    'utf8'
  );
  const environmentSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionEnvironment.mjs', import.meta.url),
    'utf8'
  );

  assert.match(coreRuntimeSource, /createSendTransportFn: async \(nextChannelId\) => createSendTransport\(nextChannelId\)/);
  assert.match(coreRuntimeSource, /createRecvTransportFn: async \(nextChannelId\) => createRecvTransport\(nextChannelId\)/);
  assert.match(coreRuntimeSource, /deps:\s*\[/);
  assert.match(environmentSource, /APPLE_VOICE_CAPTURE_OWNERS\.LIVE_VOICE/);
  assert.match(environmentSource, /scheduleClearJoinErrorFn: \(callback, delayMs\) => setTimeout\(callback, delayMs\)/);
  assert.match(environmentSource, /voiceSessionErrorTimeoutMs: VOICE_SESSION_ERROR_TIMEOUT_MS/);
});
