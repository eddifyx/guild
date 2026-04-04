import { useEffect } from 'react';

import { buildAudioSettingsControllerState } from './audioSettingsControllerModel.mjs';
import { useAudioSettingsControllerRuntime } from './useAudioSettingsControllerRuntime.mjs';

export function useAudioSettingsControllerComposition({
  onClose,
  openTraceId = null,
  context = {},
  state = {},
  viewState = {},
} = {}) {
  const {
    inputDevices,
    outputDevices,
    selectedInput,
    selectedOutput,
    selectInput,
    selectOutput,
    setOutputDevice,
    setMicGain,
    voiceProcessingMode,
    setVoiceProcessingMode,
  } = context;

  const {
    testing,
    setTesting,
    testStarting,
    setTestStarting,
    micGain,
    setMicGainLocal,
    noiseSuppression,
    setNoiseSuppression,
    processingMode,
    setProcessingModeLocal,
    testDiagnostics,
    setTestDiagnostics,
    streamRef,
    audioCtxRef,
    animFrameRef,
    gainRef,
    monitorGainRef,
    noiseSuppressorNodeRef,
    residualDenoiserNodeRef,
    noiseGateNodeRef,
    speechFocusChainRef,
    keyboardSuppressorNodeRef,
    noiseSuppressionRoutingRef,
    previewAudioRef,
    appleVoiceFrameCleanupRef,
    appleVoiceStateCleanupRef,
    appleVoiceSourceNodeRef,
    appleVoiceAvailableRef,
    testRunIdRef,
    completedOpenTraceIdsRef,
    selectedInputRef,
    selectedOutputRef,
    processingModeRef,
    noiseSuppressionRef,
    skipSelectedOutputSyncRestartRef,
    meterFillRef,
    meterValueRef,
    meterStatusRef,
  } = state;

  const {
    lowLatencyEnabled,
    activeMonitorProfile,
    noiseSuppressionFallbackReason,
    preferredSuppressionImplementation,
    appleHardwareProcessingGuidance,
  } = viewState;

  const {
    handleClose,
    startTest,
    stopTest,
    handleOutputChange,
    handleInputChange,
    handleSelectProcessingMode,
  } = useAudioSettingsControllerRuntime({
    onClose,
    openTraceId,
    outputDevices,
    selectedInput,
    selectedOutput,
    processingMode,
    noiseSuppression,
    voiceProcessingMode,
    testing,
    refs: {
      streamRef,
      audioCtxRef,
      animFrameRef,
      gainRef,
      monitorGainRef,
      noiseSuppressorNodeRef,
      residualDenoiserNodeRef,
      noiseGateNodeRef,
      speechFocusChainRef,
      keyboardSuppressorNodeRef,
      noiseSuppressionRoutingRef,
      previewAudioRef,
      appleVoiceFrameCleanupRef,
      appleVoiceStateCleanupRef,
      appleVoiceSourceNodeRef,
      appleVoiceAvailableRef,
      testRunIdRef,
      completedOpenTraceIdsRef,
      selectedInputRef,
      selectedOutputRef,
      processingModeRef,
      noiseSuppressionRef,
      skipSelectedOutputSyncRestartRef,
      meterFillRef,
      meterValueRef,
      meterStatusRef,
    },
    state: {
      setTestingFn: setTesting,
      setTestStartingFn: setTestStarting,
      setMicGainStateFn: setMicGainLocal,
      setNoiseSuppressionStateFn: setNoiseSuppression,
      setProcessingModeStateFn: setProcessingModeLocal,
      setTestDiagnosticsFn: setTestDiagnostics,
    },
    actions: {
      selectInputFn: selectInput,
      selectOutputFn: selectOutput,
      setOutputDeviceFn: setOutputDevice,
      setMicGainFn: setMicGain,
      setVoiceProcessingModeFn: setVoiceProcessingMode,
    },
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const debugState = {
      testing,
      testStarting,
      processingMode,
      noiseSuppression,
      selectedInput,
      selectedOutput,
      testDiagnostics,
      previewAudio: previewAudioRef.current
        ? {
            paused: previewAudioRef.current.paused,
            muted: previewAudioRef.current.muted,
            volume: previewAudioRef.current.volume,
            readyState: previewAudioRef.current.readyState,
            sinkId: typeof previewAudioRef.current.sinkId === 'string'
              ? previewAudioRef.current.sinkId
              : null,
          }
        : null,
      read() {
        return {
          testing,
          testStarting,
          processingMode,
          noiseSuppression,
          selectedInput,
          selectedOutput,
          testDiagnostics,
          previewAudio: previewAudioRef.current
            ? {
                paused: previewAudioRef.current.paused,
                muted: previewAudioRef.current.muted,
                volume: previewAudioRef.current.volume,
                readyState: previewAudioRef.current.readyState,
                sinkId: typeof previewAudioRef.current.sinkId === 'string'
                  ? previewAudioRef.current.sinkId
                  : null,
              }
            : null,
        };
      },
    };

    window.__guildAudioSettingsDebug = debugState;

    return () => {
      if (window.__guildAudioSettingsDebug === debugState) {
        delete window.__guildAudioSettingsDebug;
      }
    };
  }, [
    noiseSuppression,
    previewAudioRef,
    processingMode,
    selectedInput,
    selectedOutput,
    testDiagnostics,
    testStarting,
    testing,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.electronAPI?.debugLog) return;

    try {
      window.electronAPI.debugLog('audio-settings', JSON.stringify({
        at: new Date().toISOString(),
        testing,
        testStarting,
        processingMode,
        noiseSuppression,
        selectedInput,
        selectedOutput,
        testDiagnostics: testDiagnostics
          ? {
              updatedAt: testDiagnostics.updatedAt || null,
              mode: testDiagnostics.mode || null,
              error: testDiagnostics.error || null,
              playbackState: testDiagnostics.playback?.state || null,
              playbackError: testDiagnostics.playback?.error || null,
              backend: testDiagnostics.filter?.backend || null,
              fallbackReason: testDiagnostics.filter?.fallbackReason || null,
              audioContextState: testDiagnostics.audioContext?.state || null,
              sourceTrackEnabled: testDiagnostics.sourceTrack?.enabled ?? null,
              sourceTrackMuted: testDiagnostics.sourceTrack?.muted ?? null,
            }
          : null,
      }));
    } catch {}
  }, [
    noiseSuppression,
    processingMode,
    selectedInput,
    selectedOutput,
    testDiagnostics,
    testStarting,
    testing,
  ]);

  return buildAudioSettingsControllerState({
    handleClose,
    selectedInput,
    inputDevices,
    handleInputChange,
    testing,
    testStarting,
    startTest: () => void startTest(),
    stopTest: () => void stopTest(),
    meterFillRef,
    meterValueRef,
    meterStatusRef,
    activeMonitorProfile,
    lowLatencyEnabled,
    noiseSuppression,
    noiseSuppressionFallbackReason,
    testDiagnostics,
    micGain,
    setMicGainStateFn: setMicGainLocal,
    gainRef,
    setMicGainFn: setMicGain,
    preferredSuppressionImplementation,
    appleHardwareProcessingGuidance,
    handleSelectProcessingMode,
    selectedOutput,
    outputDevices,
    handleOutputChange,
  });
}
