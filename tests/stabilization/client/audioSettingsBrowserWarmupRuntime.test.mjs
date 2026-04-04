import test from 'node:test';
import assert from 'node:assert/strict';

import { warmupAudioSettingsRnnoiseTestLane } from '../../../client/src/features/voice/audioSettingsBrowserWarmupRuntime.mjs';

test('audio settings browser warmup runtime enables processed RNNoise monitoring when available', async () => {
  const sourceConnections = [];
  const perfPhases = [];
  let diagnostics = {
    filter: {
      backend: 'raw',
      loaded: false,
    },
  };

  const rnnoiseNode = {
    connect(target) {
      sourceConnections.push(['rnnoise', target]);
    },
    destroy() {},
  };
  const speexNode = {
    connect(target) {
      sourceConnections.push(['speex', target]);
    },
    destroy() {},
  };
  const noiseGateNode = {
    connect(target) {
      sourceConnections.push(['noiseGate', target]);
    },
    disconnect() {},
  };
  const speechFocusChain = {
    input: { id: 'speech-input' },
    output: {
      connect(target) {
        sourceConnections.push(['speechOutput', target]);
      },
    },
    disconnect() {},
  };
  const keyboardSuppressorNode = {
    connect(target) {
      sourceConnections.push(['keyboard', target]);
    },
    disconnect() {},
  };

  const refs = {
    testRunIdRef: { current: 5 },
    audioCtxRef: { current: { id: 'ctx' } },
    processingModeRef: { current: 'standard' },
    noiseSuppressionRef: { current: true },
    noiseSuppressorNodeRef: { current: null },
    residualDenoiserNodeRef: { current: null },
    noiseGateNodeRef: { current: null },
    speechFocusChainRef: { current: null },
    keyboardSuppressorNodeRef: { current: null },
    noiseSuppressionRoutingRef: {
      current: {
        processedGain: { id: 'processed-gain' },
        processedReady: false,
      },
    },
  };

  const source = {
    connect(target) {
      sourceConnections.push(['source', target]);
    },
  };

  await warmupAudioSettingsRnnoiseTestLane({
    refs,
    deps: {
      ctx: refs.audioCtxRef.current,
      source,
      runId: 5,
      suppressionRuntime: { backend: 'rnnoise' },
      createRnnoiseNodeFn: async () => rnnoiseNode,
      createSpeexNodeFn: async () => speexNode,
      createNoiseGateNodeFn: async () => noiseGateNode,
      createSpeechFocusChainFn: () => speechFocusChain,
      createKeyboardSuppressorNodeFn: async () => keyboardSuppressorNode,
      applyNoiseSuppressionRoutingFn: () => true,
      setTestDiagnosticsFn: (updater) => {
        diagnostics = typeof updater === 'function' ? updater(diagnostics) : updater;
      },
      addPerfPhaseFn: (traceId, phase) => {
        perfPhases.push([traceId, phase]);
      },
      perfTraceId: 'rnnoise-trace',
      roundMsFn: (value) => value,
      warnFn: () => {},
      isUltraLowLatencyModeFn: () => false,
    },
  });

  assert.equal(refs.noiseSuppressorNodeRef.current, rnnoiseNode);
  assert.equal(refs.residualDenoiserNodeRef.current, speexNode);
  assert.equal(refs.noiseGateNodeRef.current, noiseGateNode);
  assert.equal(refs.speechFocusChainRef.current, speechFocusChain);
  assert.equal(refs.keyboardSuppressorNodeRef.current, keyboardSuppressorNode);
  assert.equal(refs.noiseSuppressionRoutingRef.current.processedReady, true);
  assert.equal(diagnostics.filter.backend, 'rnnoise');
  assert.equal(diagnostics.filter.loaded, true);
  assert.equal(perfPhases.some(([, phase]) => phase === 'rnnoise-ready'), true);
  assert.equal(sourceConnections.length > 0, true);
});

test('audio settings browser warmup runtime bypasses optional keyboard suppressor worklet failures', async () => {
  const sourceConnections = [];
  const warnings = [];
  let diagnostics = {
    filter: {
      backend: 'raw',
      loaded: false,
      fallbackReason: 'old',
    },
  };

  const rnnoiseNode = {
    connect(target) {
      sourceConnections.push(['rnnoise', target]);
    },
    destroy() {},
  };
  const speexNode = {
    connect(target) {
      sourceConnections.push(['speex', target]);
    },
    destroy() {},
  };
  const noiseGateNode = {
    connect(target) {
      sourceConnections.push(['noiseGate', target]);
    },
    disconnect() {},
  };
  const speechFocusChain = {
    input: { id: 'speech-input' },
    output: {
      connect(target) {
        sourceConnections.push(['speechOutput', target]);
      },
    },
    disconnect() {},
  };

  const ctx = { id: 'ctx', state: 'running' };
  const processedGain = { id: 'processed-gain' };
  const refs = {
    testRunIdRef: { current: 7 },
    audioCtxRef: { current: ctx },
    processingModeRef: { current: 'standard' },
    noiseSuppressionRef: { current: true },
    noiseSuppressorNodeRef: { current: null },
    residualDenoiserNodeRef: { current: null },
    noiseGateNodeRef: { current: null },
    speechFocusChainRef: { current: null },
    keyboardSuppressorNodeRef: { current: null },
    noiseSuppressionRoutingRef: {
      current: {
        processedGain,
        processedReady: false,
      },
    },
  };

  const source = {
    connect(target) {
      sourceConnections.push(['source', target]);
    },
  };

  await warmupAudioSettingsRnnoiseTestLane({
    refs,
    deps: {
      ctx,
      source,
      runId: 7,
      suppressionRuntime: { backend: 'rnnoise' },
      createRnnoiseNodeFn: async () => rnnoiseNode,
      createSpeexNodeFn: async () => speexNode,
      createNoiseGateNodeFn: async () => noiseGateNode,
      createSpeechFocusChainFn: () => speechFocusChain,
      createKeyboardSuppressorNodeFn: async () => {
        throw new Error("AudioWorkletNode cannot be created: No execution context available.");
      },
      applyNoiseSuppressionRoutingFn: () => true,
      setTestDiagnosticsFn: (updater) => {
        diagnostics = typeof updater === 'function' ? updater(diagnostics) : updater;
      },
      addPerfPhaseFn: () => {},
      perfTraceId: 'rnnoise-trace',
      roundMsFn: (value) => value,
      warnFn: (...args) => warnings.push(args),
      isUltraLowLatencyModeFn: () => false,
    },
  });

  assert.equal(refs.noiseSuppressorNodeRef.current, rnnoiseNode);
  assert.equal(refs.residualDenoiserNodeRef.current, speexNode);
  assert.equal(refs.noiseGateNodeRef.current, noiseGateNode);
  assert.equal(refs.speechFocusChainRef.current, speechFocusChain);
  assert.equal(refs.keyboardSuppressorNodeRef.current, null);
  assert.equal(refs.noiseSuppressionRoutingRef.current.processedReady, true);
  assert.equal(diagnostics.filter.backend, 'rnnoise');
  assert.equal(diagnostics.filter.loaded, true);
  assert.equal(diagnostics.filter.fallbackReason, null);
  assert.equal(diagnostics.filter.keyboardSuppressorBypassed, true);
  assert.deepEqual(sourceConnections.at(-1), ['speechOutput', processedGain]);
  assert.equal(warnings.length, 1);
});
