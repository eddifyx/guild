import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyVoiceProcessingFallbackState,
  cleanupAppleVoiceProcessingLane,
  startRnnoiseVoiceProcessingLane,
} from '../../../client/src/features/voice/voiceLiveCaptureProcessing.mjs';

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
    destroy() {
      this.destroyed = true;
    },
    gain: { value: null },
  };
}

test('voice live capture processing cleans up the Apple lane and optionally releases ownership', async () => {
  const cleanupCalls = [];
  const stopCalls = [];
  const capture = {
    appleVoiceFrameCleanup: () => cleanupCalls.push('frame'),
    appleVoiceStateCleanup: () => cleanupCalls.push('state'),
    appleVoiceSourceNode: {
      disconnect: () => cleanupCalls.push('disconnect'),
      port: {
        postMessage: (message) => cleanupCalls.push(message.type),
      },
    },
    usesAppleVoiceProcessing: true,
  };

  await cleanupAppleVoiceProcessingLane(capture, {
    releaseOwner: true,
    stopAppleVoiceCaptureFn: async (owner) => stopCalls.push(owner),
    appleVoiceCaptureOwner: 'LIVE_VOICE',
  });

  assert.deepEqual(cleanupCalls, ['frame', 'state', 'reset', 'disconnect']);
  assert.deepEqual(stopCalls, ['LIVE_VOICE']);
  assert.equal(capture.appleVoiceSourceNode, null);
  assert.equal(capture.usesAppleVoiceProcessing, false);
});

test('voice live capture processing applies fallback state to diagnostics and routing', () => {
  const routingCalls = [];
  const capture = {
    routing: {
      processedReady: true,
    },
  };
  const filterDiagnostics = {
    backend: 'rnnoise',
    loaded: true,
    fallbackReason: null,
  };

  applyVoiceProcessingFallbackState(capture, filterDiagnostics, {
    fallbackReason: 'RNNoise failed',
    noiseSuppressionEnabled: true,
    applyNoiseSuppressionRoutingFn: (routing, enabled) => {
      routingCalls.push([routing, enabled]);
    },
  });

  assert.equal(capture.routing.processedReady, false);
  assert.deepEqual(filterDiagnostics, {
    backend: 'raw',
    loaded: false,
    fallbackReason: 'RNNoise failed',
  });
  assert.equal(routingCalls.length, 1);
});

test('voice live capture processing starts the RNNoise lane and wires the graph', async () => {
  const capture = {
    disposed: false,
  };
  const micSource = createNode('mic');
  const routing = {
    processedMakeupGain: createNode('makeup'),
    processedGain: createNode('processed'),
    processedReady: false,
  };
  const filterDiagnostics = {
    backend: 'rnnoise',
    loaded: false,
    fallbackReason: 'old',
  };
  const applyRoutingCalls = [];

  const rnnoiseNode = createNode('rnnoise');
  const speexNode = createNode('speex');
  const gateNode = createNode('gate');
  const speechFocusChain = {
    input: createNode('focus-input'),
    output: createNode('focus-output'),
    disconnect() {
      this.disconnected = true;
    },
  };
  const keyboardNode = createNode('keyboard');

  const result = await startRnnoiseVoiceProcessingLane({
    capture,
    micCtx: {},
    micSource,
    routing,
    noiseSuppressionEnabled: true,
    suppressionRuntimeBackend: 'rnnoise',
    filterDiagnostics,
    applyNoiseSuppressionRoutingFn: (nextRouting, enabled) => {
      applyRoutingCalls.push([nextRouting, enabled]);
      return true;
    },
    createRnnoiseNodeFn: async () => rnnoiseNode,
    createSpeexNodeFn: async () => speexNode,
    createNoiseGateNodeFn: async () => gateNode,
    createSpeechFocusChainFn: () => speechFocusChain,
    createKeyboardSuppressorNodeFn: async () => keyboardNode,
    rnnoiseSendMakeupGain: 2.4,
    nowFn: (() => {
      let tick = 0;
      return () => (tick += 5);
    })(),
    roundMsFn: (value) => value,
  });

  assert.equal(result.started, true);
  assert.equal(result.workletCreateMs, 5);
  assert.equal(routing.processedMakeupGain.gain.value, 2.4);
  assert.equal(routing.processedReady, true);
  assert.equal(capture.noiseSuppressorNode, rnnoiseNode);
  assert.equal(capture.residualDenoiserNode, speexNode);
  assert.equal(capture.noiseGateNode, gateNode);
  assert.equal(capture.speechFocusChain, speechFocusChain);
  assert.equal(capture.keyboardSuppressorNode, keyboardNode);
  assert.deepEqual(filterDiagnostics, {
    backend: 'rnnoise',
    loaded: true,
    fallbackReason: null,
  });
  assert.equal(applyRoutingCalls.length, 1);
  assert.deepEqual(micSource.connections, [rnnoiseNode]);
  assert.deepEqual(rnnoiseNode.connections, [speexNode]);
  assert.deepEqual(speexNode.connections, [gateNode]);
  assert.deepEqual(gateNode.connections, [speechFocusChain.input]);
  assert.deepEqual(speechFocusChain.output.connections, [keyboardNode]);
  assert.deepEqual(keyboardNode.connections, [routing.processedGain]);
});

test('voice live capture processing bypasses optional keyboard suppressor worklet failures', async () => {
  const capture = {
    disposed: false,
  };
  const micSource = createNode('mic');
  const routing = {
    processedMakeupGain: createNode('makeup'),
    processedGain: createNode('processed'),
    processedReady: false,
  };
  const filterDiagnostics = {
    backend: 'rnnoise',
    loaded: false,
    fallbackReason: 'old',
  };
  const applyRoutingCalls = [];

  const rnnoiseNode = createNode('rnnoise');
  const speexNode = createNode('speex');
  const gateNode = createNode('gate');
  const speechFocusChain = {
    input: createNode('focus-input'),
    output: createNode('focus-output'),
    disconnect() {
      this.disconnected = true;
    },
  };

  const result = await startRnnoiseVoiceProcessingLane({
    capture,
    micCtx: { state: 'running' },
    micSource,
    routing,
    noiseSuppressionEnabled: true,
    suppressionRuntimeBackend: 'rnnoise',
    filterDiagnostics,
    applyNoiseSuppressionRoutingFn: (nextRouting, enabled) => {
      applyRoutingCalls.push([nextRouting, enabled]);
      return true;
    },
    createRnnoiseNodeFn: async () => rnnoiseNode,
    createSpeexNodeFn: async () => speexNode,
    createNoiseGateNodeFn: async () => gateNode,
    createSpeechFocusChainFn: () => speechFocusChain,
    createKeyboardSuppressorNodeFn: async () => {
      throw new Error("AudioWorkletNode cannot be created: No execution context available.");
    },
    rnnoiseSendMakeupGain: 2.4,
    nowFn: (() => {
      let tick = 0;
      return () => (tick += 5);
    })(),
    roundMsFn: (value) => value,
  });

  assert.equal(result.started, true);
  assert.equal(routing.processedReady, true);
  assert.equal(capture.keyboardSuppressorNode, null);
  assert.deepEqual(filterDiagnostics, {
    backend: 'rnnoise',
    loaded: true,
    fallbackReason: null,
  });
  assert.equal(applyRoutingCalls.length, 1);
  assert.deepEqual(gateNode.connections, [speechFocusChain.input]);
  assert.deepEqual(speechFocusChain.output.connections, [routing.processedGain]);
});
