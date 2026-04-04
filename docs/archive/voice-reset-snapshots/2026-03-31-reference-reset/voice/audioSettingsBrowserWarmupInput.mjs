export function buildAudioSettingsBrowserWarmupInput({
  refs = {},
  deps = {},
} = {}) {
  return {
    refs: {
      testRunIdRef: refs.testRunIdRef,
      audioCtxRef: refs.audioCtxRef,
      processingModeRef: refs.processingModeRef,
      noiseSuppressionRef: refs.noiseSuppressionRef,
      noiseSuppressorNodeRef: refs.noiseSuppressorNodeRef,
      residualDenoiserNodeRef: refs.residualDenoiserNodeRef,
      noiseGateNodeRef: refs.noiseGateNodeRef,
      speechFocusChainRef: refs.speechFocusChainRef,
      keyboardSuppressorNodeRef: refs.keyboardSuppressorNodeRef,
      noiseSuppressionRoutingRef: refs.noiseSuppressionRoutingRef,
    },
    deps: {
      ctx: deps.ctx,
      source: deps.source,
      runId: deps.runId,
      suppressionRuntime: deps.suppressionRuntime,
      createRnnoiseNodeFn: deps.createRnnoiseNodeFn,
      createSpeexNodeFn: deps.createSpeexNodeFn,
      createNoiseGateNodeFn: deps.createNoiseGateNodeFn,
      createSpeechFocusChainFn: deps.createSpeechFocusChainFn,
      createKeyboardSuppressorNodeFn: deps.createKeyboardSuppressorNodeFn,
      applyNoiseSuppressionRoutingFn: deps.applyNoiseSuppressionRoutingFn,
      setTestDiagnosticsFn: deps.setTestDiagnosticsFn,
      addPerfPhaseFn: deps.addPerfPhaseFn,
      perfTraceId: deps.perfTraceId,
      roundMsFn: deps.roundMsFn,
      warnFn: deps.warnFn,
      isUltraLowLatencyModeFn: deps.isUltraLowLatencyModeFn,
    },
  };
}
