import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice controller runtime contracts hub delegates to dedicated owner modules', async () => {
  const hubSource = await readFile(
    new URL('../../../client/src/features/voice/voiceControllerRuntimeContracts.mjs', import.meta.url),
    'utf8'
  );
  const screenShareSource = await readFile(
    new URL('../../../client/src/features/voice/voiceScreenShareActionContract.mjs', import.meta.url),
    'utf8'
  );
  const actionSource = await readFile(
    new URL('../../../client/src/features/voice/voiceActionContracts.mjs', import.meta.url),
    'utf8'
  );
  const runtimeEffectsSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceRuntimeEffectsContract.mjs', import.meta.url),
    'utf8'
  );
  const publicApiSource = await readFile(
    new URL('../../../client/src/features/voice/useVoicePublicApi.mjs', import.meta.url),
    'utf8'
  );

  assert.match(hubSource, /voiceScreenShareActionContract/);
  assert.match(hubSource, /voiceActionContracts/);
  assert.match(hubSource, /useVoiceRuntimeEffectsContract/);
  assert.match(hubSource, /useVoicePublicApi/);
  assert.match(screenShareSource, /export function buildVoiceScreenShareActionContract/);
  assert.match(actionSource, /export function buildVoiceTransportActionContract/);
  assert.match(actionSource, /export function buildVoiceUiActionContract/);
  assert.match(runtimeEffectsSource, /export function buildUseVoiceRuntimeEffectsContract/);
  assert.match(publicApiSource, /export function buildUseVoicePublicApi/);
});
