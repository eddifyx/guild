import test from 'node:test';
import assert from 'node:assert/strict';

import { createVoiceSessionActions } from '../../../client/src/features/voice/voiceSessionActions.mjs';

test('voice session actions delegate reset, unexpected-end, join, and leave through one lane context', async () => {
  const calls = [];
  const refs = {
    voiceHealthProbeRetryCountRef: { current: 0 },
    pendingLiveReconfigureRef: { current: 44 },
    liveCaptureConfigGenRef: { current: 0 },
    vadIntervalRef: { current: null },
    noiseSuppressorNodeRef: { current: null },
    residualDenoiserNodeRef: { current: null },
    noiseGateNodeRef: { current: null },
    speechFocusChainRef: { current: null },
    keyboardSuppressorNodeRef: { current: null },
    noiseSuppressionRoutingRef: { current: null },
    appleVoiceFrameCleanupRef: { current: null },
    appleVoiceStateCleanupRef: { current: null },
    appleVoiceSourceNodeRef: { current: null },
    micAudioCtxRef: { current: null },
    micGainNodeRef: { current: null },
    localStreamRef: { current: null },
    screenShareAudioProducerRef: { current: null },
    screenShareProducerRef: { current: null },
    screenShareStreamRef: { current: null },
    screenShareStatsRef: { current: null },
    screenShareVideosRef: { current: new Map() },
    producerRef: { current: null },
    consumersRef: { current: new Map() },
    producerUserMapRef: { current: new Map() },
    producerMetaRef: { current: new Map() },
    audioElementsRef: { current: new Map() },
    userAudioRef: { current: new Map() },
    sendTransportRef: { current: null },
    screenSendTransportRef: { current: null },
    recvTransportRef: { current: null },
    deviceRef: { current: null },
    liveCaptureRef: { current: null },
    participantIdsRef: { current: [] },
    channelIdRef: { current: 'channel-1' },
    mutedBeforeDeafenRef: { current: null },
    joinGenRef: { current: 5 },
    pendingSecureVoiceJoinRef: { current: null },
    pendingVoiceModeSwitchTraceRef: { current: 'trace-1' },
  };
  let joinErrorState = null;

  const actions = createVoiceSessionActions({
    socket: { id: 'socket-1' },
    refs,
    setters: {
      setShowSourcePickerFn: () => calls.push(['setShowSourcePicker']),
      setScreenSharingFn: () => calls.push(['setScreenSharing']),
      setScreenShareStreamFn: () => calls.push(['setScreenShareStream']),
      setScreenShareErrorFn: () => calls.push(['setScreenShareError']),
      setScreenShareDiagnosticsFn: () => calls.push(['setScreenShareDiagnostics']),
      setIncomingScreenSharesFn: () => calls.push(['setIncomingScreenShares']),
      setChannelIdFn: () => calls.push(['setChannelId']),
      setVoiceChannelIdFn: () => calls.push(['setVoiceChannelId']),
      setVoiceChannelParticipantsFn: () => calls.push(['setVoiceChannelParticipants']),
      setJoinErrorFn: (value) => {
        joinErrorState = typeof value === 'function' ? value(joinErrorState) : value;
        calls.push(['setJoinError', joinErrorState]);
      },
      setVoiceE2EFn: () => calls.push(['setVoiceE2E']),
      setE2EWarningFn: () => calls.push(['setE2EWarning']),
      setLiveVoiceFallbackReasonFn: () => calls.push(['setFallback']),
      setMutedFn: () => calls.push(['setMuted']),
      setDeafenedFn: () => calls.push(['setDeafened']),
      setSpeakingFn: () => calls.push(['setSpeaking']),
      setPeersFn: () => calls.push(['setPeers']),
    },
    runtime: {
      emitAsyncFn: async (...args) => {
        calls.push(['emitAsync', ...args]);
        return {};
      },
      clearVoiceHealthProbeFn: () => calls.push(['clearHealthProbe']),
      stopAppleVoiceCaptureFn: () => calls.push(['stopApple']),
      resetScreenShareAdaptationFn: () => calls.push(['resetScreenShareAdaptation']),
      clearVoiceKeyFn: () => calls.push(['clearVoiceKey']),
      updateVoiceDiagnosticsFn: (value) => calls.push(['updateVoiceDiagnostics', typeof value]),
      advanceJoinGenerationFn: () => {
        refs.joinGenRef.current += 1;
        calls.push(['advanceJoinGeneration', refs.joinGenRef.current]);
      },
      setTimeoutFn: (callback, delayMs) => {
        calls.push(['timeout', delayMs]);
        callback();
      },
      playLeaveChimeFn: () => calls.push(['playLeaveChime']),
      clearTimeoutFn: (value) => calls.push(['clearTimeout', value]),
      cancelPerfTraceFn: (...args) => calls.push(['cancelTrace', ...args]),
      joinRuntime: {
        setJoinErrorFn: (value) => calls.push(['joinRuntime:setJoinError', value]),
        setE2EWarningFn: (value) => calls.push(['joinRuntime:setE2EWarning', value]),
        setLiveVoiceFallbackReasonFn: (value) => calls.push(['joinRuntime:setFallback', value]),
        recordLaneDiagnosticFn: (...args) => calls.push(['lane', ...args]),
        runVoiceJoinFlowFn: async (payload) => {
          calls.push(['joinFlow', payload.joinGen, payload.chId]);
          return { ready: true, aborted: false };
        },
        ensureSecureMediaReadyFn: async () => calls.push(['ensureSecureMediaReady']),
        rememberUsersFn: () => calls.push(['rememberUsers']),
        getUntrustedVoiceParticipantsFn: () => [],
        buildVoiceTrustErrorFn: () => 'trust failed',
        deviceCtor: class FakeDevice {},
        setDeviceFn: () => calls.push(['setDevice']),
        createSendTransportFn: async () => calls.push(['createSendTransport']),
        createRecvTransportFn: async () => calls.push(['createRecvTransport']),
        setChannelIdFn: () => calls.push(['joinRuntime:setChannelId']),
        setDeafenedFn: () => calls.push(['joinRuntime:setDeafened']),
        setVoiceChannelIdFn: () => calls.push(['joinRuntime:setVoiceChannelId']),
        syncVoiceParticipantsFn: async () => calls.push(['syncVoiceParticipants']),
        getVoiceParticipantIdsFn: () => [],
        updateVoiceDiagnosticsFn: () => calls.push(['joinRuntime:updateVoiceDiagnostics']),
        consumeProducerFn: async () => calls.push(['consumeProducer']),
        syncVoiceE2EStateFn: async () => calls.push(['syncVoiceE2EState']),
        playConnectChimeFn: () => calls.push(['playConnectChime']),
        getPlatformFn: () => 'darwin',
        prefetchDesktopSourcesFn: () => calls.push(['prefetchDesktopSources']),
        applyLiveCaptureToProducerFn: async () => calls.push(['applyLiveCapture']),
        setMutedFn: () => calls.push(['joinRuntime:setMuted']),
        clearVoiceHealthProbeFn: () => calls.push(['joinRuntime:clearHealthProbe']),
        scheduleVoiceHealthProbeFn: () => calls.push(['scheduleVoiceHealthProbe']),
        isExpectedVoiceTeardownErrorFn: () => false,
        normalizeVoiceErrorMessageFn: (error) => error?.message || '',
        scheduleClearJoinErrorFn: (callback, delayMs) => {
          calls.push(['scheduleClearJoinError', delayMs]);
          callback();
        },
        logErrorFn: (...args) => calls.push(['log', ...args]),
      },
    },
    constants: {
      voiceSessionErrorTimeoutMs: 8000,
      appleVoiceCaptureOwner: 'live-voice',
      resetControlState: { muted: false, deafened: false },
    },
  });

  await actions.resetVoiceSession({ notifyServer: true });
  await actions.handleUnexpectedVoiceSessionEnd('transport closed', { channelId: 'channel-1' });
  const joinResult = await actions.joinChannel('channel-2');
  await actions.leaveChannel();

  assert.deepEqual(joinResult, { ready: true, aborted: false });
  assert.equal(refs.pendingSecureVoiceJoinRef.current, null);
  assert.equal(calls.some((entry) => entry[0] === 'emitAsync' && entry[1] === 'voice:leave'), true);
  assert.equal(calls.some((entry) => entry[0] === 'joinFlow'), true);
  assert.equal(calls.some((entry) => entry[0] === 'playLeaveChime'), true);
  assert.equal(calls.some((entry) => entry[0] === 'timeout' && entry[1] === 8000), true);
});

test('voice session actions remember secure-voice pending joins for late-key recovery', async () => {
  const refs = {
    joinGenRef: { current: 0 },
    channelIdRef: { current: null },
    voiceHealthProbeRetryCountRef: { current: 0 },
    pendingSecureVoiceJoinRef: { current: null },
  };

  const actions = createVoiceSessionActions({
    socket: { id: 'socket-1' },
    refs,
    setters: {},
    runtime: {
      joinRuntime: {
        runVoiceJoinFlowFn: async () => ({
          ready: false,
          aborted: false,
          reason: 'secure_voice_unavailable',
          existingProducers: [{ producerId: 'producer-1', producerUserId: 'user-2', source: 'microphone' }],
        }),
      },
    },
  });

  const joinResult = await actions.joinChannel('channel-late-key');

  assert.equal(joinResult.reason, 'secure_voice_unavailable');
  assert.deepEqual(refs.pendingSecureVoiceJoinRef.current, {
    channelId: 'channel-late-key',
    existingProducers: [{ producerId: 'producer-1', producerUserId: 'user-2', source: 'microphone' }],
    forcedMutedForSecureVoice: true,
  });
});

test('voice session actions immediately resume pending secure media when the key already arrived', async () => {
  const refs = {
    joinGenRef: { current: 0 },
    channelIdRef: { current: null },
    voiceHealthProbeRetryCountRef: { current: 0 },
    pendingSecureVoiceJoinRef: { current: null },
  };
  const calls = [];

  const actions = createVoiceSessionActions({
    socket: { id: 'socket-1' },
    refs,
    setters: {},
    runtime: {
      joinRuntime: {
        runVoiceJoinFlowFn: async () => ({
          ready: false,
          aborted: false,
          reason: 'secure_voice_unavailable',
          existingProducers: [{ producerId: 'producer-2', producerUserId: 'user-3', source: 'microphone' }],
        }),
        getCurrentVoiceKeyFn: () => ({ epoch: 2048, key: new Uint8Array(32) }),
        resumeVoiceMediaAfterKeyUpdateFn: async (payload) => {
          calls.push(['resume', payload]);
          refs.pendingSecureVoiceJoinRef.current = null;
          return { resumed: true };
        },
      },
    },
  });

  const joinResult = await actions.joinChannel('channel-early-key');

  assert.equal(joinResult.reason, 'secure_voice_unavailable');
  assert.equal(refs.pendingSecureVoiceJoinRef.current, null);
  assert.deepEqual(calls, [[
    'resume',
    { channelId: 'channel-early-key' },
  ]]);
});
