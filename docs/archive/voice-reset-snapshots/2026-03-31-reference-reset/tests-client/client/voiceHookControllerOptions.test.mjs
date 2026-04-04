import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUseVoiceHookActionRuntimeControllerOptions,
  buildUseVoiceHookCoreRuntimeControllerOptions,
} from '../../../client/src/features/voice/voiceHookControllerOptions.mjs';

test('voice hook controller options builder preserves core runtime contracts', () => {
  const marker = () => {};
  const options = buildUseVoiceHookCoreRuntimeControllerOptions({
    socket: marker,
    userId: 'user-1',
    state: { state: true },
    refs: { refs: true },
    clearVoiceKeyFn: marker,
    updateVoiceDiagnosticsFn: marker,
    getExperimentalScreenVideoBypassModeFn: marker,
  });

  assert.equal(options.socket, marker);
  assert.equal(options.userId, 'user-1');
  assert.equal(options.clearVoiceKeyFn, marker);
  assert.equal(options.updateVoiceDiagnosticsFn, marker);
  assert.equal(options.getExperimentalScreenVideoBypassModeFn, marker);
});

test('voice hook controller options builder preserves action runtime contracts', () => {
  const marker = () => {};
  const coreRuntime = { consumeProducer: marker };
  const options = buildUseVoiceHookActionRuntimeControllerOptions({
    socket: marker,
    userId: 'user-2',
    state: { state: true },
    refs: { refs: true },
    emitAsyncFn: marker,
    clearVoiceKeyFn: marker,
    setVoiceChannelParticipantsFn: marker,
    roundRateFn: marker,
    coreRuntime,
  });

  assert.equal(options.socket, marker);
  assert.equal(options.userId, 'user-2');
  assert.equal(options.emitAsyncFn, marker);
  assert.equal(options.setVoiceChannelParticipantsFn, marker);
  assert.equal(options.roundRateFn, marker);
  assert.equal(options.coreRuntime, coreRuntime);
});

test('voice hook controller options exports the dedicated core and action option modules', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(
    new URL('../../../client/src/features/voice/voiceHookControllerOptions.mjs', import.meta.url),
    'utf8'
  );
  const coreSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookCoreRuntimeControllerOptions.mjs', import.meta.url),
    'utf8'
  );
  const actionSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeControllerOptions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /voiceHookCoreRuntimeControllerOptions/);
  assert.match(source, /voiceHookActionRuntimeControllerOptions/);
  assert.match(coreSource, /export function buildUseVoiceHookCoreRuntimeControllerOptions/);
  assert.match(actionSource, /export function buildUseVoiceHookActionRuntimeControllerOptions/);
});
