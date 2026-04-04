export function buildAudioSettingsControllerRestartTestAction({
  testing = false,
  deps = {},
  stopTest,
  startTest,
} = {}) {
  return deps.createAudioSettingsRestartTestHandlerFn(
    deps.buildAudioSettingsRestartTestHandlerOptionsFn({
      testing,
      stopTestFn: stopTest,
      startTestFn: startTest,
      restartAudioSettingsMicTestFn: deps.restartAudioSettingsMicTestFn,
    }),
  );
}
