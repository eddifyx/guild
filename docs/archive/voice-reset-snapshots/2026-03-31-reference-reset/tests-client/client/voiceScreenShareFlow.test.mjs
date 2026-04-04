import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanupVoiceScreenShareSession,
  runVoiceScreenShareStartFlow,
} from '../../../client/src/features/voice/voiceScreenShareFlow.mjs';

function applyState(setter, nextValue) {
  setter(typeof nextValue === 'function' ? nextValue : () => nextValue);
}

test('voice screen share cleanup closes media refs and resets UI state', async () => {
  const calls = [];
  const stoppedTracks = [];
  const refs = {
    screenShareAudioProducerRef: {
      current: {
        close() {
          calls.push('close-audio-producer');
        },
      },
    },
    screenShareProducerRef: {
      current: {
        close() {
          calls.push('close-video-producer');
        },
      },
    },
    screenShareStreamRef: {
      current: {
        getTracks() {
          return [{
            stop() {
              stoppedTracks.push('track-1');
            },
          }];
        },
      },
    },
    screenSendTransportRef: {
      current: {
        close() {
          calls.push('close-transport');
        },
      },
    },
    screenShareStatsRef: { current: { bitrate: 10 } },
  };

  await cleanupVoiceScreenShareSession({
    refs,
    resetScreenShareAdaptationFn: () => calls.push('reset-adaptation'),
    setScreenSharingFn: (value) => calls.push(['set-sharing', value]),
    setScreenShareStreamFn: (value) => calls.push(['set-stream', value]),
    setScreenShareErrorFn: (value) => calls.push(['set-error', value]),
    setScreenShareDiagnosticsFn: (value) => calls.push(['set-diagnostics', value]),
    socket: {
      emit(eventName, payload) {
        calls.push(['emit', eventName, payload]);
      },
    },
    channelId: 'voice-1',
    emitShareState: true,
    playStopChime: true,
    playStreamStopChimeFn: () => calls.push('play-stop-chime'),
  });

  assert.equal(refs.screenShareAudioProducerRef.current, null);
  assert.equal(refs.screenShareProducerRef.current, null);
  assert.equal(refs.screenShareStreamRef.current, null);
  assert.equal(refs.screenSendTransportRef.current, null);
  assert.equal(refs.screenShareStatsRef.current, null);
  assert.deepEqual(stoppedTracks, ['track-1']);
  assert.equal(calls.includes('reset-adaptation'), true);
  assert.equal(calls.includes('play-stop-chime'), true);
  assert.deepEqual(calls.filter((entry) => Array.isArray(entry) && entry[0] === 'emit'), [[
    'emit',
    'voice:screen-share-state',
    { channelId: 'voice-1', sharing: false },
  ]]);
});

test('voice screen share start flow publishes video and marks sharing active', async () => {
  let diagnostics = null;
  const calls = [];
  const videoTrack = { id: 'video-track-1', contentHint: null, onended: null };
  const stream = {
    getVideoTracks() {
      return [videoTrack];
    },
    getAudioTracks() {
      return [];
    },
  };
  const refs = {
    screenShareStreamRef: { current: null },
    screenShareProducerRef: { current: null },
    screenShareAudioProducerRef: { current: null },
    screenShareSimulcastEnabledRef: { current: true },
  };

  const result = await runVoiceScreenShareStartFlow({
    channelId: 'voice-2',
    sourceId: 'source-1',
    includeAudio: false,
    participantIds: ['user-1', 'user-2'],
    device: { id: 'device-1' },
    refs,
    ensureSecureMediaReadyFn: (feature) => calls.push(['ensure', feature]),
    ensureVoiceKeyForParticipantsFn: async (...args) => calls.push(['ensure-key', ...args]),
    getOrCreateScreenSendTransportFn: async () => ({ id: 'screen-send-1', produce: async () => null }),
    getRuntimeScreenShareCodecModeFn: () => 'vp9',
    getPreferredScreenShareCodecCandidatesFn: () => [{ mimeType: 'video/VP9' }],
    screenShareProfiles: [{ id: 'initial-profile', fps: 30, maxBitrate: 1000 }],
    initialProfileIndex: 0,
    selectDesktopSourceFn: async (source) => calls.push(['select-source', source]),
    getDisplayMediaFn: async () => stream,
    resetScreenShareAdaptationFn: () => calls.push(['reset-adaptation']),
    applyPreferredScreenShareConstraintsFn: async (track, profile) => calls.push(['apply-constraints', track.id, profile.id]),
    setScreenShareStreamFn: (value) => calls.push(['set-stream', value]),
    setScreenShareDiagnosticsFn: (updater) => {
      diagnostics = typeof updater === 'function' ? updater(diagnostics) : updater;
    },
    setVoiceE2EFn: (value) => calls.push(['set-e2e', value]),
    setE2EWarningFn: (value) => calls.push(['set-warning', value]),
    setScreenShareErrorFn: (value) => calls.push(['set-error', value]),
    setScreenSharingFn: (value) => calls.push(['set-sharing', value]),
    playStreamStartChimeFn: () => calls.push(['play-start-chime']),
    cleanupVoiceScreenShareSessionFn: async () => calls.push(['cleanup']),
    publishScreenShareVideoProducerFn: async () => ({
      producer: { id: 'producer-1' },
      selectedScreenShareCodec: { mimeType: 'video/VP9' },
      screenVideoBypassMode: null,
      bypassScreenVideoEncryption: false,
      senderParameters: { encodings: [{ maxBitrate: 1000 }] },
    }),
    socket: {
      emit(eventName, payload) {
        calls.push(['emit', eventName, payload]);
      },
    },
    onVideoTrackEndedFn: () => calls.push(['track-ended']),
    summarizeSelectedCodecFn: (codec) => codec?.mimeType || null,
    summarizeTrackSnapshotFn: (track) => track?.id || null,
    summarizeScreenShareProfileFn: (profile) => profile?.id || null,
    summarizeScreenShareHardwareFn: () => ({ gpu: true }),
    summarizeSenderParametersFn: () => ({ bitrate: 'ok' }),
    getScreenShareRequestedCaptureFn: (profile) => profile?.id || null,
    nowIsoFn: () => '2026-03-25T12:00:00.000Z',
  });

  assert.deepEqual(result, { started: true });
  assert.equal(refs.screenShareStreamRef.current, stream);
  assert.deepEqual(refs.screenShareProducerRef.current, { id: 'producer-1' });
  assert.equal(refs.screenShareSimulcastEnabledRef.current, false);
  assert.equal(diagnostics.active, true);
  assert.equal(diagnostics.selectedCodec, 'video/VP9');
  assert.equal(diagnostics.e2eeMode, 'encrypted');
  assert.equal(diagnostics.senderParameters.bitrate, 'ok');
  assert.equal(videoTrack.contentHint, 'detail');
  assert.equal(typeof videoTrack.onended, 'function');
  assert.equal(calls.some((entry) => Array.isArray(entry) && entry[0] === 'cleanup'), false);
  assert.equal(calls.some((entry) => Array.isArray(entry) && entry[0] === 'play-start-chime'), true);
  assert.deepEqual(calls.filter((entry) => Array.isArray(entry) && entry[0] === 'emit'), [[
    'emit',
    'voice:screen-share-state',
    { channelId: 'voice-2', sharing: true },
  ]]);
});

test('voice screen share start flow cleans up and surfaces a failure message on non-cancelled errors', async () => {
  const calls = [];

  const result = await runVoiceScreenShareStartFlow({
    channelId: 'voice-3',
    refs: {
      screenShareStreamRef: { current: null },
      screenShareProducerRef: { current: null },
      screenShareAudioProducerRef: { current: null },
      screenShareSimulcastEnabledRef: { current: false },
    },
    ensureSecureMediaReadyFn: () => {},
    ensureVoiceKeyForParticipantsFn: async () => {},
    getOrCreateScreenSendTransportFn: async () => ({ id: 'screen-send-2' }),
    getRuntimeScreenShareCodecModeFn: () => 'auto',
    getPreferredScreenShareCodecCandidatesFn: () => [],
    screenShareProfiles: [{ id: 'initial-profile', fps: 30, maxBitrate: 1000 }],
    initialProfileIndex: 0,
    getDisplayMediaFn: async () => ({
      getVideoTracks() {
        return [];
      },
      getAudioTracks() {
        return [];
      },
    }),
    cleanupVoiceScreenShareSessionFn: async (options) => calls.push(['cleanup', options]),
    setScreenShareStreamFn: () => {},
    setScreenShareDiagnosticsFn: () => {},
    setVoiceE2EFn: () => {},
    setE2EWarningFn: () => {},
    setScreenShareErrorFn: (value) => calls.push(['set-error', value]),
    setScreenSharingFn: () => {},
    buildScreenShareStartErrorFn: async () => 'screen-share-start-failed',
    logScreenShareFailureContextFn: (payload) => calls.push(['log-failure', payload.hasMacAudioDevice]),
    warnFn: (...args) => calls.push(['warn', ...args]),
  });

  assert.equal(result.started, false);
  assert.equal(result.cancelled, false);
  assert.equal(result.error.message, 'Screen capture did not provide a video track.');
  assert.deepEqual(calls.filter((entry) => entry[0] === 'cleanup'), [[
    'cleanup',
    { emitShareState: false, playStopChime: false, clearError: false },
  ]]);
  assert.deepEqual(calls.filter((entry) => entry[0] === 'set-error'), [[
    'set-error',
    'screen-share-start-failed',
  ]]);
});
