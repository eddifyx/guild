import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildUseVoiceHookActionRuntimeEffectsOptions,
  buildUseVoiceHookActionSessionOptions,
  buildUseVoiceHookActionUiOptions,
} from '../../../client/src/features/voice/voiceHookActionRuntimeBuilders.mjs';

test('voice hook action session builder preserves session runtime contracts', () => {
  const marker = () => {};
  const deps = [marker];
  const options = buildUseVoiceHookActionSessionOptions({
    socket: marker,
    state: { state: true },
    refs: { refs: true },
    emitAsyncFn: marker,
    setVoiceChannelParticipantsFn: marker,
    joinGenRef: { current: 1 },
    deviceRef: { current: null },
    voiceSessionErrorTimeoutMs: 12,
    appleVoiceCaptureOwner: 'owner',
    resetControlState: { muted: false },
    deps,
  });

  assert.equal(options.socket, marker);
  assert.equal(options.emitAsyncFn, marker);
  assert.equal(options.setVoiceChannelParticipantsFn, marker);
  assert.deepEqual(options.resetControlState, { muted: false });
  assert.equal(options.voiceSessionErrorTimeoutMs, 12);
  assert.equal(options.appleVoiceCaptureOwner, 'owner');
  assert.equal(options.deps, deps);
});

test('voice hook action ui builder preserves ui runtime contracts', () => {
  const marker = () => {};
  const deps = [marker];
  const options = buildUseVoiceHookActionUiOptions({
    socket: marker,
    state: { state: true },
    refs: { refs: true },
    scheduleVoiceHealthProbeFn: marker,
    applyNoiseSuppressionRoutingFn: marker,
    isUltraLowLatencyModeFn: marker,
    deps,
  });

  assert.equal(options.socket, marker);
  assert.equal(options.scheduleVoiceHealthProbeFn, marker);
  assert.equal(options.applyNoiseSuppressionRoutingFn, marker);
  assert.equal(options.isUltraLowLatencyModeFn, marker);
  assert.equal(options.deps, deps);
});

test('voice hook action runtime-effects builder preserves runtime diagnostics contracts', () => {
  const marker = () => {};
  const options = buildUseVoiceHookActionRuntimeEffectsOptions({
    state: { state: true },
    refs: { refs: true },
    socket: marker,
    currentUserId: 'user-1',
    prefersAppleSystemVoiceIsolationFn: marker,
    roundRateFn: marker,
    electronAPI: { ping: true },
    screenShareProfiles: { low: {} },
  });

  assert.equal(options.socket, marker);
  assert.equal(options.currentUserId, 'user-1');
  assert.equal(options.prefersAppleSystemVoiceIsolationFn, marker);
  assert.equal(options.roundRateFn, marker);
  assert.deepEqual(options.electronAPI, { ping: true });
  assert.deepEqual(options.screenShareProfiles, { low: {} });
});

test('voice hook action runtime builders delegate the public builder surface to dedicated modules', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeBuilders.mjs', import.meta.url),
    'utf8'
  );
  const sessionSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionOptions.mjs', import.meta.url),
    'utf8'
  );
  const uiSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiOptions.mjs', import.meta.url),
    'utf8'
  );
  const effectsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsOptions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /voiceHookActionSessionOptions/);
  assert.match(source, /voiceHookActionUiOptions/);
  assert.match(source, /voiceHookActionRuntimeEffectsOptions/);
  assert.match(sessionSource, /export function buildUseVoiceHookActionSessionOptions/);
  assert.match(uiSource, /export function buildUseVoiceHookActionUiOptions/);
  assert.match(effectsSource, /export function buildUseVoiceHookActionRuntimeEffectsOptions/);
});
