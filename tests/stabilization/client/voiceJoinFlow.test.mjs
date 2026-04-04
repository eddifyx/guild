import test from 'node:test';
import assert from 'node:assert/strict';

import { runVoiceJoinFlow } from '../../../client/src/features/voice/voiceJoinFlow.mjs';

class FakeDevice {
  constructor() {
    this.loaded = [];
  }

  async load(payload) {
    this.loaded.push(payload);
  }
}

test('voice join flow boots a session and marks it ready when local capture succeeds', async () => {
  let diagnostics = {};
  const calls = [];
  const retryRef = { current: 9 };
  let deviceSet = null;
  const result = await runVoiceJoinFlow({
    chId: 'channel-1',
    joinGen: 1,
    getCurrentJoinGenFn: () => 1,
    currentChannelId: null,
    ensureSecureMediaReadyFn: (feature) => calls.push(['ensure', feature]),
    emitAsyncFn: async () => ({
      rtpCapabilities: { codecs: [{ mimeType: 'audio/opus' }] },
      existingProducers: [{ producerId: 'producer-1', producerUserId: 'user-2', source: 'microphone' }],
      participants: [{ userId: 'user-1' }, { userId: 'user-2' }],
    }),
    recordLaneDiagnosticFn: (...args) => calls.push(args),
    rememberUsersFn: (participants) => calls.push(['remember', participants.length]),
    getUntrustedVoiceParticipantsFn: () => [],
    deviceCtor: FakeDevice,
    setDeviceFn: (device) => {
      deviceSet = device;
    },
    createSendTransportFn: async () => ({ id: 'send-1' }),
    createRecvTransportFn: async () => ({ id: 'recv-1' }),
    setChannelIdFn: (value) => calls.push(['setChannelId', value]),
    setDeafenedFn: (value) => calls.push(['setDeafened', value]),
    setVoiceChannelIdFn: (value) => calls.push(['setVoiceChannelId', value]),
    setE2EWarningFn: (value) => calls.push(['setE2EWarning', value]),
    syncVoiceParticipantsFn: async (participants, options) => calls.push(['syncParticipants', participants.length, options.channelId]),
    getVoiceParticipantIdsFn: (participants) => participants.map((participant) => participant.userId),
    updateVoiceDiagnosticsFn: (updater) => {
      diagnostics = updater(diagnostics);
    },
    consumeProducerFn: async (...args) => calls.push(['consume', ...args]),
    syncVoiceE2EStateFn: async (...args) => {
      calls.push(['syncE2E', ...args]);
      return { epoch: 1 };
    },
    playConnectChimeFn: () => calls.push(['playConnectChime']),
    getPlatformFn: () => 'win32',
    prefetchDesktopSourcesFn: () => calls.push(['prefetchDesktopSources']),
    applyLiveCaptureToProducerFn: async () => ({ id: 'capture-1' }),
    setMutedFn: (value) => calls.push(['setMuted', value]),
    clearVoiceHealthProbeFn: () => calls.push(['clearHealth']),
    voiceHealthProbeRetryCountRef: retryRef,
    scheduleVoiceHealthProbeFn: (...args) => calls.push(['scheduleProbe', ...args]),
    nowIsoFn: () => '2026-03-25T12:00:00.000Z',
  });

  assert.equal(result.aborted, false);
  assert.equal(result.ready, true);
  assert.ok(deviceSet instanceof FakeDevice);
  assert.equal(retryRef.current, 0);
  assert.equal(result.participantIds.length, 2);
  assert.deepEqual(diagnostics.session, {
    active: true,
    channelId: 'channel-1',
    joinedAt: '2026-03-25T12:00:00.000Z',
    participantCount: 2,
    existingProducerCount: 1,
  });
  assert.deepEqual(calls.filter((entry) => entry[0] === 'scheduleProbe'), [
    ['scheduleProbe', 'channel-1', { reason: 'join' }],
  ]);
  assert.equal(calls.findIndex((entry) => entry[0] === 'syncE2E') < calls.findIndex((entry) => entry[0] === 'consume'), true);
  assert.equal(calls.some((entry) => entry[0] === 'playConnectChime'), true);
  assert.equal(calls.some((entry) => entry[0] === 'prefetchDesktopSources'), true);
});

test('voice join flow marks local capture unavailable without failing the join', async () => {
  const calls = [];
  const retryRef = { current: 3 };

  const result = await runVoiceJoinFlow({
    chId: 'channel-2',
    joinGen: 1,
    getCurrentJoinGenFn: () => 1,
    ensureSecureMediaReadyFn: () => {},
    emitAsyncFn: async () => ({
      rtpCapabilities: { codecs: [] },
      existingProducers: [],
      participants: [{ userId: 'user-1' }],
    }),
    recordLaneDiagnosticFn: (...args) => calls.push(args),
    rememberUsersFn: () => {},
    getUntrustedVoiceParticipantsFn: () => [],
    deviceCtor: FakeDevice,
    setDeviceFn: () => {},
    createSendTransportFn: async () => ({ id: 'send-2' }),
    createRecvTransportFn: async () => ({ id: 'recv-2' }),
    setChannelIdFn: () => {},
    setDeafenedFn: () => {},
    setVoiceChannelIdFn: () => {},
    setE2EWarningFn: () => {},
    syncVoiceParticipantsFn: async () => {},
    getVoiceParticipantIdsFn: () => ['user-1'],
    updateVoiceDiagnosticsFn: () => {},
    consumeProducerFn: async () => {},
    syncVoiceE2EStateFn: () => {},
    playConnectChimeFn: () => {},
    getPlatformFn: () => 'darwin',
    prefetchDesktopSourcesFn: () => calls.push(['prefetchDesktopSources']),
    applyLiveCaptureToProducerFn: async () => null,
    setMutedFn: (value) => calls.push(['setMuted', value]),
    clearVoiceHealthProbeFn: () => calls.push(['clearHealth']),
    voiceHealthProbeRetryCountRef: retryRef,
    scheduleVoiceHealthProbeFn: () => calls.push(['scheduleProbe']),
  });

  assert.equal(result.aborted, false);
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'local_capture_unavailable');
  assert.equal(retryRef.current, 0);
  assert.deepEqual(calls.filter((entry) => entry[0] === 'setMuted'), [['setMuted', true]]);
  assert.equal(calls.some((entry) => entry[1] === 'local_capture_unavailable'), true);
  assert.equal(calls.some((entry) => entry[0] === 'scheduleProbe'), false);
});

test('voice join flow does not start media when secure voice is unavailable for a multi-user channel', async () => {
  const calls = [];
  const retryRef = { current: 2 };

  const result = await runVoiceJoinFlow({
    chId: 'channel-secure',
    joinGen: 1,
    getCurrentJoinGenFn: () => 1,
    ensureSecureMediaReadyFn: () => {},
    emitAsyncFn: async () => ({
      rtpCapabilities: { codecs: [{ mimeType: 'audio/opus' }] },
      existingProducers: [{ producerId: 'producer-1', producerUserId: 'user-2', source: 'microphone' }],
      participants: [{ userId: 'user-1' }, { userId: 'user-2' }],
    }),
    recordLaneDiagnosticFn: (...args) => calls.push(args),
    rememberUsersFn: () => {},
    getUntrustedVoiceParticipantsFn: () => [],
    deviceCtor: FakeDevice,
    setDeviceFn: () => {},
    createSendTransportFn: async () => ({ id: 'send-secure' }),
    createRecvTransportFn: async () => ({ id: 'recv-secure' }),
    setChannelIdFn: () => {},
    setDeafenedFn: () => {},
    setVoiceChannelIdFn: () => {},
    setE2EWarningFn: () => {},
    syncVoiceParticipantsFn: async () => {},
    getVoiceParticipantIdsFn: (participants) => participants.map((participant) => participant.userId),
    updateVoiceDiagnosticsFn: () => {},
    consumeProducerFn: async () => calls.push(['consume']),
    syncVoiceE2EStateFn: async () => null,
    playConnectChimeFn: () => calls.push(['playConnectChime']),
    getPlatformFn: () => 'darwin',
    prefetchDesktopSourcesFn: () => calls.push(['prefetchDesktopSources']),
    applyLiveCaptureToProducerFn: async () => {
      calls.push(['localCapture']);
      return { id: 'capture-secure' };
    },
    setMutedFn: (value) => calls.push(['setMuted', value]),
    clearVoiceHealthProbeFn: () => calls.push(['clearHealth']),
    voiceHealthProbeRetryCountRef: retryRef,
    scheduleVoiceHealthProbeFn: () => calls.push(['scheduleProbe']),
  });

  assert.equal(result.ready, false);
  assert.equal(result.reason, 'secure_voice_unavailable');
  assert.equal(retryRef.current, 0);
  assert.equal(calls.some((entry) => entry[0] === 'consume'), false);
  assert.equal(calls.some((entry) => entry[0] === 'localCapture'), false);
  assert.deepEqual(calls.filter((entry) => entry[0] === 'setMuted'), [['setMuted', true]]);
  assert.equal(calls.some((entry) => entry[1] === 'secure_voice_unavailable'), true);
});

test('voice join flow aborts cleanly when the join generation changes mid-flight', async () => {
  let currentJoinGen = 1;

  const result = await runVoiceJoinFlow({
    chId: 'channel-3',
    joinGen: 1,
    getCurrentJoinGenFn: () => currentJoinGen,
    ensureSecureMediaReadyFn: () => {},
    emitAsyncFn: async () => ({
      rtpCapabilities: { codecs: [] },
      existingProducers: [],
      participants: [{ userId: 'user-1' }],
    }),
    recordLaneDiagnosticFn: () => {},
    rememberUsersFn: () => {
      currentJoinGen = 2;
    },
    getUntrustedVoiceParticipantsFn: () => [],
    deviceCtor: FakeDevice,
    setDeviceFn: () => {},
  });

  assert.deepEqual(result, {
    aborted: true,
    phase: 'after-join-ack',
  });
});

test('voice join flow throws when participants are untrusted', async () => {
  await assert.rejects(() => runVoiceJoinFlow({
    chId: 'channel-4',
    joinGen: 1,
    getCurrentJoinGenFn: () => 1,
    ensureSecureMediaReadyFn: () => {},
    emitAsyncFn: async () => ({
      rtpCapabilities: { codecs: [] },
      existingProducers: [],
      participants: [{ userId: 'user-2', untrusted: true }],
    }),
    recordLaneDiagnosticFn: () => {},
    rememberUsersFn: () => {},
    getUntrustedVoiceParticipantsFn: (participants) => participants.filter((participant) => participant.untrusted),
    buildVoiceTrustErrorFn: () => 'waiting for trust',
    deviceCtor: FakeDevice,
    setDeviceFn: () => {},
  }), /waiting for trust/);
});

test('voice join flow rejects invalid join acknowledgements before touching media state', async () => {
  await assert.rejects(() => runVoiceJoinFlow({
    chId: 'channel-5',
    joinGen: 1,
    getCurrentJoinGenFn: () => 1,
    ensureSecureMediaReadyFn: () => {},
    emitAsyncFn: async () => null,
    recordLaneDiagnosticFn: () => {},
    rememberUsersFn: () => {},
    getUntrustedVoiceParticipantsFn: () => [],
    deviceCtor: FakeDevice,
    setDeviceFn: () => {},
  }), /Voice server did not return a valid join response/);
});
