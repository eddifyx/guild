import test from 'node:test';
import assert from 'node:assert/strict';

import { startAppleVoiceProcessingLane } from '../../../client/src/features/voice/voiceAppleProcessing.mjs';

function createNode(label) {
  return {
    label,
    connections: [],
    connect(target) {
      this.connections.push(target);
    },
    disconnect() {
      this.disconnected = true;
    },
    port: {
      messages: [],
      postMessage(message, transfers = []) {
        this.messages.push({ message, transfers });
      },
    },
  };
}

test('voice Apple processing starts the helper, wires routing, and marks diagnostics ready', async () => {
  const frameListeners = [];
  const stateListeners = [];
  const routing = {
    processedMakeupGain: { gain: { value: 0 } },
    processedGain: createNode('processed'),
    processedReady: false,
  };
  const capture = {
    disposed: false,
  };
  const filterDiagnostics = {
    backend: 'apple',
    loaded: false,
    fallbackReason: 'old',
  };

  const result = await startAppleVoiceProcessingLane({
    capture,
    micCtx: {},
    micSource: createNode('mic'),
    gainNode: createNode('gain'),
    noiseSuppressionEnabled: true,
    filterDiagnostics,
    suppressionRuntimeBackend: 'apple',
    ensureVoiceCaptureBypassRoutingFn: () => routing,
    createApplePcmBridgeNodeFn: async () => createNode('apple-source'),
    normalizeElectronBinaryChunkFn: (chunk) => chunk,
    applyVoiceProcessingFallbackStateFn: () => {
      throw new Error('fallback should not be used in happy path');
    },
    applyNoiseSuppressionRoutingFn: (nextRouting, enabled) => {
      assert.equal(nextRouting, routing);
      assert.equal(enabled, true);
      return true;
    },
    startAppleVoiceCaptureFn: async () => ({ configuration: 'full-duplex' }),
    isAppleVoiceCaptureSupportedFn: async () => true,
    onAppleVoiceCaptureFrameFn: (handler) => {
      frameListeners.push(handler);
      return () => {};
    },
    onAppleVoiceCaptureStateFn: (handler) => {
      stateListeners.push(handler);
      return () => {};
    },
    withTimeoutFn: async (promise) => promise,
    nowFn: (() => {
      let tick = 0;
      return () => (tick += 6);
    })(),
    roundMsFn: (value) => value,
  });

  assert.equal(result.disposedBeforeReady, false);
  assert.equal(result.workletCreateMs, 6);
  assert.equal(routing.processedMakeupGain.gain.value, 1);
  assert.equal(routing.processedReady, true);
  assert.equal(capture.usesAppleVoiceProcessing, true);
  assert.equal(filterDiagnostics.loaded, true);
  assert.equal(filterDiagnostics.backend, 'apple');
  assert.equal(filterDiagnostics.fallbackReason, null);
  assert.equal(frameListeners.length, 1);
  assert.equal(stateListeners.length, 1);
  assert.equal(capture.appleVoiceSourceNode.connections[0], routing.processedGain);

  const chunk = new ArrayBuffer(16);
  frameListeners[0](chunk);
  assert.deepEqual(capture.appleVoiceSourceNode.port.messages, [{
    message: { type: 'push', samples: chunk },
    transfers: [chunk],
  }]);
});

test('voice Apple processing falls back to raw audio on helper error events for the active capture', async () => {
  let diagnostics = {
    liveCapture: {
      filter: {
        backend: 'apple',
        loaded: true,
        fallbackReason: null,
      },
    },
  };
  const fallbackCalls = [];
  const routing = {
    processedMakeupGain: { gain: { value: 0 } },
    processedGain: createNode('processed'),
    processedReady: false,
  };
  const capture = {
    disposed: false,
  };
  const liveCaptureRef = { current: capture };
  const appleVoiceAvailableRef = { current: true };
  let registeredStateHandler = null;

  await startAppleVoiceProcessingLane({
    capture,
    micCtx: {},
    micSource: createNode('mic'),
    gainNode: createNode('gain'),
    noiseSuppressionEnabled: true,
    filterDiagnostics: {
      backend: 'apple',
      loaded: false,
      fallbackReason: null,
    },
    suppressionRuntimeBackend: 'apple',
    liveCaptureRef,
    appleVoiceAvailableRef,
    ensureVoiceCaptureBypassRoutingFn: () => routing,
    createApplePcmBridgeNodeFn: async () => createNode('apple-source'),
    normalizeElectronBinaryChunkFn: (chunk) => chunk,
    getFriendlyAppleVoiceFallbackMessageFn: (message) => `friendly:${message}`,
    applyVoiceProcessingFallbackStateFn: (nextCapture, nextFilterDiagnostics, options) => {
      fallbackCalls.push([nextCapture, nextFilterDiagnostics, options]);
    },
    applyNoiseSuppressionRoutingFn: () => true,
    setLiveVoiceFallbackReasonFn: (value) => {
      diagnostics.liveFallbackReason = value;
    },
    updateVoiceDiagnosticsFn: (updater) => {
      diagnostics = updater(diagnostics);
    },
    startAppleVoiceCaptureFn: async () => ({ configuration: 'full-duplex' }),
    isAppleVoiceCaptureSupportedFn: async () => true,
    onAppleVoiceCaptureFrameFn: () => () => {},
    onAppleVoiceCaptureStateFn: (handler) => {
      registeredStateHandler = handler;
      return () => {};
    },
    withTimeoutFn: async (promise) => promise,
  });

  registeredStateHandler({ type: 'error', message: 'helper failed' });

  assert.equal(fallbackCalls.length, 1);
  assert.equal(diagnostics.liveFallbackReason, 'friendly:helper failed');
  assert.deepEqual(diagnostics.liveCapture.filter, {
    backend: 'raw',
    loaded: false,
    fallbackReason: 'friendly:helper failed',
  });

  registeredStateHandler({ type: 'unavailable', message: 'hardware unavailable' });
  assert.equal(appleVoiceAvailableRef.current, false);
});
