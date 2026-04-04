export function buildAudioSettingsRestartTestHandlerOptions({
  testing = false,
  stopTestFn,
  startTestFn,
  restartAudioSettingsMicTestFn,
} = {}) {
  return {
    testing,
    stopTestFn,
    startTestFn,
    restartAudioSettingsMicTestFn,
  };
}

export function buildAudioSettingsOutputChangeOptions({
  deviceId,
  refs = {},
  outputDevices = [],
  runtime = {},
} = {}) {
  return {
    deviceId,
    refs,
    outputDevices,
    ...runtime,
  };
}

export function buildAudioSettingsOutputChangeHandlerOptions({
  refs = {},
  outputDevices = [],
  runtime = {},
} = {}) {
  return {
    refs,
    outputDevices,
    runtime,
  };
}

export function buildAudioSettingsOutputRuntime({
  selectOutputFn,
  setOutputDeviceFn,
  restartTestFn,
  resolveOutputSelectionFn,
  getMonitorProfileFn,
  setTestDiagnosticsFn,
} = {}) {
  return {
    selectOutputFn,
    setOutputDeviceFn,
    restartTestFn,
    resolveOutputSelectionFn,
    getMonitorProfileFn,
    setTestDiagnosticsFn,
  };
}

export function buildAudioSettingsInputChangeHandlerOptions({
  selectedInputRef,
  selectInputFn,
  restartTestFn,
} = {}) {
  return {
    selectedInputRef,
    selectInputFn,
    restartTestFn,
  };
}
