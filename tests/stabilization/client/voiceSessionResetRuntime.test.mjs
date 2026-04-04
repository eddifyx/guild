import test from 'node:test';
import assert from 'node:assert/strict';

import { resetVoiceSessionRuntime } from '../../../client/src/features/voice/voiceSessionResetRuntime.mjs';

function createRef(initialValue = null) {
  return { current: initialValue };
}

test('voice session reset runtime tears down transports, media, diagnostics, and control state', async () => {
  const calls = [];
  let diagnostics = {
    session: { active: true, channelId: 'channel-1' },
    senderStats: { bitrate: 1234 },
    screenShare: { active: true },
    consumers: { 'producer-1': { playback: { state: 'playing' } } },
  };

  const refs = {
    voiceHealthProbeRetryCountRef: createRef(3),
    pendingLiveReconfigureRef: createRef(77),
    liveCaptureConfigGenRef: createRef(4),
    vadIntervalRef: createRef(88),
    noiseSuppressorNodeRef: createRef({
      destroy: () => calls.push('rnnoise-destroy'),
      disconnect: () => calls.push('rnnoise-disconnect'),
    }),
    residualDenoiserNodeRef: createRef({
      destroy: () => calls.push('speex-destroy'),
      disconnect: () => calls.push('speex-disconnect'),
    }),
    noiseGateNodeRef: createRef({
      disconnect: () => calls.push('gate-disconnect'),
    }),
    speechFocusChainRef: createRef({
      disconnect: () => calls.push('focus-disconnect'),
    }),
    keyboardSuppressorNodeRef: createRef({
      disconnect: () => calls.push('keyboard-disconnect'),
    }),
    noiseSuppressionRoutingRef: createRef({ id: 'routing' }),
    appleVoiceFrameCleanupRef: createRef(() => calls.push('apple-frame-cleanup')),
    appleVoiceStateCleanupRef: createRef(() => calls.push('apple-state-cleanup')),
    appleVoiceSourceNodeRef: createRef({
      port: {
        postMessage: (payload) => calls.push(`apple-${payload.type}`),
      },
      disconnect: () => calls.push('apple-disconnect'),
    }),
    micAudioCtxRef: createRef({
      close: () => ({ catch: () => calls.push('audioctx-close') }),
    }),
    micGainNodeRef: createRef({ id: 'gain' }),
    localStreamRef: createRef({
      getTracks: () => [{ stop: () => calls.push('local-track-stop') }],
    }),
    screenShareAudioProducerRef: createRef({
      close: () => calls.push('screen-audio-producer-close'),
    }),
    screenShareProducerRef: createRef({
      close: () => calls.push('screen-producer-close'),
    }),
    screenShareStreamRef: createRef({
      getTracks: () => [{ stop: () => calls.push('screen-track-stop') }],
    }),
    screenShareStatsRef: createRef({ id: 'stats' }),
    screenShareVideosRef: createRef(new Map([['screen-1', { id: 'screen-1' }]])),
    producerRef: createRef({
      close: () => calls.push('producer-close'),
    }),
    consumersRef: createRef(new Map([
      ['consumer-1', { close: () => calls.push('consumer-close') }],
    ])),
    producerUserMapRef: createRef(new Map([['producer-1', 'user-1']])),
    producerMetaRef: createRef(new Map([['producer-1', { id: 'meta' }]])),
    audioElementsRef: createRef(new Map([
      ['audio-1', {
        _voiceRetryCleanup: () => calls.push('audio-retry-cleanup'),
        _voiceMediaCleanup: () => calls.push('audio-media-cleanup'),
        pause: () => calls.push('audio-pause'),
        srcObject: { id: 'src' },
        parentNode: {
          removeChild: () => calls.push('audio-remove-child'),
        },
      }],
    ])),
    userAudioRef: createRef(new Map([['user-1', new Map([['audio-1', {}]])]])),
    sendTransportRef: createRef({
      close: () => calls.push('send-transport-close'),
    }),
    screenSendTransportRef: createRef({
      close: () => calls.push('screen-send-transport-close'),
    }),
    recvTransportRef: createRef({
      close: () => calls.push('recv-transport-close'),
    }),
    deviceRef: createRef({ id: 'device-1' }),
    liveCaptureRef: createRef({ id: 'capture-1' }),
    participantIdsRef: createRef(['user-1', 'user-2']),
    channelIdRef: createRef('channel-1'),
    mutedBeforeDeafenRef: createRef(false),
  };

  const setterCalls = [];

  await resetVoiceSessionRuntime({
    targetChannelId: 'channel-1',
    notifyServer: true,
    socket: { id: 'socket-1' },
    emitAsyncFn: async (eventName, payload) => {
      calls.push([eventName, payload]);
    },
    clearVoiceHealthProbeFn: () => calls.push('health-probe-clear'),
    clearTimeoutFn: (token) => calls.push(['clear-timeout', token]),
    clearIntervalFn: (token) => calls.push(['clear-interval', token]),
    stopAppleVoiceCaptureFn: async (owner) => calls.push(['stop-apple', owner]),
    appleVoiceCaptureOwner: 'LIVE_VOICE',
    nowIsoFn: () => '2026-03-25T12:00:00.000Z',
    refs,
    resetScreenShareAdaptationFn: () => calls.push('screen-adaptation-reset'),
    clearVoiceKeyFn: () => calls.push('voice-key-clear'),
    setShowSourcePickerFn: (value) => setterCalls.push(['showSourcePicker', value]),
    setScreenSharingFn: (value) => setterCalls.push(['screenSharing', value]),
    setScreenShareStreamFn: (value) => setterCalls.push(['screenShareStream', value]),
    setScreenShareErrorFn: (value) => setterCalls.push(['screenShareError', value]),
    setScreenShareDiagnosticsFn: (value) => setterCalls.push(['screenShareDiagnostics', value]),
    setIncomingScreenSharesFn: (value) => setterCalls.push(['incomingScreenShares', value]),
    setChannelIdFn: (value) => setterCalls.push(['channelId', value]),
    setVoiceChannelIdFn: (value) => setterCalls.push(['voiceChannelId', value]),
    setVoiceChannelParticipantsFn: (value) => setterCalls.push(['voiceChannelParticipants', value]),
    setJoinErrorFn: (value) => setterCalls.push(['joinError', value]),
    setVoiceE2EFn: (value) => setterCalls.push(['voiceE2E', value]),
    setE2EWarningFn: (value) => setterCalls.push(['e2eWarning', value]),
    setLiveVoiceFallbackReasonFn: (value) => setterCalls.push(['liveVoiceFallbackReason', value]),
    updateVoiceDiagnosticsFn: (updater) => {
      diagnostics = updater(diagnostics);
    },
    setMutedFn: (value) => setterCalls.push(['muted', value]),
    setDeafenedFn: (value) => setterCalls.push(['deafened', value]),
    setSpeakingFn: (value) => setterCalls.push(['speaking', value]),
    setPeersFn: (value) => setterCalls.push(['peers', value]),
    resetControlState: {
      muted: true,
      deafened: false,
      mutedBeforeDeafen: true,
      speaking: false,
    },
  });

  assert.equal(refs.voiceHealthProbeRetryCountRef.current, 0);
  assert.equal(refs.pendingLiveReconfigureRef.current, null);
  assert.equal(refs.liveCaptureConfigGenRef.current, 5);
  assert.equal(refs.vadIntervalRef.current, null);
  assert.equal(refs.sendTransportRef.current, null);
  assert.equal(refs.recvTransportRef.current, null);
  assert.equal(refs.screenSendTransportRef.current, null);
  assert.equal(refs.channelIdRef.current, null);
  assert.deepEqual(refs.participantIdsRef.current, []);
  assert.equal(refs.mutedBeforeDeafenRef.current, true);
  assert.deepEqual(diagnostics, {
    session: {
      active: false,
      channelId: 'channel-1',
      endedAt: '2026-03-25T12:00:00.000Z',
    },
    senderStats: null,
    screenShare: null,
    consumers: {},
  });
  assert.deepEqual(calls.filter(Array.isArray), [
    ['clear-timeout', 77],
    ['clear-interval', 88],
    ['stop-apple', 'LIVE_VOICE'],
    ['voice:leave', { channelId: 'channel-1' }],
  ]);
  assert.deepEqual(setterCalls, [
    ['showSourcePicker', false],
    ['screenSharing', false],
    ['screenShareStream', null],
    ['screenShareError', null],
    ['screenShareDiagnostics', null],
    ['incomingScreenShares', []],
    ['channelId', null],
    ['voiceChannelId', null],
    ['voiceChannelParticipants', []],
    ['joinError', null],
    ['voiceE2E', false],
    ['e2eWarning', null],
    ['liveVoiceFallbackReason', null],
    ['muted', true],
    ['deafened', false],
    ['speaking', false],
    ['peers', {}],
  ]);
});
