import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyVoiceLiveCaptureProducer,
  attachLiveCaptureProducer,
  buildVoiceProducerCodecOptions,
} from '../../../client/src/features/voice/voiceProducerFlow.mjs';

test('voice producer flow builds opus codec options with FEC and optional DTX', () => {
  assert.deepEqual(buildVoiceProducerCodecOptions({
    voiceMaxBitrate: 72_000,
    disableOpusDtx: false,
  }), {
    opusFec: true,
    opusPtime: 20,
    opusMaxAverageBitrate: 72_000,
    opusDtx: true,
  });

  assert.deepEqual(buildVoiceProducerCodecOptions({
    voiceMaxBitrate: 48_000,
    disableOpusDtx: true,
  }), {
    opusFec: true,
    opusPtime: 20,
    opusMaxAverageBitrate: 48_000,
  });
});

test('voice producer flow replaces the current track when a producer already exists', async () => {
  const replacementCalls = [];
  const previousProducer = {
    async replaceTrack(payload) {
      replacementCalls.push(payload);
    },
  };

  const result = await attachLiveCaptureProducer({
    previousProducer,
    nextCapture: {
      outputTrack: { id: 'track-1' },
    },
    nowFn: (() => {
      let tick = 0;
      return () => (tick += 5);
    })(),
    roundMsFn: (value) => value,
  });

  assert.equal(result.producer, previousProducer);
  assert.equal(result.producerOperation, 'replaceTrack');
  assert.equal(result.producerOpMs, 5);
  assert.deepEqual(replacementCalls, [
    { track: { id: 'track-1' } },
  ]);
});

test('voice producer flow creates a new producer, applies sender preferences, and attaches encryption', async () => {
  const senderPreferenceCalls = [];
  const senderEncryptionCalls = [];
  const produceCalls = [];
  const rtpSender = { id: 'sender-1' };
  const producer = { id: 'producer-1', rtpSender };

  const result = await attachLiveCaptureProducer({
    nextCapture: {
      outputTrack: { id: 'track-2' },
    },
    nextDiagnostics: {
      mode: 'rnnoise',
    },
    sendTransport: {
      async produce(payload) {
        produceCalls.push(payload);
        return producer;
      },
    },
    voiceMaxBitrate: 80_000,
    disableOpusDtx: false,
    getVoiceAudioBypassModeFn: () => null,
    applySenderPreferencesFn: async (sender, options) => {
      senderPreferenceCalls.push([sender, options]);
    },
    attachSenderEncryptionFn: (sender, options) => {
      senderEncryptionCalls.push([sender, options]);
    },
    nowFn: (() => {
      let tick = 0;
      return () => (tick += 7);
    })(),
    roundMsFn: (value) => value,
  });

  assert.equal(result.producer, producer);
  assert.equal(result.producerOperation, 'produce');
  assert.equal(result.producerOpMs, 7);
  assert.equal(result.bypassVoiceAudioEncryption, false);
  assert.equal(result.voiceAudioBypassMode, null);
  assert.equal(produceCalls.length, 1);
  assert.deepEqual(produceCalls[0], {
    track: { id: 'track-2' },
    codecOptions: {
      opusFec: true,
      opusPtime: 20,
      opusMaxAverageBitrate: 80_000,
      opusDtx: true,
    },
    appData: {
      source: 'microphone',
      processingMode: 'rnnoise',
    },
  });
  assert.deepEqual(senderPreferenceCalls, [[rtpSender, {
    maxBitrate: 80_000,
    priority: 'high',
    networkPriority: 'high',
  }]]);
  assert.deepEqual(senderEncryptionCalls, [[rtpSender, {
    kind: 'audio',
    codecMimeType: 'audio/opus',
  }]]);
});

test('voice producer flow allows bypass mode without an RTP sender', async () => {
  const producer = { id: 'producer-2', rtpSender: null };

  const result = await attachLiveCaptureProducer({
    nextCapture: {
      outputTrack: { id: 'track-3' },
    },
    sendTransport: {
      async produce() {
        return producer;
      },
    },
    getVoiceAudioBypassModeFn: () => 'bypassed-hotfix-voice-audio',
  });

  assert.equal(result.producer, producer);
  assert.equal(result.bypassVoiceAudioEncryption, true);
  assert.equal(result.voiceAudioBypassMode, 'bypassed-hotfix-voice-audio');
});

test('voice producer flow bypasses sender encryption when voice safe mode is enabled', async () => {
  const senderEncryptionCalls = [];
  const producer = {
    id: 'producer-safe',
    rtpSender: { id: 'sender-safe' },
  };

  const result = await attachLiveCaptureProducer({
    nextCapture: {
      outputTrack: { id: 'track-safe' },
    },
    sendTransport: {
      async produce() {
        return producer;
      },
    },
    voiceSafeMode: true,
    getVoiceAudioBypassModeFn: ({ voiceSafeMode: nextVoiceSafeMode }) => (
      nextVoiceSafeMode ? 'bypassed-voice-safe-mode' : null
    ),
    attachSenderEncryptionFn: () => {
      senderEncryptionCalls.push('encrypt');
    },
  });

  assert.equal(result.bypassVoiceAudioEncryption, true);
  assert.equal(result.voiceAudioBypassMode, 'bypassed-voice-safe-mode');
  assert.deepEqual(senderEncryptionCalls, []);
});

test('voice producer flow rejects missing RTP sender when encryption is required', async () => {
  await assert.rejects(
    attachLiveCaptureProducer({
      nextCapture: {
        outputTrack: { id: 'track-4' },
      },
      sendTransport: {
        async produce() {
          return { id: 'producer-3', rtpSender: null };
        },
      },
      getVoiceAudioBypassModeFn: () => null,
    }),
    /secure media transforms could not attach/i
  );
});

test('voice producer flow rejects send transports that expose an RTP sender but cannot attach secure transforms', async () => {
  await assert.rejects(
    attachLiveCaptureProducer({
      nextCapture: {
        outputTrack: { id: 'track-5' },
      },
      sendTransport: {
        async produce() {
          return { id: 'producer-4', rtpSender: { id: 'sender-4' } };
        },
      },
      getVoiceAudioBypassModeFn: () => null,
      attachSenderEncryptionFn: () => false,
    }),
    /secure media transforms could not attach/i
  );
});

test('voice producer flow returns no capture and updates diagnostics when capture creation fails without an existing producer', async () => {
  const calls = [];
  let diagnostics = {};

  const result = await applyVoiceLiveCaptureProducer({
    chId: 'channel-5',
    perfTraceId: 'trace-5',
    refs: {
      liveCaptureConfigGenRef: { current: 0 },
      liveCaptureRef: { current: null },
      producerRef: { current: null },
      sendTransportRef: { current: null },
      channelIdRef: { current: 'channel-5' },
      pendingVoiceModeSwitchTraceRef: { current: 'trace-5' },
      mutedRef: { current: false },
    },
    createLiveMicCaptureFn: async () => ({
      capture: null,
      diagnostics: {
        mode: 'standard',
        filter: { backend: 'rnnoise', fallbackReason: 'device-missing' },
      },
    }),
    updateVoiceDiagnosticsFn: (updater) => {
      diagnostics = updater(diagnostics);
    },
    setLiveVoiceFallbackReasonFn: (value) => calls.push(['fallback', value]),
    setMutedFn: (value) => calls.push(['muted', value]),
    addPerfPhaseFn: (...args) => calls.push(['phase', ...args]),
    endPerfTraceFn: (...args) => calls.push(['end', ...args]),
  });

  assert.equal(result, null);
  assert.deepEqual(diagnostics.liveCapture, {
    mode: 'standard',
    filter: { backend: 'rnnoise', fallbackReason: 'device-missing' },
  });
  assert.deepEqual(calls.filter((entry) => entry[0] === 'muted'), [['muted', true]]);
  assert.deepEqual(calls.find((entry) => entry[0] === 'end'), [
    'end',
    'trace-5',
    { status: 'no-capture', backend: 'rnnoise', fallbackReason: 'device-missing' },
  ]);
});

test('voice producer flow attaches capture, syncs refs, and updates timings when the producer succeeds', async () => {
  const calls = [];
  let diagnostics = {};
  const previousCapture = { id: 'old-capture', stream: { id: 'shared-stream' }, ownsStream: true };
  const nextCapture = {
    id: 'new-capture',
    stream: previousCapture.stream,
    ownsStream: false,
    vadNode: { id: 'vad-1' },
    gainNode: { id: 'gain-1' },
  };
  const producer = {
    pauseCalled: 0,
    resumeCalled: 0,
    pause() {
      this.pauseCalled += 1;
    },
    resume() {
      this.resumeCalled += 1;
    },
  };

  const result = await applyVoiceLiveCaptureProducer({
    chId: 'channel-6',
    perfTraceId: 'trace-6',
    refs: {
      liveCaptureConfigGenRef: { current: 0 },
      liveCaptureRef: { current: previousCapture },
      producerRef: { current: null },
      sendTransportRef: { current: { id: 'send-1' } },
      channelIdRef: { current: 'channel-6' },
      pendingVoiceModeSwitchTraceRef: { current: 'trace-6' },
      mutedRef: { current: false },
    },
    createLiveMicCaptureFn: async () => ({
      capture: nextCapture,
      diagnostics: {
        mode: 'rnnoise',
        filter: { backend: 'rnnoise', fallbackReason: null },
        timingsMs: { setup: 4 },
      },
    }),
    attachLiveCaptureProducerFn: async () => ({
      producer,
      producerOperation: 'produce',
      producerOpMs: 8,
    }),
    disposeLiveCaptureFn: async (capture) => calls.push(['dispose', capture.id]),
    syncLiveCaptureRefsFn: (capture) => calls.push(['sync', capture.id]),
    updateVoiceDiagnosticsFn: (updater) => {
      diagnostics = updater(diagnostics);
    },
    setLiveVoiceFallbackReasonFn: (value) => calls.push(['fallback', value]),
    startVadFn: (gainNode) => calls.push(['vad', gainNode.id]),
    setMutedFn: (value) => calls.push(['muted', value]),
    addPerfPhaseFn: (...args) => calls.push(['phase', ...args]),
    endPerfTraceFn: (...args) => calls.push(['end', ...args]),
  });

  assert.equal(result, nextCapture);
  assert.equal(previousCapture.ownsStream, false);
  assert.equal(nextCapture.ownsStream, true);
  assert.equal(producer.resumeCalled, 1);
  assert.deepEqual(diagnostics.liveCapture, {
    mode: 'rnnoise',
    filter: { backend: 'rnnoise', fallbackReason: null },
    timingsMs: { setup: 4, produce: 8, replaceTrack: null },
  });
  assert.equal(calls.some((entry) => entry[0] === 'sync'), true);
  assert.equal(calls.some((entry) => entry[0] === 'vad'), true);
  assert.equal(calls.some((entry) => entry[0] === 'vad' && entry[1] === 'vad-1'), true);
  assert.equal(calls.some((entry) => entry[0] === 'dispose' && entry[1] === 'old-capture'), true);
});
