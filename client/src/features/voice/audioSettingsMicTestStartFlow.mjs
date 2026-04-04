import {
  buildAudioSettingsMicTestInitialDiagnostics,
  buildAudioSettingsMicTestStartState,
} from './audioSettingsMicTestStartModel.mjs';
import { buildAudioSettingsBrowserMicTestInput } from './audioSettingsBrowserMicTestInput.mjs';

export async function runAudioSettingsMicTestStart({
  refs = {},
  outputDevices = [],
  deps = {},
} = {}) {
  deps.setTestStartingFn?.(true);
  deps.clearPreviewPlaybackFn?.();
  let activeVoiceMode = null;
  let activeInputId = null;
  let activeOutputId = null;
  let fallbackConstraints = null;
  let initialConstraints = null;
  let monitorProfile = null;
  let noiseSuppressionEnabled = true;
  let outputSelection = null;
  let requestedSuppressionRuntime = null;
  let shouldUseAppleVoiceProcessing = false;
  let useRawMicPath = false;
  let perfTraceId = null;

  const runId = refs.testRunIdRef ? ++refs.testRunIdRef.current : 0;
  let appliedConstraints = null;
  let usedDefaultDeviceFallback = false;
  let preferDirectBrowserFallback = false;

  try {
    const startState = buildAudioSettingsMicTestStartState({
      refs,
      outputDevices,
      deps,
    });
    ({
      activeVoiceMode,
      activeInputId,
      activeOutputId,
      fallbackConstraints,
      initialConstraints,
      monitorProfile,
      noiseSuppressionEnabled,
      outputSelection,
      requestedSuppressionRuntime,
      shouldUseAppleVoiceProcessing,
      useRawMicPath,
    } = startState);
    appliedConstraints = initialConstraints;

    perfTraceId = deps.startPerfTraceFn?.('mic-test-start', {
      mode: activeVoiceMode,
      inputDeviceId: activeInputId || 'default',
      outputDeviceId: activeOutputId || 'default',
      noiseSuppressionEnabled,
      preferAppleVoiceProcessing: shouldUseAppleVoiceProcessing,
    });
    deps.addPerfPhaseFn?.(perfTraceId, 'requested');

    const testStartedAt = deps.nowIsoFn?.() || new Date().toISOString();
    const testStart = deps.performanceNowFn?.() ?? Date.now();

    deps.setTestingFn?.(true);
    deps.setTestDiagnosticsFn?.(buildAudioSettingsMicTestInitialDiagnostics({
      testStartedAt,
      activeVoiceMode,
      initialConstraints,
      activeOutputId,
      monitorProfile,
      selectedOutputDeviceId: refs.selectedOutputRef?.current || null,
      outputSelection,
      shouldUseAppleVoiceProcessing,
      requestedSuppressionRuntime,
      noiseSuppressionEnabled,
      voiceNoiseSuppressionBackends: deps.voiceNoiseSuppressionBackends,
    }));

    if (shouldUseAppleVoiceProcessing) {
      try {
        deps.addPerfPhaseFn?.(perfTraceId, 'apple-path-requested');
        const started = await deps.startAppleVoiceIsolationTestFn?.({
          activeVoiceMode,
          activeOutputId,
          monitorProfile,
          preferDirectMonitor: !outputSelection.hasExplicitSelection || outputSelection.usedDefaultFallback,
          requestedOutputDeviceId: refs.selectedOutputRef?.current,
          usedDefaultOutputFallback: outputSelection.usedDefaultFallback,
          noiseSuppressionEnabled,
          runId,
          testStart,
          testStartedAt,
        });
        if (started) {
          deps.endPerfTraceFn?.(perfTraceId, {
            status: 'ready',
            backend: deps.voiceNoiseSuppressionBackends?.APPLE,
            playbackState: 'live-playing',
          });
          return true;
        }
        deps.setTestStartingFn?.(false);
        deps.setTestingFn?.(false);
        deps.endPerfTraceFn?.(perfTraceId, {
          status: 'aborted',
          backend: deps.voiceNoiseSuppressionBackends?.APPLE,
          error: 'Apple mic test start returned no active session.',
        });
        return false;
      } catch (appleErr) {
        preferDirectBrowserFallback = true;
        if (deps.shouldDisableAppleVoiceForSessionFn?.(appleErr?.message)) {
          refs.appleVoiceAvailableRef.current = false;
        }
        deps.warnFn?.('Apple voice processing test path failed, falling back to browser capture:', appleErr);
        deps.addPerfPhaseFn?.(perfTraceId, 'apple-path-fallback', {
          error: appleErr?.message || 'Apple voice processing unavailable',
        });
      }
    }

    const browserTestResult = await deps.startAudioSettingsBrowserMicTestFn?.(
      buildAudioSettingsBrowserMicTestInput({
        refs,
        deps,
        state: startState,
        runtime: {
          perfTraceId,
          runId,
          testStart,
          testStartedAt,
          preferDirectBrowserFallback,
          onUsedDefaultDeviceFallbackChangeFn: (value) => {
            usedDefaultDeviceFallback = value;
          },
        },
      })
    );

    if (!browserTestResult) {
      deps.setTestStartingFn?.(false);
      deps.setTestingFn?.(false);
      deps.endPerfTraceFn?.(perfTraceId, {
        status: 'aborted',
        error: 'Mic test start did not produce an active browser monitor session.',
        usedDefaultDeviceFallback,
      });
      return false;
    }

    deps.endPerfTraceFn?.(perfTraceId, {
      status: 'ready',
      backend: browserTestResult.suppressionRuntime.backend,
      playbackState: browserTestResult.playbackState,
      usedDefaultDeviceFallback: browserTestResult.usedDefaultDeviceFallback,
    });
    return true;
  } catch (err) {
    deps.setTestStartingFn?.(false);
    deps.setTestingFn?.(false);
    deps.setTestDiagnosticsFn?.({
      updatedAt: deps.nowIsoFn?.() || new Date().toISOString(),
      mode: activeVoiceMode,
      requestedConstraints: appliedConstraints?.audio,
      usedDefaultDeviceFallback,
      error: err?.message || 'Mic test failed',
    });
    deps.endPerfTraceFn?.(perfTraceId, {
      status: 'error',
      error: err?.message || 'Mic test failed',
      usedDefaultDeviceFallback,
    });
    deps.logErrorFn?.('Mic test failed:', err);
    return false;
  }
}
