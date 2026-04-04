import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUseVoiceHookRuntimeBindingsControllerRuntimeValue,
  buildUseVoiceHookSessionControllerRuntimeValue,
  buildUseVoiceHookUiControllerRuntimeValue,
} from '../../../client/src/features/voice/voiceHookControllerRuntimeBuilders.mjs';

test('voice hook controller runtime builders preserve session refs, constants, and dependency bags', () => {
  const joinGenRef = { current: 4 };
  const deviceRef = { current: null };
  const deps = ['session-dep'];
  const resetControlState = { muted: false };
  const sessionRuntime = buildUseVoiceHookSessionControllerRuntimeValue({
    emitAsyncFn: () => {},
    clearVoiceHealthProbeFn: () => {},
    stopAppleVoiceCaptureFn: () => {},
    resetScreenShareAdaptationFn: () => {},
    clearVoiceKeyFn: () => {},
    updateVoiceDiagnosticsFn: () => {},
    setVoiceChannelIdFn: () => {},
    setVoiceChannelParticipantsFn: () => {},
    joinGenRef,
    setTimeoutFn: () => {},
    playLeaveChimeFn: () => {},
    clearTimeoutFn: () => {},
    cancelPerfTraceFn: () => {},
    setJoinErrorFn: () => {},
    setE2EWarningFn: () => {},
    setLiveVoiceFallbackReasonFn: () => {},
    recordLaneDiagnosticFn: () => {},
    ensureSecureMediaReadyFn: () => {},
    rememberUsersFn: () => {},
    getUntrustedVoiceParticipantsFn: () => [],
    buildVoiceTrustErrorFn: () => new Error('trust'),
    deviceCtor: class Device {},
    deviceRef,
    createSendTransportFn: () => {},
    createRecvTransportFn: () => {},
    setChannelIdFn: () => {},
    setDeafenedFn: () => {},
    syncVoiceParticipantsFn: () => {},
    getVoiceParticipantIdsFn: () => [],
    consumeProducerFn: () => {},
    syncVoiceE2EStateFn: () => {},
    playConnectChimeFn: () => {},
    getPlatformFn: () => 'darwin',
    prefetchDesktopSourcesFn: () => {},
    applyLiveCaptureToProducerFn: () => {},
    setMutedFn: () => {},
    scheduleVoiceHealthProbeFn: () => {},
    isExpectedVoiceTeardownErrorFn: () => false,
    normalizeVoiceErrorMessageFn: () => 'voice error',
    scheduleClearJoinErrorFn: () => {},
    logErrorFn: () => {},
    voiceSessionErrorTimeoutMs: 8000,
    appleVoiceCaptureOwner: 'live-voice',
    resetControlState,
    deps,
  });

  sessionRuntime.advanceJoinGenerationFn();
  sessionRuntime.setDeviceFn('device');

  assert.equal(typeof sessionRuntime.emitAsyncFn, 'function');
  assert.equal(joinGenRef.current, 5);
  assert.equal(deviceRef.current, 'device');
  assert.equal(sessionRuntime.deps, deps);
  assert.equal(sessionRuntime.constants.voiceSessionErrorTimeoutMs, 8000);
  assert.equal(sessionRuntime.constants.appleVoiceCaptureOwner, 'live-voice');
  assert.equal(sessionRuntime.constants.resetControlState, resetControlState);
});

test('voice hook controller runtime builders preserve ui and runtime-binding contracts', () => {
  const uiDeps = ['ui-dep'];
  const uiRuntime = buildUseVoiceHookUiControllerRuntimeValue({
    clearVoiceHealthProbeFn: () => {},
    scheduleVoiceHealthProbeFn: () => {},
    scheduleVoiceLiveReconfigureFlowFn: () => {},
    clearTimeoutFn: () => {},
    setTimeoutFn: () => {},
    cancelPerfTraceFn: () => {},
    addPerfPhaseFn: () => {},
    reconfigureLiveCaptureFn: () => {},
    startPerfTraceFn: () => {},
    endPerfTraceFn: () => {},
    switchLiveCaptureModeInPlaceFn: () => {},
    applyNoiseSuppressionRoutingFn: () => {},
    applyVoiceModeDependenciesFn: () => {},
    persistVoiceProcessingModeFn: () => {},
    persistNoiseSuppressionEnabledFn: () => {},
    isUltraLowLatencyModeFn: () => false,
    deps: uiDeps,
  });
  assert.equal(uiRuntime.deps, uiDeps);

  const screenShareProfiles = [{ key: 'balanced' }];
  const runtimeBindings = buildUseVoiceHookRuntimeBindingsControllerRuntimeValue({
    socket: { on() {} },
    currentUserId: 'user-1',
    rememberUsersFn: () => {},
    getUntrustedVoiceParticipantsFn: () => [],
    buildVoiceTrustErrorFn: () => new Error('trust'),
    setJoinErrorFn: () => {},
    setVoiceE2EFn: () => {},
    setE2EWarningFn: () => {},
    syncVoiceParticipantsFn: () => {},
    syncVoiceE2EStateFn: () => {},
    handleUnexpectedVoiceSessionEndFn: () => {},
    cleanupRemoteProducerFn: () => {},
    consumeProducerFn: () => {},
    isExpectedVoiceTeardownErrorFn: () => false,
    setPeersFn: () => {},
    resetVoiceSessionFn: () => {},
    updateVoiceDiagnosticsFn: () => {},
    prefersAppleSystemVoiceIsolationFn: () => false,
    electronAPI: { getPlatform() { return 'darwin'; } },
    summarizeProducerStatsFn: () => ({}),
    summarizeConsumerStatsFn: () => ({}),
    isVoiceDiagnosticsEnabledFn: () => true,
    getBitrateBpsFn: () => 123,
    setScreenShareDiagnosticsFn: () => {},
    maybeAdaptScreenShareProfileFn: () => {},
    summarizeTrackSnapshotFn: () => ({}),
    summarizeScreenShareProfileFn: () => ({}),
    summarizeScreenShareHardwareFn: () => ({}),
    screenShareProfiles,
    roundRateFn: () => 1,
    clearTimeoutFn: () => {},
  });
  assert.equal(runtimeBindings.currentUserId, 'user-1');
  assert.equal(runtimeBindings.screenShareProfiles, screenShareProfiles);
  assert.equal(runtimeBindings.getBitrateBpsFn(), 123);
});

test('voice hook controller runtime builders export the dedicated session, ui, and runtime-effects builders', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(
    new URL('../../../client/src/features/voice/voiceHookControllerRuntimeBuilders.mjs', import.meta.url),
    'utf8'
  );
  const sessionSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookSessionRuntimeBuilders.mjs', import.meta.url),
    'utf8'
  );
  const uiSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookUiRuntimeBuilders.mjs', import.meta.url),
    'utf8'
  );
  const runtimeEffectsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookRuntimeEffectsBuilders.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /voiceHookSessionRuntimeBuilders/);
  assert.match(source, /voiceHookUiRuntimeBuilders/);
  assert.match(source, /voiceHookRuntimeEffectsBuilders/);
  assert.match(sessionSource, /export function buildUseVoiceHookSessionControllerRuntimeValue/);
  assert.match(uiSource, /export function buildUseVoiceHookUiControllerRuntimeValue/);
  assert.match(runtimeEffectsSource, /export function buildUseVoiceHookRuntimeBindingsControllerRuntimeValue/);
});
