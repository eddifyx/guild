import {
  getMonitorProfile,
  resolveOutputSelection,
} from './audioSettingsModel.mjs';
import {
  buildAudioSettingsOutputChangeHandlerOptions,
  buildAudioSettingsOutputRuntime,
} from './audioSettingsControllerBindings.mjs';

export function buildAudioSettingsOutputChangeContract({
  refs = {},
  outputDevices = [],
  selectOutputFn,
  setOutputDeviceFn,
  restartTestFn,
  setTestDiagnosticsFn,
} = {}) {
  return buildAudioSettingsOutputChangeHandlerOptions({
    refs,
    outputDevices,
    runtime: buildAudioSettingsOutputRuntime({
      selectOutputFn,
      setOutputDeviceFn,
      restartTestFn,
      resolveOutputSelectionFn: resolveOutputSelection,
      getMonitorProfileFn: getMonitorProfile,
      setTestDiagnosticsFn,
    }),
  });
}
