import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice hook controller callbacks export the dedicated callback hook', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookControllerCallbacks.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /export function useVoiceHookControllerCallbacks/);
  assert.match(source, /useCallback/);
});

test('voice hook controller callbacks keep emit and routing helpers on the shared voice runtime contracts', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookControllerCallbacks.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /createVoiceEmitAsync/);
  assert.match(source, /VOICE_SOCKET_ACK_TIMEOUT_MS/);
  assert.match(source, /applyVoiceNoiseSuppressionRouting/);
  assert.match(source, /noiseSuppressionRoutingRef/);
});
