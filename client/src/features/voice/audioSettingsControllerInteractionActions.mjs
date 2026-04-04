export function buildAudioSettingsControllerInteractionActions({
  outputDevices = [],
  testing = false,
  refs = {},
  state = {},
  actions = {},
  deps = {},
  restartTestFn = () => {},
} = {}) {
  const {
    skipSelectedOutputSyncRestartRef,
    selectedOutputRef,
    previewAudioRef,
    monitorGainRef,
    selectedInputRef,
    processingModeRef,
    noiseSuppressionRef,
  } = refs;
  const {
    setNoiseSuppressionStateFn,
    setProcessingModeStateFn,
    setTestDiagnosticsFn,
  } = state;
  const {
    selectInputFn,
    selectOutputFn,
    setOutputDeviceFn,
    setVoiceProcessingModeFn,
  } = actions;

  const handleOutputChange = deps.createAudioSettingsOutputChangeHandlerFn(
    deps.buildAudioSettingsOutputChangeContractFn({
      refs: {
        skipSelectedOutputSyncRestartRef,
        selectedOutputRef,
        previewAudioRef,
        monitorGainRef,
      },
      outputDevices,
      selectOutputFn,
      setOutputDeviceFn,
      restartTestFn,
      setTestDiagnosticsFn,
    }),
  );

  const handleInputChange = deps.createAudioSettingsInputChangeHandlerFn(
    deps.buildAudioSettingsInputChangeHandlerOptionsFn({
      selectedInputRef,
      selectInputFn,
      restartTestFn,
    }),
  );

  const handleSelectProcessingMode = deps.createAudioSettingsSelectProcessingModeHandlerFn(
    deps.buildAudioSettingsProcessingModeContractFn({
      testing,
      refs: {
        processingModeRef,
        noiseSuppressionRef,
      },
      setVoiceProcessingModeFn,
      setProcessingModeStateFn,
      setNoiseSuppressionStateFn,
      restartTestFn,
    }),
  );

  return {
    handleOutputChange,
    handleInputChange,
    handleSelectProcessingMode,
  };
}
