import { useRef, useState } from 'react';

import {
  getStoredVoiceProcessingMode,
  isUltraLowLatencyMode,
  prefersAppleSystemVoiceIsolation,
} from '../../utils/voiceProcessing';

export function useAudioSettingsControllerState({
  voiceProcessingMode = '',
} = {}) {
  const [testing, setTesting] = useState(false);
  const [testStarting, setTestStarting] = useState(false);
  const [micGain, setMicGainLocal] = useState(() =>
    parseFloat(localStorage.getItem('voice:micGain') || '3')
  );
  const [noiseSuppression, setNoiseSuppression] = useState(() =>
    !isUltraLowLatencyMode(voiceProcessingMode || getStoredVoiceProcessingMode())
  );
  const [processingMode, setProcessingModeLocal] = useState(() =>
    voiceProcessingMode || getStoredVoiceProcessingMode()
  );
  const [testDiagnostics, setTestDiagnostics] = useState(null);

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const animFrameRef = useRef(null);
  const gainRef = useRef(null);
  const monitorGainRef = useRef(null);
  const noiseSuppressorNodeRef = useRef(null);
  const residualDenoiserNodeRef = useRef(null);
  const noiseGateNodeRef = useRef(null);
  const speechFocusChainRef = useRef(null);
  const keyboardSuppressorNodeRef = useRef(null);
  const noiseSuppressionRoutingRef = useRef(null);
  const previewAudioRef = useRef(null);
  const appleVoiceFrameCleanupRef = useRef(null);
  const appleVoiceStateCleanupRef = useRef(null);
  const appleVoiceSourceNodeRef = useRef(null);
  const appleVoiceAvailableRef = useRef(prefersAppleSystemVoiceIsolation());
  const testRunIdRef = useRef(0);
  const completedOpenTraceIdsRef = useRef(new Set());
  const selectedInputRef = useRef(null);
  const selectedOutputRef = useRef(null);
  const processingModeRef = useRef(null);
  const noiseSuppressionRef = useRef(null);
  const skipSelectedOutputSyncRestartRef = useRef(false);
  const meterFillRef = useRef(null);
  const meterValueRef = useRef(null);
  const meterStatusRef = useRef(null);

  return {
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
  };
}
