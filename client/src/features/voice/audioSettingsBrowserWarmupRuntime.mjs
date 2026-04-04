import { roundMs } from './audioSettingsModel.mjs';

function shouldBypassKeyboardSuppressorError(error, ctx) {
  const message = String(error?.message || error || '').toLowerCase();
  if (!message || ctx?.state === 'closed') {
    return false;
  }

  return message.includes('audioworkletnode cannot be created')
    || message.includes('no execution context available');
}

export async function warmupAudioSettingsRnnoiseTestLane({
  refs = {},
  deps = {},
} = {}) {
  const {
    testRunIdRef = { current: 0 },
    audioCtxRef = { current: null },
    processingModeRef = { current: null },
    noiseSuppressionRef = { current: true },
    noiseSuppressorNodeRef = { current: null },
    residualDenoiserNodeRef = { current: null },
    noiseGateNodeRef = { current: null },
    speechFocusChainRef = { current: null },
    keyboardSuppressorNodeRef = { current: null },
    noiseSuppressionRoutingRef = { current: null },
  } = refs;

  const {
    ctx,
    source,
    runId,
    suppressionRuntime,
    createRnnoiseNodeFn = null,
    createSpeexNodeFn = null,
    createNoiseGateNodeFn = null,
    createSpeechFocusChainFn = null,
    createKeyboardSuppressorNodeFn = null,
    applyNoiseSuppressionRoutingFn = () => false,
    setTestDiagnosticsFn = () => {},
    addPerfPhaseFn = () => {},
    perfTraceId = null,
    roundMsFn = roundMs,
    warnFn = () => {},
    isUltraLowLatencyModeFn = () => false,
  } = deps;

  if (
    !ctx
    || !source
    || !createRnnoiseNodeFn
    || !createSpeexNodeFn
    || !createNoiseGateNodeFn
    || !createSpeechFocusChainFn
    || !createKeyboardSuppressorNodeFn
  ) {
    return;
  }

  try {
    const workletStart = globalThis.performance?.now?.() ?? Date.now();
    const rnnoiseNode = await createRnnoiseNodeFn(ctx, { maxChannels: 1 });
    const nodeMs = roundMsFn((globalThis.performance?.now?.() ?? Date.now()) - workletStart);
    if (
      testRunIdRef.current !== runId
      || audioCtxRef.current !== ctx
      || isUltraLowLatencyModeFn(processingModeRef.current)
    ) {
      rnnoiseNode.destroy?.();
      return;
    }

    noiseSuppressorNodeRef.current = rnnoiseNode;
    const routing = noiseSuppressionRoutingRef.current;
    if (!routing) {
      rnnoiseNode.destroy?.();
      return;
    }

    const speexNode = await createSpeexNodeFn(ctx, { maxChannels: 1 });
    const noiseGateNode = await createNoiseGateNodeFn(ctx, { maxChannels: 1 });
    const speechFocusChain = createSpeechFocusChainFn(ctx);
    let keyboardSuppressorNode = null;
    let keyboardSuppressorBypassed = false;
    try {
      keyboardSuppressorNode = await createKeyboardSuppressorNodeFn(ctx, { maxChannels: 1 });
    } catch (keyboardErr) {
      if (!shouldBypassKeyboardSuppressorError(keyboardErr, ctx)) {
        throw keyboardErr;
      }
      keyboardSuppressorBypassed = true;
      warnFn('Keyboard suppressor unavailable during mic test warm-up, bypassing optional worklet:', keyboardErr);
    }
    if (
      testRunIdRef.current !== runId
      || audioCtxRef.current !== ctx
      || isUltraLowLatencyModeFn(processingModeRef.current)
    ) {
      keyboardSuppressorNode?.disconnect?.();
      speechFocusChain.disconnect?.();
      speexNode.destroy?.();
      noiseGateNode.disconnect?.();
      rnnoiseNode.destroy?.();
      return;
    }

    residualDenoiserNodeRef.current = speexNode;
    noiseGateNodeRef.current = noiseGateNode;
    speechFocusChainRef.current = speechFocusChain;
    keyboardSuppressorNodeRef.current = keyboardSuppressorNode;
    routing.processedReady = true;
    source.connect(rnnoiseNode);
    rnnoiseNode.connect(speexNode);
    speexNode.connect(noiseGateNode);
    noiseGateNode.connect(speechFocusChain.input);
    if (keyboardSuppressorNode) {
      speechFocusChain.output.connect(keyboardSuppressorNode);
      keyboardSuppressorNode.connect(routing.processedGain);
    } else {
      speechFocusChain.output.connect(routing.processedGain);
    }
    const usingProcessedLane = applyNoiseSuppressionRoutingFn(noiseSuppressionRef.current);
    setTestDiagnosticsFn((prev) => prev ? {
      ...prev,
      updatedAt: new Date().toISOString(),
      filter: {
        ...(prev.filter || {}),
        backend: usingProcessedLane ? suppressionRuntime.backend : 'raw',
        suppressionEnabled: noiseSuppressionRef.current,
        loaded: true,
        fallbackReason: null,
        keyboardSuppressorBypassed,
        workletCreateMs: nodeMs,
      },
    } : prev);
    addPerfPhaseFn(perfTraceId, 'rnnoise-ready', {
      durationMs: nodeMs,
    });
  } catch (rnnoiseErr) {
    if (testRunIdRef.current !== runId || audioCtxRef.current !== ctx) {
      return;
    }

    const fallbackReason = rnnoiseErr?.message || 'RNNoise failed to initialize';
    warnFn('RNNoise test warm-up failed, staying on raw mic:', rnnoiseErr);
    const routing = noiseSuppressionRoutingRef.current;
    if (routing) {
      routing.processedReady = false;
    }
    applyNoiseSuppressionRoutingFn(noiseSuppressionRef.current);
    setTestDiagnosticsFn((prev) => prev ? {
      ...prev,
      updatedAt: new Date().toISOString(),
      filter: {
        ...(prev.filter || {}),
        backend: 'raw',
        suppressionEnabled: noiseSuppressionRef.current,
        loaded: false,
        fallbackReason,
      },
    } : prev);
    addPerfPhaseFn(perfTraceId, 'rnnoise-fallback', {
      error: fallbackReason,
    });
  }
}
