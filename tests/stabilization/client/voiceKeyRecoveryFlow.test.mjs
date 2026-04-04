import test from 'node:test';
import assert from 'node:assert/strict';

import { resumeVoiceMediaAfterKeyUpdateFlow } from '../../../client/src/features/voice/voiceKeyRecoveryFlow.mjs';

test('voice key recovery flow resumes pending media work after a late key arrives', async () => {
  const calls = [];
  const refs = {
    channelIdRef: { current: 'channel-1' },
    consumersRef: { current: new Map() },
    producerMetaRef: { current: new Map() },
    producerRef: { current: null },
    liveCaptureRef: { current: null },
    sendTransportRef: { current: { id: 'send-1' } },
    voiceHealthProbeRetryCountRef: { current: 4 },
    mutedRef: { current: true },
  };

  const result = await resumeVoiceMediaAfterKeyUpdateFlow({
    channelId: 'channel-1',
    refs,
    pendingSecureVoiceJoin: {
      channelId: 'channel-1',
      existingProducers: [{ producerId: 'producer-1', producerUserId: 'user-2', source: 'microphone' }],
      forcedMutedForSecureVoice: true,
    },
    consumeProducerFn: async (...args) => {
      calls.push(['consume', ...args]);
      refs.consumersRef.current.set('producer-1', { id: 'consumer-1' });
    },
    cleanupRemoteProducerFn: (...args) => calls.push(['cleanup', ...args]),
    applyLiveCaptureToProducerFn: async (payload) => {
      calls.push(['applyLiveCapture', payload]);
      refs.producerRef.current = { id: 'producer-local' };
      refs.liveCaptureRef.current = { id: 'capture-local' };
      return refs.liveCaptureRef.current;
    },
    scheduleVoiceHealthProbeFn: (...args) => calls.push(['scheduleProbe', ...args]),
    setMutedFn: (value) => calls.push(['setMuted', value]),
    updateVoiceDiagnosticsFn: () => calls.push(['updateDiagnostics']),
    recordLaneDiagnosticFn: (...args) => calls.push(['diagnostic', ...args]),
    nowIsoFn: () => '2026-03-31T12:00:00.000Z',
  });

  assert.deepEqual(result, {
    resumed: true,
    recoveredProducerCount: 1,
    localCaptureReady: true,
  });
  assert.equal(refs.mutedRef.current, false);
  assert.equal(refs.voiceHealthProbeRetryCountRef.current, 0);
  assert.deepEqual(calls, [
    ['setMuted', false],
    ['consume', 'channel-1', 'producer-1', 'user-2', 'microphone'],
    ['applyLiveCapture', { chId: 'channel-1', sendTransport: { id: 'send-1' } }],
    ['scheduleProbe', 'channel-1', { reason: 'secure-key-recovery' }],
    ['diagnostic', 'voice', 'secure_voice_media_resumed', { channelId: 'channel-1', recoveredProducerCount: 1 }],
    ['updateDiagnostics'],
  ]);
});

test('voice key recovery flow ignores channels without pending secure media work', async () => {
  const result = await resumeVoiceMediaAfterKeyUpdateFlow({
    channelId: 'channel-2',
    refs: {
      channelIdRef: { current: 'channel-2' },
    },
    pendingSecureVoiceJoin: null,
  });

  assert.deepEqual(result, {
    resumed: false,
    reason: 'no-pending-secure-join',
  });
});

test('voice key recovery flow rebuilds existing remote consumers after a late key arrives', async () => {
  const calls = [];
  const refs = {
    channelIdRef: { current: 'channel-2' },
    consumersRef: { current: new Map([['producer-remote', { id: 'consumer-old' }]]) },
    producerMetaRef: {
      current: new Map([[
        'producer-remote',
        { userId: 'user-2', source: 'microphone' },
      ]]),
    },
    producerRef: { current: { id: 'producer-local' } },
    liveCaptureRef: { current: { id: 'capture-local' } },
    sendTransportRef: { current: { id: 'send-2' } },
    voiceHealthProbeRetryCountRef: { current: 1 },
    mutedRef: { current: false },
  };

  const result = await resumeVoiceMediaAfterKeyUpdateFlow({
    channelId: 'channel-2',
    refs,
    pendingSecureVoiceJoin: null,
    cleanupRemoteProducerFn: (...args) => {
      calls.push(['cleanup', ...args]);
      refs.consumersRef.current.delete('producer-remote');
    },
    consumeProducerFn: async (...args) => {
      calls.push(['consume', ...args]);
      refs.consumersRef.current.set('producer-remote', { id: 'consumer-new' });
    },
    applyLiveCaptureToProducerFn: async () => {
      calls.push(['applyLiveCapture']);
      return refs.liveCaptureRef.current;
    },
    scheduleVoiceHealthProbeFn: (...args) => calls.push(['scheduleProbe', ...args]),
    setMutedFn: (value) => calls.push(['setMuted', value]),
    updateVoiceDiagnosticsFn: () => calls.push(['updateDiagnostics']),
    recordLaneDiagnosticFn: (...args) => calls.push(['diagnostic', ...args]),
    nowIsoFn: () => '2026-03-31T12:05:00.000Z',
  });

  assert.deepEqual(result, {
    resumed: true,
    recoveredProducerCount: 1,
    localCaptureReady: true,
  });
  assert.deepEqual(calls, [
    ['cleanup', 'producer-remote', { producerUserId: 'user-2', source: 'microphone' }],
    ['consume', 'channel-2', 'producer-remote', 'user-2', 'microphone'],
    ['scheduleProbe', 'channel-2', { reason: 'secure-key-recovery' }],
    ['diagnostic', 'voice', 'secure_voice_media_resumed', { channelId: 'channel-2', recoveredProducerCount: 1 }],
    ['updateDiagnostics'],
  ]);
});

test('voice key recovery flow clears forced secure mute and resumes an existing local producer without rebuilding capture', async () => {
  const calls = [];
  const refs = {
    channelIdRef: { current: 'channel-3' },
    consumersRef: { current: new Map() },
    producerMetaRef: { current: new Map() },
    producerRef: {
      current: {
        id: 'producer-local',
        resume: () => calls.push(['resumeProducer']),
      },
    },
    liveCaptureRef: { current: { id: 'capture-local' } },
    sendTransportRef: { current: { id: 'send-3' } },
    voiceHealthProbeRetryCountRef: { current: 2 },
    mutedRef: { current: true },
  };

  const result = await resumeVoiceMediaAfterKeyUpdateFlow({
    channelId: 'channel-3',
    refs,
    pendingSecureVoiceJoin: {
      channelId: 'channel-3',
      existingProducers: [],
      forcedMutedForSecureVoice: true,
    },
    applyLiveCaptureToProducerFn: async () => {
      calls.push(['applyLiveCapture']);
      return refs.liveCaptureRef.current;
    },
    scheduleVoiceHealthProbeFn: (...args) => calls.push(['scheduleProbe', ...args]),
    setMutedFn: (value) => calls.push(['setMuted', value]),
    updateVoiceDiagnosticsFn: () => calls.push(['updateDiagnostics']),
    recordLaneDiagnosticFn: (...args) => calls.push(['diagnostic', ...args]),
    nowIsoFn: () => '2026-03-31T12:10:00.000Z',
  });

  assert.deepEqual(result, {
    resumed: true,
    recoveredProducerCount: 0,
    localCaptureReady: true,
  });
  assert.equal(refs.mutedRef.current, false);
  assert.equal(refs.voiceHealthProbeRetryCountRef.current, 0);
  assert.deepEqual(calls, [
    ['setMuted', false],
    ['resumeProducer'],
    ['scheduleProbe', 'channel-3', { reason: 'secure-key-recovery' }],
    ['diagnostic', 'voice', 'secure_voice_media_resumed', { channelId: 'channel-3', recoveredProducerCount: 0 }],
    ['updateDiagnostics'],
  ]);
});
