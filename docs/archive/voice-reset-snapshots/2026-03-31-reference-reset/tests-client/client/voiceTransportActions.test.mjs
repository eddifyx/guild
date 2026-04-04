import test from 'node:test';
import assert from 'node:assert/strict';

import { createVoiceTransportActions } from '../../../client/src/features/voice/voiceTransportActions.mjs';

test('voice transport actions delegate transport setup, cleanup, and consume through one lane context', async () => {
  const calls = [];
  const refs = {
    deviceRef: { current: { id: 'device-1' } },
    sendTransportRef: { current: null },
    screenSendTransportRef: { current: { id: 'screen-existing', closed: false } },
    screenShareAudioProducerRef: { current: { id: 'audio-prod' } },
    screenShareProducerRef: { current: { id: 'screen-prod' } },
    screenShareStreamRef: { current: { id: 'stream-1' } },
    screenShareStatsRef: { current: { bitrate: 12 } },
    recvTransportRef: { current: { id: 'recv-transport' } },
    consumersRef: { current: new Map() },
    producerUserMapRef: { current: new Map() },
    producerMetaRef: { current: new Map() },
    screenShareVideosRef: { current: new Map() },
    audioElementsRef: { current: new Map() },
    deafenedRef: { current: false },
  };

  const actions = createVoiceTransportActions({
    refs,
    runtime: {
      emitAsyncFn: async (...args) => {
        calls.push(['emitAsync', ...args]);
        if (args[0] === 'voice:create-transport') {
          return { transportOptions: { id: `${args[1].direction}-${args[1].purpose || 'recv'}` } };
        }
        if (args[0] === 'voice:consume') {
          return {
            id: 'consumer-1',
            producerId: 'producer-1',
            kind: 'audio',
            rtpParameters: { codecs: [{ mimeType: 'audio/opus' }] },
          };
        }
        if (args[0] === 'voice:resume-consumer') {
          return {};
        }
        return {};
      },
      recordLaneDiagnosticFn: (...args) => calls.push(['lane', ...args]),
      socket: { id: 'socket-1' },
      resetScreenShareAdaptationFn: () => calls.push(['resetScreenShareAdaptation']),
      getCurrentChannelIdFn: () => 'channel-1',
      playStreamStopChimeFn: () => calls.push(['playStop']),
      setScreenSharingFn: (value) => calls.push(['setScreenSharing', value]),
      setScreenShareStreamFn: (value) => calls.push(['setScreenShareStream', value]),
      setScreenShareErrorFn: (value) => calls.push(['setScreenShareError', value]),
      setScreenShareDiagnosticsFn: (value) => calls.push(['setScreenShareDiagnostics', value]),
      cleanupRemoteProducerFn: (...args) => calls.push(['cleanupRemoteProducer', ...args]),
      syncIncomingScreenSharesFn: () => calls.push(['syncIncomingScreenShares']),
      updateVoiceDiagnosticsFn: (value) => calls.push(['updateVoiceDiagnostics', typeof value]),
      getPrimaryCodecMimeTypeFromRtpParametersFn: () => 'audio/opus',
      getExperimentalScreenVideoBypassModeFn: () => null,
      getVoiceAudioBypassModeFn: () => null,
      attachReceiverDecryptionFn: () => calls.push(['attachReceiverDecryption']),
      summarizeTrackSnapshotFn: (track) => track?.id ?? null,
      summarizeReceiverVideoCodecSupportFn: () => ({ opus: true }),
      mountRemoteAudioElementFn: () => calls.push(['mountRemoteAudio']),
      applyVoiceOutputDeviceFn: async () => calls.push(['applyOutputDevice']),
      readStoredVoiceOutputDeviceIdFn: () => 'default',
      setUserAudioEntryFn: (...args) => calls.push(['setUserAudioEntry', ...args]),
      readStoredUserVolumeFn: () => 0.8,
      attachVoiceConsumerPlaybackRuntimeFn: () => calls.push(['attachPlayback']),
      buildPlaybackErrorMessageFn: (error) => error?.message || '',
      mediaStreamCtor: class FakeStream {
        constructor(tracks) {
          this.tracks = tracks;
        }
      },
      audioCtor: class FakeAudio {
        constructor() {
          this.autoplay = false;
          this.playsInline = false;
          this.preload = '';
          this.muted = false;
          this.defaultMuted = false;
          this.volume = 1;
          this.srcObject = null;
        }
      },
      roundMsFn: (value) => value,
      performanceNowFn: (() => {
        let tick = 0;
        return () => (tick += 2);
      })(),
      nowIsoFn: () => '2026-03-25T00:00:00.000Z',
      insertableStreamsSupported: true,
      createClientVoiceSendTransportFn: ({ purpose }) => ({ id: `send-${purpose}` }),
      createClientVoiceRecvTransportFn: () => ({
        id: 'recv-created',
        consume: async () => ({
          paused: false,
          track: { id: 'audio-track' },
          rtpReceiver: { id: 'receiver-1' },
          resume() {},
        }),
      }),
    },
    constants: {
      voiceSafeMode: true,
      disableVoiceInsertableStreams: false,
    },
    currentUserId: 'user-self',
  });

  const sendTransport = await actions.createSendTransport('channel-1');
  const screenTransport = await actions.getOrCreateScreenSendTransport('channel-1');
  const recvTransport = await actions.createRecvTransport('channel-1');
  await actions.cleanupScreenShareSession({ emitShareState: true, playStopChime: true });
  await actions.consumeProducer('channel-1', 'producer-1', 'user-2', 'microphone');

  assert.equal(sendTransport.id, 'send-voice');
  assert.equal(screenTransport.id, 'screen-existing');
  assert.equal(recvTransport.id, 'recv-created');
  assert.equal(refs.sendTransportRef.current.id, 'send-voice');
  assert.equal(refs.recvTransportRef.current.id, 'recv-created');
  assert.equal(calls.some((entry) => entry[0] === 'emitAsync' && entry[1] === 'voice:create-transport'), true);
  assert.equal(calls.some((entry) => entry[0] === 'emitAsync' && entry[1] === 'voice:consume'), true);
  assert.equal(calls.some((entry) => entry[0] === 'playStop'), true);
});
