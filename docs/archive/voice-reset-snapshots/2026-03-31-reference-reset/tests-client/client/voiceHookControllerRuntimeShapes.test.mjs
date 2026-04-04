import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildUseVoiceHookActionCoreRuntime,
  buildUseVoiceHookControllerRuntimeValue,
} from '../../../client/src/features/voice/voiceHookControllerRuntimeShapes.mjs';

test('voice hook controller runtime shape modules delegate through dedicated owners', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/voice/voiceHookControllerRuntimeShapes.mjs', import.meta.url),
    'utf8'
  );
  const actionSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionCoreRuntimeShape.mjs', import.meta.url),
    'utf8'
  );
  const valueSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookControllerRuntimeValue.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /voiceHookActionCoreRuntimeShape/);
  assert.match(source, /voiceHookControllerRuntimeValue/);
  assert.match(actionSource, /export function buildUseVoiceHookActionCoreRuntime/);
  assert.match(valueSource, /export function buildUseVoiceHookControllerRuntimeValue/);
});

test('voice hook controller runtime shapes preserve the action core-runtime contract', () => {
  const marker = () => {};
  const runtime = buildUseVoiceHookActionCoreRuntime({
    resetScreenShareAdaptation: marker,
    maybeAdaptScreenShareProfile: marker,
    ensureSecureMediaReady: marker,
    syncVoiceE2EState: marker,
    getUntrustedVoiceParticipants: marker,
    buildVoiceTrustError: marker,
    syncVoiceParticipants: marker,
    clearVoiceHealthProbe: marker,
    switchLiveCaptureModeInPlace: marker,
    reconfigureLiveCapture: marker,
    scheduleVoiceHealthProbe: marker,
    cleanupRemoteProducer: marker,
    createSendTransport: marker,
    createRecvTransport: marker,
    consumeProducer: marker,
    applyLiveCaptureToProducer: marker,
  });

  assert.equal(runtime.consumeProducer, marker);
  assert.equal(runtime.applyLiveCaptureToProducer, marker);
  assert.equal(runtime.ensureSecureMediaReady, marker);
});

test('voice hook controller runtime shapes preserve the exported public action surface', () => {
  const marker = () => {};
  const value = buildUseVoiceHookControllerRuntimeValue({
    joinChannel: marker,
    leaveChannel: marker,
    toggleMute: marker,
    toggleDeafen: marker,
    setOutputDevice: marker,
    setUserVolume: marker,
    setMicGain: marker,
    setVoiceProcessingMode: marker,
    toggleNoiseSuppression: marker,
    startScreenShare: marker,
    stopScreenShare: marker,
    confirmScreenShare: marker,
    cancelSourcePicker: marker,
    clearScreenShareError: marker,
  });

  assert.equal(value.joinChannel, marker);
  assert.equal(value.clearScreenShareError, marker);
  assert.equal(value.toggleNoiseSuppression, marker);
});
