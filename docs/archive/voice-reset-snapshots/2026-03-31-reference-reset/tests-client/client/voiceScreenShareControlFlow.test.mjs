import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildVoiceScreenShareActionDeps,
  buildVoiceScreenShareStartRequest,
  cancelVoiceScreenSharePicker,
  clearVoiceScreenShareError,
  confirmVoiceScreenShareSelection,
  createVoiceScreenShareActions,
  requestVoiceScreenShareStart,
  resolveVoiceScreenShareRequest,
  runConfirmVoiceScreenShareAction,
  stopVoiceScreenShareSession,
} from '../../../client/src/features/voice/voiceScreenShareControlFlow.mjs';

test('voice screen share control flow resolves legacy and structured requests consistently', () => {
  assert.deepEqual(resolveVoiceScreenShareRequest({
    options: 'desktop-source-1',
    platform: 'darwin',
  }), {
    sourceId: 'desktop-source-1',
    includeAudio: false,
    macAudioDeviceId: null,
  });

  assert.deepEqual(resolveVoiceScreenShareRequest({
    options: {
      sourceId: 'desktop-source-2',
      includeAudio: true,
      macAudioDeviceId: 'mac-audio-1',
    },
    platform: 'win32',
  }), {
    sourceId: 'desktop-source-2',
    includeAudio: true,
    macAudioDeviceId: 'mac-audio-1',
  });
});

test('voice screen share control flow confirms a selection and delegates to the start flow payload builder', async () => {
  const calls = [];
  const result = await confirmVoiceScreenShareSelection({
    options: {
      sourceId: 'desktop-source-3',
      includeAudio: true,
      macAudioDeviceId: 'mac-audio-2',
    },
    refs: {
      channelIdRef: { current: 'channel-1' },
    },
    setShowSourcePickerFn: (value) => calls.push(['picker', value]),
    setScreenShareErrorFn: (value) => calls.push(['error', value]),
    getPlatformFn: () => 'darwin',
    buildStartPayloadFn: (request) => {
      calls.push(['payload', request]);
      return { request };
    },
    runVoiceScreenShareStartFlowFn: async (payload) => ({ started: true, payload }),
  });

  assert.equal(result.started, true);
  assert.deepEqual(calls, [
    ['picker', false],
    ['error', null],
    ['payload', {
      sourceId: 'desktop-source-3',
      includeAudio: true,
      macAudioDeviceId: 'mac-audio-2',
    }],
  ]);
});

test('voice screen share control flow builds the full start payload from request and lane dependencies', () => {
  const payload = buildVoiceScreenShareStartRequest({
    request: {
      sourceId: 'desktop-source-4',
      includeAudio: true,
      macAudioDeviceId: 'mac-audio-4',
    },
    deps: {
      channelIdRef: { current: 'channel-4' },
      participantIdsRef: { current: ['user-1', 'user-2'] },
      deviceRef: { current: { id: 'device-4' } },
      refs: { screenShareProducerRef: { current: null } },
      ensureSecureMediaReadyFn: () => {},
      ensureVoiceKeyForParticipantsFn: () => {},
      getOrCreateScreenSendTransportFn: () => {},
      getRuntimeScreenShareCodecModeFn: () => {},
      getPreferredScreenShareCodecCandidatesFn: () => {},
      screenShareProfiles: [{ id: 'profile-1' }],
      initialProfileIndex: 0,
      selectDesktopSourceFn: () => {},
      getDisplayMediaFn: () => {},
      getUserMediaFn: () => {},
      resetScreenShareAdaptationFn: () => {},
      applyPreferredScreenShareConstraintsFn: () => {},
      setScreenShareStreamFn: () => {},
      setScreenShareDiagnosticsFn: () => {},
      setVoiceE2EFn: () => {},
      setE2EWarningFn: () => {},
      setScreenShareErrorFn: () => {},
      setScreenSharingFn: () => {},
      playStreamStartChimeFn: () => {},
      cleanupVoiceScreenShareSessionFn: () => {},
      publishScreenShareVideoProducerFn: () => {},
      applySenderPreferencesFn: () => {},
      attachSenderEncryptionFn: () => {},
      socket: { id: 'socket-1' },
      onVideoTrackEndedFn: () => {},
      buildScreenShareStartErrorFn: () => {},
      logScreenShareFailureContextFn: () => {},
      summarizeSelectedCodecFn: () => {},
      summarizeTrackSnapshotFn: () => {},
      summarizeScreenShareProfileFn: () => {},
      summarizeScreenShareHardwareFn: () => {},
      summarizeSenderParametersFn: () => {},
      getScreenShareRequestedCaptureFn: () => {},
      screenShareAudioMaxBitrate: 96000,
      warnFn: () => {},
    },
  });

  assert.equal(payload.channelId, 'channel-4');
  assert.deepEqual(payload.participantIds, ['user-1', 'user-2']);
  assert.equal(payload.sourceId, 'desktop-source-4');
  assert.equal(payload.includeAudio, true);
  assert.equal(payload.macAudioDeviceId, 'mac-audio-4');
  assert.equal(payload.device.id, 'device-4');
  assert.equal(payload.screenShareAudioMaxBitrate, 96000);
});

test('voice screen share control flow builds runtime deps from refs, globals, and helpers', async () => {
  const calls = [];
  const fakeWindow = {
    electronAPI: {
      selectDesktopSource(sourceId) {
        calls.push(['select-source', sourceId]);
      },
    },
  };
  const fakeNavigator = {
    mediaDevices: {
      getDisplayMedia(constraints) {
        calls.push(['display-media', constraints]);
        return Promise.resolve('display-stream');
      },
      getUserMedia(constraints) {
        calls.push(['user-media', constraints]);
        return Promise.resolve('audio-stream');
      },
    },
  };

  const deps = buildVoiceScreenShareActionDeps({
    refs: {
      channelIdRef: { current: 'channel-9' },
      participantIdsRef: { current: ['user-9'] },
      deviceRef: { current: { id: 'device-9' } },
      screenShareRefs: {
        screenShareProducerRef: { current: null },
      },
    },
    runtime: {
      ensureSecureMediaReadyFn: () => {},
      ensureVoiceKeyForParticipantsFn: () => {},
      getOrCreateScreenSendTransportFn: () => {},
      getRuntimeScreenShareCodecModeFn: () => {},
      getPreferredScreenShareCodecCandidatesFn: () => {},
      resetScreenShareAdaptationFn: () => {},
      applyPreferredScreenShareConstraintsFn: () => {},
      setScreenShareStreamFn: () => {},
      setScreenShareDiagnosticsFn: () => {},
      setVoiceE2EFn: () => {},
      setE2EWarningFn: () => {},
      setScreenShareErrorFn: () => {},
      setScreenSharingFn: () => {},
      playStreamStartChimeFn: () => {},
      cleanupVoiceScreenShareSessionFn: () => {},
      publishScreenShareVideoProducerFn: () => {},
      applySenderPreferencesFn: () => {},
      attachSenderEncryptionFn: () => {},
      socket: { id: 'socket-9' },
      onVideoTrackEndedFn: () => {},
      buildScreenShareStartErrorFn: () => {},
      logScreenShareFailureContextFn: () => {},
      summarizeSelectedCodecFn: () => {},
      summarizeTrackSnapshotFn: () => {},
      summarizeScreenShareProfileFn: () => {},
      summarizeScreenShareHardwareFn: () => {},
      summarizeSenderParametersFn: () => {},
      getScreenShareRequestedCaptureFn: () => {},
    },
    constants: {
      screenShareProfiles: [{ id: 'profile-9' }],
      initialProfileIndex: 2,
      screenShareAudioMaxBitrate: 128000,
    },
    windowObject: fakeWindow,
    navigatorObject: fakeNavigator,
    consoleObject: {
      warn(...args) {
        calls.push(['warn', ...args]);
      },
    },
  });

  assert.equal(deps.channelIdRef.current, 'channel-9');
  assert.equal(deps.deviceRef.current.id, 'device-9');
  assert.equal(deps.screenShareProfiles[0].id, 'profile-9');
  assert.equal(deps.initialProfileIndex, 2);
  assert.equal(deps.screenShareAudioMaxBitrate, 128000);
  await deps.selectDesktopSourceFn('desktop-9');
  assert.equal(await deps.getDisplayMediaFn({ video: true }), 'display-stream');
  assert.equal(await deps.getUserMediaFn({ audio: true }), 'audio-stream');
  deps.warnFn('warn-9');
  assert.deepEqual(calls, [
    ['select-source', 'desktop-9'],
    ['display-media', { video: true }],
    ['user-media', { audio: true }],
    ['warn', 'warn-9'],
  ]);
});

test('voice screen share control flow runs the confirm action with prebuilt deps', async () => {
  const calls = [];

  const result = await runConfirmVoiceScreenShareAction({
    options: {
      sourceId: 'desktop-source-5',
      includeAudio: false,
      macAudioDeviceId: null,
    },
    refs: {
      channelIdRef: { current: 'channel-5' },
    },
    deps: {
      channelIdRef: { current: 'channel-5' },
      participantIdsRef: { current: ['user-5'] },
      deviceRef: { current: { id: 'device-5' } },
      screenShareProfiles: [{ id: 'profile-5' }],
      initialProfileIndex: 0,
    },
    setShowSourcePickerFn: (value) => calls.push(['picker', value]),
    setScreenShareErrorFn: (value) => calls.push(['error', value]),
    getPlatformFn: () => 'win32',
    runVoiceScreenShareStartFlowFn: async (payload) => {
      calls.push(['payload', payload]);
      return { started: true };
    },
  });

  assert.deepEqual(result, { started: true });
  assert.deepEqual(calls, [
    ['picker', false],
    ['error', null],
    ['payload', {
      channelId: 'channel-5',
      sourceId: 'desktop-source-5',
      includeAudio: false,
      macAudioDeviceId: null,
      participantIds: ['user-5'],
      device: { id: 'device-5' },
      refs: {},
      ensureSecureMediaReadyFn: undefined,
      ensureVoiceKeyForParticipantsFn: undefined,
      getOrCreateScreenSendTransportFn: undefined,
      getRuntimeScreenShareCodecModeFn: undefined,
      getPreferredScreenShareCodecCandidatesFn: undefined,
      screenShareProfiles: [{ id: 'profile-5' }],
      initialProfileIndex: 0,
      selectDesktopSourceFn: undefined,
      getDisplayMediaFn: undefined,
      getUserMediaFn: undefined,
      resetScreenShareAdaptationFn: undefined,
      applyPreferredScreenShareConstraintsFn: undefined,
      setScreenShareStreamFn: undefined,
      setScreenShareDiagnosticsFn: undefined,
      setVoiceE2EFn: undefined,
      setE2EWarningFn: undefined,
      setScreenShareErrorFn: undefined,
      setScreenSharingFn: undefined,
      playStreamStartChimeFn: undefined,
      cleanupVoiceScreenShareSessionFn: undefined,
      publishScreenShareVideoProducerFn: undefined,
      applySenderPreferencesFn: undefined,
      attachSenderEncryptionFn: undefined,
      socket: undefined,
      onVideoTrackEndedFn: undefined,
      buildScreenShareStartErrorFn: undefined,
      logScreenShareFailureContextFn: undefined,
      summarizeSelectedCodecFn: undefined,
      summarizeTrackSnapshotFn: undefined,
      summarizeScreenShareProfileFn: undefined,
      summarizeScreenShareHardwareFn: undefined,
      summarizeSenderParametersFn: undefined,
      getScreenShareRequestedCaptureFn: undefined,
      screenShareAudioMaxBitrate: undefined,
      warnFn: undefined,
    }],
  ]);
});

test('voice screen share control flow opens, cancels, stops, and clears UI state deterministically', async () => {
  const calls = [];

  requestVoiceScreenShareStart({
    refs: {
      channelIdRef: { current: 'channel-2' },
      deviceRef: { current: { id: 'device-1' } },
    },
    setScreenShareErrorFn: (value) => calls.push(['error', value]),
    setShowSourcePickerFn: (value) => calls.push(['picker', value]),
    ensureSecureMediaReadyFn: (feature) => calls.push(['ensure', feature]),
  });

  cancelVoiceScreenSharePicker({
    setShowSourcePickerFn: (value) => calls.push(['cancel-picker', value]),
    setScreenShareErrorFn: (value) => calls.push(['cancel-error', value]),
  });

  await stopVoiceScreenShareSession({
    cleanupScreenShareSessionFn: async (payload) => calls.push(['stop', payload]),
  });

  clearVoiceScreenShareError({
    setScreenShareErrorFn: (value) => calls.push(['clear-error', value]),
  });

  assert.deepEqual(calls, [
    ['error', null],
    ['ensure', 'Screen sharing'],
    ['picker', true],
    ['cancel-picker', false],
    ['cancel-error', null],
    ['stop', { emitShareState: true, playStopChime: true, clearError: true }],
    ['clear-error', null],
  ]);
});

test('voice screen share control flow action factory delegates all screen share actions through one lane context', async () => {
  const calls = [];
  const actions = createVoiceScreenShareActions({
    refs: {
      channelIdRef: { current: 'channel-7' },
      participantIdsRef: { current: ['user-7'] },
      deviceRef: { current: { id: 'device-7' } },
      screenShareRefs: {},
    },
    runtime: {
      setShowSourcePickerFn: (value) => calls.push(['picker', value]),
      setScreenShareErrorFn: (value) => calls.push(['error', value]),
      ensureSecureMediaReadyFn: (feature) => calls.push(['ensure', feature]),
      cleanupVoiceScreenShareSessionFn: async (payload) => calls.push(['cleanup', payload]),
    },
    constants: {
      screenShareProfiles: [{ id: 'profile-7' }],
      initialProfileIndex: 0,
      screenShareAudioMaxBitrate: 96000,
    },
    navigatorObject: {
      mediaDevices: {
        getDisplayMedia: async () => 'display-stream',
        getUserMedia: async () => 'audio-stream',
      },
    },
    runVoiceScreenShareStartFlowFn: async (payload) => {
      calls.push(['start-flow', payload.channelId, payload.sourceId]);
      return { started: true };
    },
  });

  const confirmResult = await actions.confirmScreenShare({
    sourceId: 'desktop-source-7',
    includeAudio: false,
  });
  actions.startScreenShare();
  actions.cancelSourcePicker();
  await actions.stopScreenShare();
  actions.clearScreenShareError();

  assert.deepEqual(confirmResult, { started: true });
  assert.deepEqual(calls, [
    ['picker', false],
    ['error', null],
    ['start-flow', 'channel-7', 'desktop-source-7'],
    ['error', null],
    ['ensure', 'Screen sharing'],
    ['picker', true],
    ['picker', false],
    ['error', null],
    ['cleanup', { emitShareState: true, playStopChime: true, clearError: true }],
    ['error', null],
  ]);
});
