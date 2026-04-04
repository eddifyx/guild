import { useEffect, useRef } from 'react';
import {
  endPerfTraceAfterNextPaint,
} from '../../utils/devPerf';
import {
  getStoredVoiceProcessingMode,
  isUltraLowLatencyMode,
  prefersAppleSystemVoiceIsolation,
} from '../../utils/voiceProcessing';

export function useAudioSettingsRuntimeEffects({
  selectedInput,
  selectedOutput,
  processingMode,
  noiseSuppression,
  voiceProcessingMode,
  testing,
  openTraceId = null,
  refs,
  state,
  deps,
} = {}) {
  const {
    selectedInputRef,
    selectedOutputRef,
    processingModeRef,
    noiseSuppressionRef,
    appleVoiceAvailableRef,
    skipSelectedOutputSyncRestartRef,
    completedOpenTraceIdsRef,
  } = refs;
  const {
    setProcessingModeStateFn,
    setNoiseSuppressionStateFn,
  } = state;
  const {
    restartTestFn,
    stopTestFn,
    updateMicMeterFn,
    isAppleVoiceCaptureSupportedFn,
    primeAppleVoiceCaptureFn,
  } = deps;
  const restartTestFnRef = useRef(restartTestFn);
  const stopTestFnRef = useRef(stopTestFn);
  const updateMicMeterFnRef = useRef(updateMicMeterFn);
  const previousSelectedOutputRef = useRef(selectedOutput);

  useEffect(() => {
    restartTestFnRef.current = restartTestFn;
  }, [restartTestFn]);

  useEffect(() => {
    stopTestFnRef.current = stopTestFn;
  }, [stopTestFn]);

  useEffect(() => {
    updateMicMeterFnRef.current = updateMicMeterFn;
  }, [updateMicMeterFn]);

  useEffect(() => {
    selectedInputRef.current = selectedInput;
  }, [selectedInput, selectedInputRef]);

  useEffect(() => {
    selectedOutputRef.current = selectedOutput;
  }, [selectedOutput, selectedOutputRef]);

  useEffect(() => {
    processingModeRef.current = processingMode;
  }, [processingMode, processingModeRef]);

  useEffect(() => {
    noiseSuppressionRef.current = noiseSuppression;
  }, [noiseSuppression, noiseSuppressionRef]);

  useEffect(() => {
    if (!prefersAppleSystemVoiceIsolation() || !primeAppleVoiceCaptureFn) {
      return;
    }

    const inputIsDefault = !selectedInputRef.current;
    const shouldPrime =
      !isUltraLowLatencyMode(processingModeRef.current)
      && noiseSuppressionRef.current
      && inputIsDefault;

    if (!shouldPrime) {
      return;
    }

    primeAppleVoiceCaptureFn().catch(() => {});
  }, [
    noiseSuppressionRef,
    primeAppleVoiceCaptureFn,
    processingModeRef,
    selectedInputRef,
  ]);

  useEffect(() => {
    if (!prefersAppleSystemVoiceIsolation() || !isAppleVoiceCaptureSupportedFn) {
      return;
    }

    let cancelled = false;
    isAppleVoiceCaptureSupportedFn()
      .then((supported) => {
        if (!cancelled) {
          appleVoiceAvailableRef.current = supported !== false;
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [appleVoiceAvailableRef, isAppleVoiceCaptureSupportedFn]);

  useEffect(() => {
    const previousSelectedOutput = previousSelectedOutputRef.current;
    previousSelectedOutputRef.current = selectedOutput;

    if (previousSelectedOutput === selectedOutput) {
      return;
    }

    if (skipSelectedOutputSyncRestartRef.current) {
      skipSelectedOutputSyncRestartRef.current = false;
      return;
    }
    if (testing) {
      restartTestFnRef.current?.();
    }
  }, [selectedOutput, skipSelectedOutputSyncRestartRef, testing]);

  useEffect(() => {
    return () => {
      void stopTestFnRef.current?.();
    };
  }, []);

  useEffect(() => {
    const nextMode = voiceProcessingMode || getStoredVoiceProcessingMode();
    const suppressionEnabled = !isUltraLowLatencyMode(nextMode);
    setProcessingModeStateFn?.(nextMode);
    setNoiseSuppressionStateFn?.(suppressionEnabled);
    processingModeRef.current = nextMode;
    noiseSuppressionRef.current = suppressionEnabled;
  }, [
    noiseSuppressionRef,
    processingModeRef,
    setNoiseSuppressionStateFn,
    setProcessingModeStateFn,
    voiceProcessingMode,
  ]);

  useEffect(() => {
    if (!testing) {
      updateMicMeterFnRef.current?.(0);
    }
  }, [testing]);

  useEffect(() => {
    if (!openTraceId || completedOpenTraceIdsRef.current.has(openTraceId)) {
      return;
    }

    completedOpenTraceIdsRef.current.add(openTraceId);
    endPerfTraceAfterNextPaint(openTraceId, {
      status: 'ready',
      surface: 'audio-settings',
    });
  }, [completedOpenTraceIdsRef, openTraceId]);
}
