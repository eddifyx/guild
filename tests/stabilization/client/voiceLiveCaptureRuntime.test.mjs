import test from 'node:test';
import assert from 'node:assert/strict';

import {
  disposeVoiceLiveCapture,
  syncVoiceLiveCaptureRefs,
} from '../../../client/src/features/voice/voiceLiveCaptureRuntime.mjs';

function createRef(initialValue = null) {
  return { current: initialValue };
}

test('voice live capture runtime syncs all capture refs from the active capture', () => {
  const refs = {
    liveCaptureRef: createRef(),
    localStreamRef: createRef(),
    micAudioCtxRef: createRef(),
    micGainNodeRef: createRef(),
    noiseSuppressorNodeRef: createRef(),
    residualDenoiserNodeRef: createRef(),
    noiseGateNodeRef: createRef(),
    speechFocusChainRef: createRef(),
    keyboardSuppressorNodeRef: createRef(),
    noiseSuppressionRoutingRef: createRef(),
    appleVoiceFrameCleanupRef: createRef(),
    appleVoiceStateCleanupRef: createRef(),
    appleVoiceSourceNodeRef: createRef(),
  };
  const capture = {
    stream: { id: 'stream-1' },
    micCtx: { id: 'ctx-1' },
    gainNode: { id: 'gain-1' },
    noiseSuppressorNode: { id: 'rnnoise-1' },
    residualDenoiserNode: { id: 'speex-1' },
    noiseGateNode: { id: 'gate-1' },
    speechFocusChain: { id: 'focus-1' },
    keyboardSuppressorNode: { id: 'keyboard-1' },
    routing: { id: 'routing-1' },
    appleVoiceFrameCleanup: () => {},
    appleVoiceStateCleanup: () => {},
    appleVoiceSourceNode: { id: 'apple-1' },
  };

  syncVoiceLiveCaptureRefs(refs, capture);

  assert.equal(refs.liveCaptureRef.current, capture);
  assert.equal(refs.localStreamRef.current, capture.stream);
  assert.equal(refs.micAudioCtxRef.current, capture.micCtx);
  assert.equal(refs.appleVoiceSourceNodeRef.current, capture.appleVoiceSourceNode);
});

test('voice live capture runtime disposes capture resources and optionally releases Apple ownership', async () => {
  const cleanupCalls = [];
  const stopCalls = [];
  const trackStopCalls = [];
  const capture = {
    disposed: false,
    appleVoiceFrameCleanup: () => cleanupCalls.push('apple-frame'),
    appleVoiceStateCleanup: () => cleanupCalls.push('apple-state'),
    appleVoiceSourceNode: {
      disconnect: () => cleanupCalls.push('apple-disconnect'),
      port: {
        postMessage: (message) => cleanupCalls.push(message.type),
      },
    },
    noiseSuppressorNode: {
      destroy: () => cleanupCalls.push('rnnoise-destroy'),
      disconnect: () => cleanupCalls.push('rnnoise-disconnect'),
    },
    residualDenoiserNode: {
      destroy: () => cleanupCalls.push('speex-destroy'),
      disconnect: () => cleanupCalls.push('speex-disconnect'),
    },
    noiseGateNode: {
      disconnect: () => cleanupCalls.push('gate-disconnect'),
    },
    speechFocusChain: {
      disconnect: () => cleanupCalls.push('focus-disconnect'),
    },
    keyboardSuppressorNode: {
      disconnect: () => cleanupCalls.push('keyboard-disconnect'),
    },
    micCtx: {
      close: async () => cleanupCalls.push('ctx-close'),
    },
    stream: {
      getTracks() {
        return [{
          stop: () => trackStopCalls.push('track-stop'),
        }];
      },
    },
    ownsStream: true,
    usesAppleVoiceProcessing: true,
  };

  await disposeVoiceLiveCapture(capture, {
    releaseOwner: true,
    stopAppleVoiceCaptureFn: async (owner) => stopCalls.push(owner),
    appleVoiceCaptureOwner: 'LIVE_VOICE',
  });

  assert.equal(capture.disposed, true);
  assert.equal(capture.stream, null);
  assert.equal(capture.micCtx, null);
  assert.equal(capture.appleVoiceSourceNode, null);
  assert.deepEqual(trackStopCalls, ['track-stop']);
  assert.deepEqual(stopCalls, ['LIVE_VOICE']);
  assert.deepEqual(cleanupCalls, [
    'apple-frame',
    'apple-state',
    'reset',
    'apple-disconnect',
    'rnnoise-destroy',
    'rnnoise-disconnect',
    'speex-destroy',
    'speex-disconnect',
    'gate-disconnect',
    'focus-disconnect',
    'keyboard-disconnect',
    'ctx-close',
  ]);
});

test('voice live capture runtime is a no-op for null or already disposed captures', async () => {
  await disposeVoiceLiveCapture(null);

  const capture = { disposed: true };
  await disposeVoiceLiveCapture(capture);

  assert.equal(capture.disposed, true);
});
