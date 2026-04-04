import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildVoiceCaptureActionContract,
  buildVoiceLiveCaptureBindingsContract,
  buildVoiceMediaActionContract,
  buildVoiceScreenShareRuntimeBindingsContract,
  buildVoiceSecurityActionContract,
  buildUseVoicePublicApi,
  buildUseVoiceRuntimeEffectsContract,
  buildVoiceScreenShareActionContract,
  buildVoiceSessionActionContract,
  buildVoiceTransportActionContract,
  buildVoiceUiActionContract,
} from '../../../client/src/features/voice/voiceControllerRuntimeContracts.mjs';

test('voice controller runtime contracts build the canonical screen-share action contract', () => {
  const refs = {
    channelIdRef: { current: 'channel-1' },
    participantIdsRef: { current: ['user-1', 'user-2'] },
    deviceRef: { current: { id: 'device-1' } },
    screenShareStreamRef: { current: { id: 'stream-1' } },
    screenShareProducerRef: { current: { id: 'producer-1' } },
    screenShareAudioProducerRef: { current: { id: 'audio-producer-1' } },
    screenShareSimulcastEnabledRef: { current: true },
  };
  const runtime = {
    ensureSecureMediaReadyFn: () => {},
    ensureVoiceKeyForParticipantsFn: () => {},
    getOrCreateScreenSendTransportFn: () => {},
    setShowSourcePickerFn: () => {},
    setScreenShareErrorFn: () => {},
    socket: { id: 'socket-1' },
    onVideoTrackEndedFn: () => {},
  };
  const constants = {
    screenShareProfiles: [{ id: 'profile-1' }],
    initialProfileIndex: 0,
    screenShareAudioMaxBitrate: 96000,
  };

  const contract = buildVoiceScreenShareActionContract({
    refs,
    runtime,
    constants,
    getPlatformFn: () => 'darwin',
    runVoiceScreenShareStartFlowFn: async () => 'started',
  });

  assert.equal(contract.refs.channelIdRef, refs.channelIdRef);
  assert.equal(contract.refs.screenShareRefs.screenShareProducerRef, refs.screenShareProducerRef);
  assert.equal(contract.runtime.socket, runtime.socket);
  assert.equal(typeof contract.runtime.onVideoTrackEndedFn, 'function');
  assert.equal(contract.constants.initialProfileIndex, 0);
  assert.equal(contract.getPlatformFn(), 'darwin');
});

test('voice controller runtime contracts build the canonical runtime-effects contract', () => {
  const contract = buildUseVoiceRuntimeEffectsContract({
    state: {
      voiceProcessingMode: 'voice-focused',
      channelId: 'channel-2',
      muted: true,
      deafened: false,
      screenShareDiagnostics: { ok: true },
      screenSharing: true,
    },
    refs: {
      channelIdRef: { current: 'channel-2' },
      leaveChannelRef: { current: () => {} },
    },
    runtime: {
      socket: { id: 'socket-2' },
      currentUserId: 'user-1',
      setPeersFn: () => {},
      electronAPI: { getPlatform: () => 'darwin' },
      screenShareProfiles: [{ id: 'profile-1' }],
      clearTimeoutFn: () => {},
    },
  });

  assert.equal(contract.state.channelId, 'channel-2');
  assert.equal(contract.state.muted, true);
  assert.equal(contract.refs.leaveChannelRef.current instanceof Function, true);
  assert.equal(contract.runtime.socket.id, 'socket-2');
  assert.equal(contract.runtime.currentUserId, 'user-1');
  assert.deepEqual(contract.runtime.screenShareProfiles, [{ id: 'profile-1' }]);
});

test('voice controller runtime contracts build the canonical transport action contract', () => {
  const refs = {
    deviceRef: { current: { id: 'device-1' } },
    recvTransportRef: { current: { id: 'recv-1' } },
    consumersRef: { current: new Map() },
  };
  const runtime = {
    emitAsyncFn: async () => ({}),
    socket: { id: 'socket-3' },
    getCurrentChannelIdFn: () => 'channel-4',
    createClientVoiceRecvTransportFn: () => ({ id: 'transport-1' }),
  };
  const constants = {
    voiceSafeMode: true,
    disableVoiceInsertableStreams: false,
  };

  const contract = buildVoiceTransportActionContract({
    refs,
    runtime,
    constants,
    currentUserId: 'user-9',
  });

  assert.equal(contract.refs.deviceRef, refs.deviceRef);
  assert.equal(contract.runtime.socket.id, 'socket-3');
  assert.equal(contract.runtime.getCurrentChannelIdFn(), 'channel-4');
  assert.equal(contract.constants.voiceSafeMode, true);
  assert.equal(contract.currentUserId, 'user-9');
});

test('voice controller runtime contracts build the canonical media action contract', () => {
  const refs = {
    screenShareVideosRef: { current: new Map() },
    userAudioRef: { current: new Map() },
  };
  const runtime = {
    setIncomingScreenSharesFn: () => {},
    cleanupRemoteVoiceProducerFn: () => {},
  };

  const contract = buildVoiceMediaActionContract({
    refs,
    runtime,
  });

  assert.equal(contract.refs.screenShareVideosRef, refs.screenShareVideosRef);
  assert.equal(contract.runtime.cleanupRemoteVoiceProducerFn, runtime.cleanupRemoteVoiceProducerFn);
});

test('voice controller runtime contracts build the canonical security action contract', () => {
  const refs = {
    channelIdRef: { current: 'channel-7' },
    participantIdsRef: { current: ['user-1'] },
  };
  const setters = {
    setVoiceE2EFn: () => {},
    setJoinErrorFn: () => {},
  };
  const runtime = {
    socket: { id: 'socket-3b' },
    getVoiceKeyFn: () => 'voice-key',
  };

  const contract = buildVoiceSecurityActionContract({
    refs,
    setters,
    runtime,
    currentUserId: 'user-1',
    constants: { voiceSafeMode: true },
  });

  assert.equal(contract.refs.channelIdRef, refs.channelIdRef);
  assert.equal(contract.setters.setJoinErrorFn, setters.setJoinErrorFn);
  assert.equal(contract.runtime.socket.id, 'socket-3b');
  assert.equal(contract.currentUserId, 'user-1');
  assert.equal(contract.constants.voiceSafeMode, true);
});

test('voice controller runtime contracts build the canonical capture action contract', () => {
  const refs = {
    channelIdRef: { current: 'channel-8' },
    producerRef: { current: { id: 'producer-8' } },
  };
  const setters = {
    setSpeakingFn: () => {},
    setMutedFn: () => {},
  };
  const runtime = {
    socket: { id: 'socket-3c' },
    createLiveMicCaptureFn: async () => ({ id: 'capture-8' }),
  };

  const contract = buildVoiceCaptureActionContract({
    refs,
    setters,
    runtime,
    constants: { voiceMaxBitrate: 64000 },
  });

  assert.equal(contract.refs.producerRef, refs.producerRef);
  assert.equal(contract.setters.setMutedFn, setters.setMutedFn);
  assert.equal(contract.runtime.socket.id, 'socket-3c');
  assert.equal(contract.constants.voiceMaxBitrate, 64000);
});

test('voice controller runtime contracts build the canonical screen-share runtime bindings contract', () => {
  const refs = {
    screenShareStreamRef: { current: { id: 'stream-9' } },
    screenShareProducerRef: { current: { id: 'producer-9' } },
  };
  const setters = {
    setScreenShareDiagnosticsFn: () => {},
  };
  const runtime = {
    getRuntimeScreenShareCodecModeFn: () => 'vp9',
    warnFn: () => {},
  };

  const contract = buildVoiceScreenShareRuntimeBindingsContract({
    refs,
    setters,
    runtime,
    constants: {
      initialProfileIndex: 0,
      screenShareProfiles: [{ id: 'profile-9' }],
    },
  });

  assert.equal(contract.refs.screenShareStreamRef, refs.screenShareStreamRef);
  assert.equal(contract.setters.setScreenShareDiagnosticsFn, setters.setScreenShareDiagnosticsFn);
  assert.equal(contract.runtime.getRuntimeScreenShareCodecModeFn(), 'vp9');
  assert.deepEqual(contract.constants.screenShareProfiles, [{ id: 'profile-9' }]);
});

test('voice controller runtime contracts build the canonical live-capture bindings contract', () => {
  const refs = {
    liveCaptureRef: { current: { id: 'capture-9' } },
    appleVoiceAvailableRef: { current: true },
  };
  const setters = {
    setLiveVoiceFallbackReasonFn: () => {},
  };
  const runtime = {
    getStoredVoiceProcessingModeFn: () => 'standard',
    warnFn: () => {},
  };

  const contract = buildVoiceLiveCaptureBindingsContract({
    refs,
    setters,
    runtime,
    constants: {
      appleVoiceCaptureOwner: 'live-voice',
      appleVoiceLiveStartTimeoutMs: 3200,
    },
  });

  assert.equal(contract.refs.liveCaptureRef, refs.liveCaptureRef);
  assert.equal(contract.setters.setLiveVoiceFallbackReasonFn, setters.setLiveVoiceFallbackReasonFn);
  assert.equal(contract.runtime.getStoredVoiceProcessingModeFn(), 'standard');
  assert.equal(contract.constants.appleVoiceCaptureOwner, 'live-voice');
});

test('voice controller runtime contracts build the canonical session action contract', () => {
  const refs = {
    channelIdRef: { current: 'channel-5' },
    joinGenRef: { current: 3 },
  };
  const setters = {
    setChannelIdFn: () => {},
    setJoinErrorFn: () => {},
  };
  const runtime = {
    emitAsyncFn: async () => ({}),
    joinRuntime: {
      ensureSecureMediaReadyFn: async () => true,
    },
  };
  const constants = {
    voiceSessionErrorTimeoutMs: 9000,
  };

  const contract = buildVoiceSessionActionContract({
    socket: { id: 'socket-4' },
    refs,
    setters,
    runtime,
    constants,
  });

  assert.equal(contract.socket.id, 'socket-4');
  assert.equal(contract.refs.channelIdRef, refs.channelIdRef);
  assert.equal(contract.setters.setJoinErrorFn, setters.setJoinErrorFn);
  assert.equal(contract.runtime.joinRuntime.ensureSecureMediaReadyFn instanceof Function, true);
  assert.equal(contract.constants.voiceSessionErrorTimeoutMs, 9000);
});

test('voice controller runtime contracts build the canonical ui action contract', () => {
  const refs = {
    channelIdRef: { current: 'channel-6' },
    mutedRef: { current: false },
  };
  const setters = {
    setMutedFn: () => {},
    setVoiceProcessingModeStateFn: () => {},
  };
  const runtime = {
    socket: { id: 'socket-5' },
    clearVoiceHealthProbeFn: () => {},
  };

  const contract = buildVoiceUiActionContract({
    refs,
    setters,
    runtime,
  });

  assert.equal(contract.refs.channelIdRef, refs.channelIdRef);
  assert.equal(contract.setters.setMutedFn, setters.setMutedFn);
  assert.equal(contract.runtime.socket.id, 'socket-5');
});

test('voice controller runtime contracts build the stable public voice api shape', () => {
  const publicApi = buildUseVoicePublicApi({
    state: {
      channelId: 'channel-3',
      muted: false,
      deafened: true,
      speaking: false,
      peers: { user2: { muted: false } },
      joinError: null,
      voiceProcessingMode: 'standard',
      voiceDiagnostics: { updatedAt: 'now' },
      liveVoiceFallbackReason: null,
      screenSharing: true,
      screenShareStream: { id: 'stream-3' },
      screenShareDiagnostics: { fps: 30 },
      incomingScreenShares: [{ userId: 'user-2' }],
      showSourcePicker: true,
      screenShareError: null,
      voiceE2E: true,
      e2eWarning: null,
    },
    actions: {
      joinChannel: () => {},
      leaveChannel: () => {},
      toggleMute: () => {},
      toggleDeafen: () => {},
      setOutputDevice: () => {},
      setUserVolume: () => {},
      setMicGain: () => {},
      setVoiceProcessingMode: () => {},
      toggleNoiseSuppression: () => {},
      startScreenShare: () => {},
      stopScreenShare: () => {},
      confirmScreenShare: () => {},
      cancelSourcePicker: () => {},
      clearScreenShareError: () => {},
    },
  });

  assert.equal(publicApi.channelId, 'channel-3');
  assert.equal(publicApi.deafened, true);
  assert.equal(publicApi.screenSharing, true);
  assert.equal(publicApi.showSourcePicker, true);
  assert.equal(publicApi.voiceE2E, true);
  assert.equal(typeof publicApi.joinChannel, 'function');
  assert.equal(typeof publicApi.confirmScreenShare, 'function');
});
