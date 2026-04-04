export function buildAudioSettingsControllerState({
  handleClose,
  selectedInput,
  inputDevices,
  handleInputChange,
  testing,
  testStarting,
  startTest,
  stopTest,
  meterFillRef,
  meterValueRef,
  meterStatusRef,
  activeMonitorProfile,
  lowLatencyEnabled,
  noiseSuppression,
  noiseSuppressionFallbackReason,
  testDiagnostics,
  micGain,
  setMicGainStateFn,
  gainRef,
  setMicGainFn,
  preferredSuppressionImplementation,
  appleHardwareProcessingGuidance,
  handleSelectProcessingMode,
  selectedOutput,
  outputDevices,
  handleOutputChange,
} = {}) {
  return {
    handleClose,
    inputPanelProps: {
      selectedInput,
      inputDevices,
      handleInputChange,
      testing,
      testStarting,
      startTest,
      stopTest,
      meterFillRef,
      meterValueRef,
      meterStatusRef,
      activeMonitorProfile,
      lowLatencyEnabled,
      noiseSuppression,
      noiseSuppressionFallbackReason,
      testDiagnostics,
    },
    sensitivityPanelProps: {
      lowLatencyEnabled,
      micGain,
      onMicGainChange: (value) => {
        setMicGainStateFn?.(value);
        if (gainRef?.current) {
          gainRef.current.gain.value = value;
        }
        setMicGainFn?.(value);
      },
    },
    processingPanelProps: {
      lowLatencyEnabled,
      preferredSuppressionImplementation,
      appleHardwareProcessingGuidance,
      handleSelectProcessingMode,
      noiseSuppressionFallbackReason,
    },
    outputPanelProps: {
      selectedOutput,
      outputDevices,
      handleOutputChange,
      activeMonitorProfile,
    },
    footerProps: {
      handleClose,
    },
  };
}
