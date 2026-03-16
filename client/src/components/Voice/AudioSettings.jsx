import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { useVoiceSettingsContext } from '../../contexts/VoiceContext';
import {
  getStoredVoiceProcessingMode,
  buildVoiceCaptureConstraints,
  getVoiceAudioContextOptions,
  getNoiseSuppressionRuntimeState,
  resolveNoiseSuppressionRuntimeState,
  getPreferredNoiseSuppressionImplementation,
  isUltraLowLatencyMode,
  prefersAppleSystemVoiceIsolation,
  VOICE_PROCESSING_MODES,
  VOICE_NOISE_SUPPRESSION_BACKENDS,
} from '../../utils/voiceProcessing';
import { summarizeAudioContext, summarizeTrackSnapshot } from '../../utils/voiceDiagnostics';
import { createNoiseGateNode, createRnnoiseNode, createSpeexNode } from '../../utils/rnnoise';
import { createKeyboardSuppressorNode } from '../../utils/keyboardSuppressor';
import { createSpeechFocusChain } from '../../utils/voiceToneShaping';
import {
  APPLE_VOICE_CAPTURE_OWNERS,
  createApplePcmBridgeNode,
  getFriendlyAppleVoiceFallbackMessage,
  normalizeElectronBinaryChunk,
  shouldDisableAppleVoiceForSession,
} from '../../utils/appleVoiceCapture';
import {
  addPerfPhase,
  endPerfTrace,
  endPerfTraceAfterNextPaint,
  startPerfTrace,
} from '../../utils/devPerf';
import Modal from '../Common/Modal';

function roundMs(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
}

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

function getMicLevelColor(level) {
  if (level > 60) return '#00d68f';
  if (level > 25) return '#40FF40';
  return 'var(--text-muted)';
}

function getMicStatusText(level) {
  if (level < 5) return 'No input detected — speak to test';
  if (level < 25) return 'Low input — processing mic locally';
  return 'Mic is working — processing mic locally';
}

function buildMicTestConstraints({ mode, deviceId, noiseSuppressionEnabled = false } = {}) {
  const constraints = buildVoiceCaptureConstraints({ mode, deviceId, noiseSuppressionEnabled });
  if (!constraints?.audio || !isUltraLowLatencyMode(mode)) {
    return constraints;
  }

  // Keep the premium ultra-low-latency path as stripped-down as possible.
  return {
    ...constraints,
    audio: {
      ...constraints.audio,
      echoCancellation: false,
    },
  };
}

const HEADPHONE_OUTPUT_PATTERNS = [
  /airpods?/i,
  /head(phone|set)s?/i,
  /earbuds?/i,
  /buds/i,
  /jabra/i,
  /steelseries/i,
  /bose/i,
  /sony/i,
  /sennheiser/i,
  /plantronics/i,
  /poly/i,
];

const SPEAKER_OUTPUT_PATTERNS = [
  /speaker/i,
  /built-?in/i,
  /macbook/i,
  /imac/i,
  /studio display/i,
];

const RNNOISE_MONITOR_MAKEUP_GAIN = 2.4;
const APPLE_VOICE_TEST_START_TIMEOUT_MS = 1800;

function getActiveOutputDevice(outputDevices, selectedOutputId) {
  if (selectedOutputId) {
    return outputDevices.find((device) => device.deviceId === selectedOutputId) || null;
  }
  return outputDevices.find((device) => device.deviceId === 'default') || outputDevices[0] || null;
}

function getMonitorProfile(outputDevices, selectedOutputId) {
  const activeOutput = getActiveOutputDevice(outputDevices, selectedOutputId);
  const outputLabel = activeOutput?.label || '';
  const headphoneOutput = HEADPHONE_OUTPUT_PATTERNS.some((pattern) => pattern.test(outputLabel));
  const speakerOutput = SPEAKER_OUTPUT_PATTERNS.some((pattern) => pattern.test(outputLabel));

  if (headphoneOutput) {
    return {
      id: 'full',
      gain: 1,
      label: outputLabel,
      hint: 'Headphones detected. Live monitor runs at full level.',
    };
  }

  if (!speakerOutput) {
    return {
      id: 'balanced',
      gain: 0.65,
      label: outputLabel,
      hint: 'Monitor level is tuned for your selected output device.',
    };
  }

  return {
    id: 'speaker-safe',
    gain: 0.18,
    label: outputLabel,
    hint: 'Speaker-safe monitor level is on to cut down feedback. Headphones will sound cleaner.',
  };
}

function AudioSettings({ onClose, openTraceId = null }) {
  const {
    inputDevices, outputDevices,
    selectedInput, selectedOutput,
    selectInput, selectOutput,
    setOutputDevice,
    setMicGain,
    voiceProcessingMode,
    liveVoiceFallbackReason,
    setVoiceProcessingMode,
  } = useVoiceSettingsContext();

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
  const selectedInputRef = useRef(selectedInput);
  const selectedOutputRef = useRef(selectedOutput);
  const processingModeRef = useRef(processingMode);
  const noiseSuppressionRef = useRef(noiseSuppression);
  const meterFillRef = useRef(null);
  const meterValueRef = useRef(null);
  const meterStatusRef = useRef(null);

  const updateMicMeter = useCallback((level) => {
    const normalized = Math.max(0, Math.min(100, level));
    const color = getMicLevelColor(normalized);

    if (meterFillRef.current) {
      meterFillRef.current.style.width = `${normalized}%`;
      meterFillRef.current.style.background = color;
    }

    if (meterValueRef.current) {
      meterValueRef.current.textContent = String(Math.round(normalized));
      meterValueRef.current.style.color = color;
    }

    if (meterStatusRef.current) {
      meterStatusRef.current.textContent = getMicStatusText(normalized);
    }
  }, []);

  const applyNoiseSuppressionRouting = useCallback((enabled) => {
    const routing = noiseSuppressionRoutingRef.current;
    if (!routing) {
      return false;
    }

    const processedReady = routing.processedReady === true;
    const useProcessedLane = enabled && processedReady;
    routing.rawBypassGain.gain.value = useProcessedLane ? 0 : 1;
    routing.processedGain.gain.value = useProcessedLane ? 1 : 0;
    return useProcessedLane;
  }, []);

  useEffect(() => {
    selectedInputRef.current = selectedInput;
  }, [selectedInput]);

  useEffect(() => {
    selectedOutputRef.current = selectedOutput;
  }, [selectedOutput]);

  useEffect(() => {
    processingModeRef.current = processingMode;
  }, [processingMode]);

  useEffect(() => {
    noiseSuppressionRef.current = noiseSuppression;
  }, [noiseSuppression]);

  useEffect(() => {
    if (!prefersAppleSystemVoiceIsolation() || !window.electronAPI?.primeAppleVoiceCapture) {
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

    window.electronAPI.primeAppleVoiceCapture().catch(() => {});
  }, []);

  useEffect(() => {
    if (!prefersAppleSystemVoiceIsolation() || !window.electronAPI?.isAppleVoiceCaptureSupported) {
      return;
    }

    let cancelled = false;
    window.electronAPI.isAppleVoiceCaptureSupported()
      .then((supported) => {
        if (!cancelled) {
          appleVoiceAvailableRef.current = supported !== false;
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const clearPreviewPlayback = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.srcObject = null;
      previewAudioRef.current.src = '';
      previewAudioRef.current = null;
    }
  }, []);

  const handleOutputChange = (deviceId) => {
    selectedOutputRef.current = deviceId;
    selectOutput(deviceId);
    setOutputDevice(deviceId);
  const monitorProfile = getMonitorProfile(outputDevices, deviceId);
    const targetSinkId = deviceId || 'default';

    const previewAudio = previewAudioRef.current;
    if (previewAudio?.setSinkId) {
      previewAudio.setSinkId(targetSinkId).catch(() => {});
    }
    if (monitorGainRef.current) {
      monitorGainRef.current.gain.value = monitorProfile.gain;
    }

    setTestDiagnostics((prev) => prev ? {
      ...prev,
      playback: {
        ...(prev.playback || {}),
        outputDeviceId: deviceId || null,
        outputDeviceLabel: monitorProfile.label || null,
        monitorProfile: monitorProfile.id,
        monitorGain: monitorProfile.gain,
      },
    } : prev);
  };

  const attachMonitorOutput = useCallback(async ({
    ctx,
    gainNode,
    activeOutputId,
    monitorProfile,
  }) => {
    const previewStart = performance.now();
    const monitorGain = ctx.createGain();
    const stereoMonitor = ctx.createChannelMerger(2);
    monitorGain.gain.value = monitorProfile.gain;
    monitorGainRef.current = monitorGain;
    gainNode.connect(stereoMonitor, 0, 0);
    gainNode.connect(stereoMonitor, 0, 1);
    stereoMonitor.connect(monitorGain);

    if (!activeOutputId) {
      monitorGain.connect(ctx.destination);
      return {
        mode: 'direct',
        playbackState: 'live-playing',
        playbackError: null,
        monitorSetupMs: roundMs(performance.now() - previewStart),
      };
    }

    const previewDestination = ctx.createMediaStreamDestination();
    monitorGain.connect(previewDestination);

    const previewAudio = new Audio();
    previewAudio.srcObject = previewDestination.stream;
    previewAudio.autoplay = true;
    previewAudio.playsInline = true;
    previewAudio.volume = 1;
    previewAudioRef.current = previewAudio;

    if (previewAudio.setSinkId) {
      await previewAudio.setSinkId(activeOutputId).catch(() => {});
    }

    let playbackState = 'starting';
    let playbackError = null;

    try {
      await new Promise((resolve) => {
        if (previewAudio.readyState >= HTMLMediaElement.HAVE_METADATA) {
          resolve();
          return;
        }

        const settle = () => resolve();
        previewAudio.addEventListener('loadedmetadata', settle, { once: true });
        previewAudio.addEventListener('canplay', settle, { once: true });
        setTimeout(resolve, 150);
      });
      await previewAudio.play();
      playbackState = 'live-playing';
    } catch (previewErr) {
      playbackState = 'live-blocked';
      playbackError = previewErr?.message || 'Live monitor playback failed';
    }

    return {
      mode: 'sink',
      playbackState,
      playbackError,
      monitorSetupMs: roundMs(performance.now() - previewStart),
    };
  }, []);

  const stopTest = useCallback(async () => {
    testRunIdRef.current += 1;
    setTestStarting(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (appleVoiceFrameCleanupRef.current) {
      appleVoiceFrameCleanupRef.current();
      appleVoiceFrameCleanupRef.current = null;
    }
    if (appleVoiceStateCleanupRef.current) {
      appleVoiceStateCleanupRef.current();
      appleVoiceStateCleanupRef.current = null;
    }
    if (appleVoiceSourceNodeRef.current) {
      try { appleVoiceSourceNodeRef.current.port.postMessage({ type: 'reset' }); } catch {}
      try { appleVoiceSourceNodeRef.current.disconnect?.(); } catch {}
      appleVoiceSourceNodeRef.current = null;
    }
    if (window.electronAPI?.stopAppleVoiceCapture) {
      try {
        await window.electronAPI.stopAppleVoiceCapture(APPLE_VOICE_CAPTURE_OWNERS.MIC_TEST);
      } catch {}
    }

    if (noiseSuppressorNodeRef.current) {
      try { noiseSuppressorNodeRef.current.destroy?.(); } catch {}
      try { noiseSuppressorNodeRef.current.disconnect?.(); } catch {}
      noiseSuppressorNodeRef.current = null;
    }
    if (residualDenoiserNodeRef.current) {
      try { residualDenoiserNodeRef.current.destroy?.(); } catch {}
      try { residualDenoiserNodeRef.current.disconnect?.(); } catch {}
      residualDenoiserNodeRef.current = null;
    }
    if (noiseGateNodeRef.current) {
      try { noiseGateNodeRef.current.disconnect?.(); } catch {}
      noiseGateNodeRef.current = null;
    }
    if (speechFocusChainRef.current) {
      speechFocusChainRef.current.disconnect?.();
      speechFocusChainRef.current = null;
    }
    if (keyboardSuppressorNodeRef.current) {
      try { keyboardSuppressorNodeRef.current.disconnect?.(); } catch {}
      keyboardSuppressorNodeRef.current = null;
    }
    noiseSuppressionRoutingRef.current = null;
    monitorGainRef.current = null;
    clearPreviewPlayback();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    updateMicMeter(0);
    setTesting(false);
    setTestDiagnostics((prev) => prev ? {
      ...prev,
      updatedAt: new Date().toISOString(),
      playback: {
        ...(prev.playback || {}),
        state: 'stopped',
      },
    } : prev);
  }, [clearPreviewPlayback, updateMicMeter]);

  const startAppleVoiceIsolationTest = useCallback(async ({
    activeVoiceMode,
    activeOutputId,
    monitorProfile,
    noiseSuppressionEnabled,
    runId,
    testStart,
    testStartedAt,
  }) => {
    if (!window.electronAPI?.startAppleVoiceCapture || !window.electronAPI?.isAppleVoiceCaptureSupported) {
      return false;
    }

    const supported = await window.electronAPI.isAppleVoiceCaptureSupported().catch(() => false);
    if (!supported) {
      appleVoiceAvailableRef.current = false;
      return false;
    }

    const cleanupAppleSetup = async () => {
      if (appleVoiceFrameCleanupRef.current) {
        appleVoiceFrameCleanupRef.current();
        appleVoiceFrameCleanupRef.current = null;
      }
      if (appleVoiceStateCleanupRef.current) {
        appleVoiceStateCleanupRef.current();
        appleVoiceStateCleanupRef.current = null;
      }
      if (appleVoiceSourceNodeRef.current) {
        try { appleVoiceSourceNodeRef.current.port.postMessage({ type: 'reset' }); } catch {}
        try { appleVoiceSourceNodeRef.current.disconnect?.(); } catch {}
        appleVoiceSourceNodeRef.current = null;
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.srcObject = null;
        previewAudioRef.current.src = '';
        previewAudioRef.current = null;
      }
      if (audioCtxRef.current) {
        try {
          await audioCtxRef.current.close();
        } catch {}
        audioCtxRef.current = null;
      }
      try {
        await window.electronAPI.stopAppleVoiceCapture();
      } catch {}
    };

    let helperStartMs = null;
    let audioGraphSetupMs = null;
    let monitorSetupMs = null;
    let monitorPlaybackState = 'starting';
    let monitorPlaybackError = null;
    let helperMetadata = null;

    try {
      const audioGraphStart = performance.now();
      const ctx = new AudioContext(getVoiceAudioContextOptions());
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      const sourceNode = await createApplePcmBridgeNode(ctx);
      appleVoiceSourceNodeRef.current = sourceNode;

      const gain = ctx.createGain();
      const savedGain = parseFloat(localStorage.getItem('voice:micGain') || '3');
      gain.gain.value = savedGain;
      gainRef.current = gain;
      sourceNode.connect(gain);
      audioGraphSetupMs = roundMs(performance.now() - audioGraphStart);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      gain.connect(analyser);

      appleVoiceFrameCleanupRef.current = window.electronAPI.onAppleVoiceCaptureFrame((chunk) => {
        if (testRunIdRef.current !== runId || !appleVoiceSourceNodeRef.current) {
          return;
        }

        const normalizedChunk = normalizeElectronBinaryChunk(chunk);
        if (!normalizedChunk) {
          return;
        }

        appleVoiceSourceNodeRef.current.port.postMessage(
          { type: 'push', samples: normalizedChunk },
          [normalizedChunk]
        );
      });

      appleVoiceStateCleanupRef.current = window.electronAPI.onAppleVoiceCaptureState((payload) => {
        if (testRunIdRef.current !== runId || !payload) {
          return;
        }

        if (payload.type === 'unavailable') {
          appleVoiceAvailableRef.current = false;
        }

        if (payload.type === 'error' || payload.type === 'ended') {
          setTestDiagnostics((prev) => prev ? {
            ...prev,
            updatedAt: new Date().toISOString(),
            filter: {
              ...(prev.filter || {}),
              backend: 'raw',
              suppressionEnabled: noiseSuppressionEnabled,
              loaded: false,
              fallbackReason: getFriendlyAppleVoiceFallbackMessage(payload.message),
            },
            playback: {
              ...(prev.playback || {}),
              state: 'interrupted',
            },
          } : prev);
        }
      });

      const helperStart = performance.now();
      const helperStartPromise = withTimeout(
        window.electronAPI.startAppleVoiceCapture(APPLE_VOICE_CAPTURE_OWNERS.MIC_TEST),
        APPLE_VOICE_TEST_START_TIMEOUT_MS,
        'macOS Voice Isolation took too long to start.'
      );

      const monitorResult = await attachMonitorOutput({
        ctx,
        gainNode: gain,
        activeOutputId,
        monitorProfile,
      });

      helperMetadata = await helperStartPromise;
      if (helperMetadata?.configuration && helperMetadata.configuration !== 'full-duplex') {
        throw new Error('Mac voice cleanup is unavailable in this audio configuration.');
      }
      helperStartMs = roundMs(performance.now() - helperStart);
      monitorSetupMs = monitorResult.monitorSetupMs;
      monitorPlaybackState = monitorResult.playbackState;
      monitorPlaybackError = monitorResult.playbackError;

      if (testRunIdRef.current !== runId) {
        await cleanupAppleSetup();
        return true;
      }

      setTestDiagnostics({
        updatedAt: new Date().toISOString(),
        startedAt: testStartedAt,
        mode: activeVoiceMode,
        requestedConstraints: null,
        usedDefaultDeviceFallback: false,
        sourceTrack: {
          kind: 'audio',
          label: 'Apple voice processing',
          readyState: 'live',
          enabled: true,
          muted: false,
          settings: {
            sampleRate: helperMetadata?.sampleRate || 48000,
            channelCount: helperMetadata?.channels || 1,
          },
        },
        audioContext: summarizeAudioContext(ctx),
        filter: {
          backend: VOICE_NOISE_SUPPRESSION_BACKENDS.APPLE,
          requestedBackend: VOICE_NOISE_SUPPRESSION_BACKENDS.APPLE,
          suppressionEnabled: noiseSuppressionEnabled,
          loaded: true,
          requiresWarmup: false,
          fallbackReason: null,
          workletCreateMs: helperStartMs,
        },
        playback: {
          state: monitorPlaybackState,
          error: monitorPlaybackError,
          outputDeviceId: activeOutputId || null,
          outputDeviceLabel: monitorProfile.label || null,
          monitorProfile: monitorProfile.id,
          monitorGain: monitorProfile.gain,
        },
        timingsMs: {
          audioGraphSetup: audioGraphSetupMs,
          helperStart: helperStartMs,
          monitorSetup: monitorSetupMs,
          total: roundMs(performance.now() - testStart),
        },
      });

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((sum, value) => sum + value, 0) / data.length;
        updateMicMeter(Math.min(100, (avg / 128) * 100));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
      setTesting(true);
      setTestStarting(false);
      return true;
    } catch (error) {
      await cleanupAppleSetup();
      throw error;
    }
  }, [updateMicMeter]);

  const handleClose = useCallback(() => {
    void stopTest().finally(() => {
      onClose();
    });
  }, [onClose, stopTest]);

  const startTest = useCallback(async () => {
    setTestStarting(true);
    clearPreviewPlayback();
    const activeVoiceMode = processingModeRef.current || VOICE_PROCESSING_MODES.STANDARD;
    const useRawMicPath = isUltraLowLatencyMode(activeVoiceMode);
    const activeInputId = selectedInputRef.current;
    const activeOutputId = selectedOutputRef.current;
    const monitorProfile = getMonitorProfile(outputDevices, activeOutputId);
    const noiseSuppressionEnabled = useRawMicPath ? false : noiseSuppressionRef.current;
    const shouldUseAppleVoiceProcessing =
      prefersAppleSystemVoiceIsolation()
      && appleVoiceAvailableRef.current
      && !useRawMicPath
      && noiseSuppressionEnabled
      && !activeInputId;
    const perfTraceId = startPerfTrace('mic-test-start', {
      mode: activeVoiceMode,
      inputDeviceId: activeInputId || 'default',
      outputDeviceId: activeOutputId || 'default',
      noiseSuppressionEnabled,
      preferAppleVoiceProcessing: shouldUseAppleVoiceProcessing,
    });
    addPerfPhase(perfTraceId, 'requested');
    const requestedSuppressionRuntime = getNoiseSuppressionRuntimeState({
      mode: activeVoiceMode,
      noiseSuppressionEnabled,
      preferAppleVoiceProcessing: shouldUseAppleVoiceProcessing,
    });
      const runId = ++testRunIdRef.current;
    let appliedConstraints = buildMicTestConstraints({
      mode: activeVoiceMode,
      deviceId: activeInputId,
      noiseSuppressionEnabled,
    });
      let usedDefaultDeviceFallback = false;

      try {
        const initialConstraints = appliedConstraints;
        const fallbackConstraints = buildMicTestConstraints({
        mode: activeVoiceMode,
        noiseSuppressionEnabled,
      });
        const testStartedAt = new Date().toISOString();
        const testStart = performance.now();
      let getUserMediaMs = null;
      let audioGraphSetupMs = null;
      let workletCreateMs = null;
        let monitorSetupMs = null;
        let monitorPlaybackState = 'starting';
        let monitorPlaybackError = null;

        setTesting(true);
        setTestDiagnostics({
          updatedAt: testStartedAt,
          startedAt: testStartedAt,
          mode: activeVoiceMode,
          requestedConstraints: initialConstraints.audio,
          usedDefaultDeviceFallback: false,
          filter: {
            backend: shouldUseAppleVoiceProcessing
              ? VOICE_NOISE_SUPPRESSION_BACKENDS.APPLE
              : requestedSuppressionRuntime.backend,
            requestedBackend: requestedSuppressionRuntime.backend,
            suppressionEnabled: noiseSuppressionEnabled,
            loaded: false,
            requiresWarmup: shouldUseAppleVoiceProcessing || requestedSuppressionRuntime.requiresWarmup,
            fallbackReason: null,
          },
          playback: {
            state: 'starting',
            error: null,
            outputDeviceId: activeOutputId || null,
            outputDeviceLabel: monitorProfile.label || null,
            monitorProfile: monitorProfile.id,
            monitorGain: monitorProfile.gain,
          },
        });

        if (shouldUseAppleVoiceProcessing) {
          try {
          addPerfPhase(perfTraceId, 'apple-path-requested');
          const started = await startAppleVoiceIsolationTest({
            activeVoiceMode,
            activeOutputId,
            monitorProfile,
            noiseSuppressionEnabled,
            runId,
            testStart,
            testStartedAt,
          });
          if (started) {
            endPerfTrace(perfTraceId, {
              status: 'ready',
              backend: VOICE_NOISE_SUPPRESSION_BACKENDS.APPLE,
              playbackState: 'live-playing',
            });
            return;
          }
        } catch (appleErr) {
          if (shouldDisableAppleVoiceForSession(appleErr?.message)) {
            appleVoiceAvailableRef.current = false;
          }
          console.warn('Apple voice processing test path failed, falling back to browser capture:', appleErr);
          addPerfPhase(perfTraceId, 'apple-path-fallback', {
            error: appleErr?.message || 'Apple voice processing unavailable',
          });
          setTestDiagnostics((prev) => prev ? {
            ...prev,
            updatedAt: new Date().toISOString(),
            filter: {
              ...(prev.filter || {}),
              fallbackReason: getFriendlyAppleVoiceFallbackMessage(appleErr?.message),
            },
          } : prev);
        }
      }

      let stream = null;
      try {
        const getUserMediaStart = performance.now();
        stream = await navigator.mediaDevices.getUserMedia(initialConstraints);
        getUserMediaMs = roundMs(performance.now() - getUserMediaStart);
        addPerfPhase(perfTraceId, 'get-user-media-ready', {
          durationMs: getUserMediaMs,
          usedDefaultDeviceFallback: false,
        });
      } catch (selectedDeviceErr) {
        if (!activeInputId) throw selectedDeviceErr;
        usedDefaultDeviceFallback = true;
        appliedConstraints = fallbackConstraints;
        const getUserMediaStart = performance.now();
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        getUserMediaMs = roundMs(performance.now() - getUserMediaStart);
        addPerfPhase(perfTraceId, 'get-user-media-ready', {
          durationMs: getUserMediaMs,
          usedDefaultDeviceFallback: true,
        });
      }
      if (testRunIdRef.current !== runId) {
        stream?.getTracks?.().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const sourceTrack = stream.getAudioTracks()[0] || null;
      const suppressionRuntime = resolveNoiseSuppressionRuntimeState({
        mode: activeVoiceMode,
        noiseSuppressionEnabled,
        track: sourceTrack,
      });
      const usesBrowserApm = suppressionRuntime.backend === VOICE_NOISE_SUPPRESSION_BACKENDS.WEBRTC_APM;
      const usesRnnoise = suppressionRuntime.backend === VOICE_NOISE_SUPPRESSION_BACKENDS.RNNOISE;
      const filterDiagnostics = {
        backend: suppressionRuntime.backend,
        requestedBackend: requestedSuppressionRuntime.backend,
        suppressionEnabled: noiseSuppressionEnabled,
        loaded: useRawMicPath || !suppressionRuntime.requiresWarmup,
        requiresWarmup: suppressionRuntime.requiresWarmup,
        fallbackReason: suppressionRuntime.fallbackReason,
      };

      const audioGraphStart = performance.now();
      const ctx = new AudioContext(getVoiceAudioContextOptions());
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      if (testRunIdRef.current !== runId) {
        stream.getTracks().forEach((track) => track.stop());
        ctx.close().catch(() => {});
        return;
      }
      const source = ctx.createMediaStreamSource(stream);

      const gain = ctx.createGain();
      const savedGain = parseFloat(localStorage.getItem('voice:micGain') || '3');
      gain.gain.value = savedGain;
      gainRef.current = gain;
      audioGraphSetupMs = roundMs(performance.now() - audioGraphStart);

      const processingOutput = ctx.createGain();
      processingOutput.gain.value = 1;
      processingOutput.connect(gain);

      if (useRawMicPath || usesBrowserApm || !noiseSuppressionEnabled) {
        source.connect(processingOutput);
      } else {
        const rawBypassGain = ctx.createGain();
        const processedGain = ctx.createGain();
        const processedMakeupGain = ctx.createGain();
        rawBypassGain.gain.value = 1;
        processedGain.gain.value = 0;
        processedMakeupGain.gain.value = RNNOISE_MONITOR_MAKEUP_GAIN;
        noiseSuppressionRoutingRef.current = {
          rawBypassGain,
          processedGain,
          processedReady: false,
        };
        source.connect(rawBypassGain);
        rawBypassGain.connect(processingOutput);
        processedGain.connect(processedMakeupGain);
        processedMakeupGain.connect(processingOutput);
      }

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      gain.connect(analyser);

      const monitorResult = await attachMonitorOutput({
        ctx,
        gainNode: gain,
        activeOutputId,
        monitorProfile,
      });
      monitorSetupMs = monitorResult.monitorSetupMs;
      monitorPlaybackState = monitorResult.playbackState;
      monitorPlaybackError = monitorResult.playbackError;
      addPerfPhase(perfTraceId, 'monitor-ready', {
        durationMs: monitorSetupMs,
        playbackState: monitorPlaybackState,
        playbackError: monitorPlaybackError,
      });

      if (testRunIdRef.current !== runId) {
        stream.getTracks().forEach((track) => track.stop());
        ctx.close().catch(() => {});
        return;
      }

      setTestDiagnostics({
        updatedAt: new Date().toISOString(),
        startedAt: testStartedAt,
        mode: activeVoiceMode,
        requestedConstraints: appliedConstraints.audio,
        usedDefaultDeviceFallback,
        sourceTrack: summarizeTrackSnapshot(sourceTrack),
        audioContext: summarizeAudioContext(ctx),
        filter: {
          ...filterDiagnostics,
          workletCreateMs,
        },
        playback: {
          state: monitorPlaybackState,
          error: monitorPlaybackError,
          outputDeviceId: activeOutputId || null,
          outputDeviceLabel: monitorProfile.label || null,
          monitorProfile: monitorProfile.id,
          monitorGain: monitorProfile.gain,
        },
        timingsMs: {
          getUserMedia: getUserMediaMs,
          audioGraphSetup: audioGraphSetupMs,
          monitorSetup: monitorSetupMs,
          total: roundMs(performance.now() - testStart),
        },
      });

      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
        updateMicMeter(Math.min(100, (avg / 128) * 100));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
      setTesting(true);
      setTestStarting(false);
      endPerfTrace(perfTraceId, {
        status: 'ready',
        backend: suppressionRuntime.backend,
        playbackState: monitorPlaybackState,
        usedDefaultDeviceFallback,
      });

      if (!useRawMicPath && usesRnnoise) {
        void (async () => {
          try {
            const workletStart = performance.now();
            const rnnoiseNode = await createRnnoiseNode(ctx, { maxChannels: 1 });
            const nodeMs = roundMs(performance.now() - workletStart);
            if (
              testRunIdRef.current !== runId
              || audioCtxRef.current !== ctx
              || isUltraLowLatencyMode(processingModeRef.current)
            ) {
              rnnoiseNode.destroy?.();
              return;
            }

            noiseSuppressorNodeRef.current = rnnoiseNode;
            const routing = noiseSuppressionRoutingRef.current;
            if (!routing) {
              rnnoiseNode.destroy?.();
              return;
            }
            const speexNode = await createSpeexNode(ctx, { maxChannels: 1 });
            const noiseGateNode = await createNoiseGateNode(ctx, { maxChannels: 1 });
            const speechFocusChain = createSpeechFocusChain(ctx);
            const keyboardSuppressorNode = await createKeyboardSuppressorNode(ctx, { maxChannels: 1 });
            if (
              testRunIdRef.current !== runId
              || audioCtxRef.current !== ctx
              || isUltraLowLatencyMode(processingModeRef.current)
            ) {
              keyboardSuppressorNode.disconnect?.();
              speechFocusChain.disconnect?.();
              speexNode.destroy?.();
              noiseGateNode.disconnect?.();
              rnnoiseNode.destroy?.();
              return;
            }
            residualDenoiserNodeRef.current = speexNode;
            noiseGateNodeRef.current = noiseGateNode;
            speechFocusChainRef.current = speechFocusChain;
            keyboardSuppressorNodeRef.current = keyboardSuppressorNode;
            routing.processedReady = true;
            source.connect(rnnoiseNode);
            rnnoiseNode.connect(speexNode);
            speexNode.connect(noiseGateNode);
            noiseGateNode.connect(speechFocusChain.input);
            speechFocusChain.output.connect(keyboardSuppressorNode);
            keyboardSuppressorNode.connect(routing.processedGain);
            const usingProcessedLane = applyNoiseSuppressionRouting(noiseSuppressionRef.current);
            workletCreateMs = nodeMs;
            setTestDiagnostics((prev) => prev ? {
              ...prev,
              updatedAt: new Date().toISOString(),
              filter: {
                ...(prev.filter || {}),
                backend: usingProcessedLane ? suppressionRuntime.backend : 'raw',
                suppressionEnabled: noiseSuppressionRef.current,
                loaded: true,
                fallbackReason: null,
                workletCreateMs: nodeMs,
              },
            } : prev);
            addPerfPhase(perfTraceId, 'rnnoise-ready', {
              durationMs: nodeMs,
            });
          } catch (rnnoiseErr) {
            if (testRunIdRef.current !== runId || audioCtxRef.current !== ctx) {
              return;
            }

            const fallbackReason = rnnoiseErr?.message || 'RNNoise failed to initialize';
            console.warn('RNNoise test warm-up failed, staying on raw mic:', rnnoiseErr);
            const routing = noiseSuppressionRoutingRef.current;
            if (routing) {
              routing.processedReady = false;
            }
            applyNoiseSuppressionRouting(noiseSuppressionRef.current);
            setTestDiagnostics((prev) => prev ? {
              ...prev,
              updatedAt: new Date().toISOString(),
              filter: {
                ...(prev.filter || {}),
                backend: 'raw',
                suppressionEnabled: noiseSuppressionRef.current,
                loaded: false,
                fallbackReason,
              },
            } : prev);
            addPerfPhase(perfTraceId, 'rnnoise-fallback', {
              error: fallbackReason,
            });
          }
        })();
      }
    } catch (err) {
      setTestStarting(false);
      setTesting(false);
      setTestDiagnostics({
        updatedAt: new Date().toISOString(),
        mode: activeVoiceMode,
        requestedConstraints: appliedConstraints.audio,
        usedDefaultDeviceFallback,
        error: err?.message || 'Mic test failed',
      });
      endPerfTrace(perfTraceId, {
        status: 'error',
        error: err?.message || 'Mic test failed',
        usedDefaultDeviceFallback,
      });
      console.error('Mic test failed:', err);
    }
  }, [attachMonitorOutput, clearPreviewPlayback, outputDevices, updateMicMeter, applyNoiseSuppressionRouting, startAppleVoiceIsolationTest]);

  const restartTest = useCallback(() => {
    if (!testing) return;
    void stopTest().then(() => {
      startTest();
    });
  }, [startTest, stopTest, testing]);

  useEffect(() => {
    return () => {
      void stopTest();
    };
  }, [stopTest]);

  useEffect(() => {
    const nextMode = voiceProcessingMode || getStoredVoiceProcessingMode();
    const suppressionEnabled = !isUltraLowLatencyMode(nextMode);
    setProcessingModeLocal(nextMode);
    setNoiseSuppression(suppressionEnabled);
    processingModeRef.current = nextMode;
    noiseSuppressionRef.current = suppressionEnabled;
  }, [voiceProcessingMode]);

  useEffect(() => {
    if (!testing) {
      updateMicMeter(0);
    }
  }, [testing, updateMicMeter]);

  useEffect(() => {
    if (!openTraceId || completedOpenTraceIdsRef.current.has(openTraceId)) {
      return;
    }

    completedOpenTraceIdsRef.current.add(openTraceId);
    endPerfTraceAfterNextPaint(openTraceId, {
      status: 'ready',
      surface: 'audio-settings',
    });
  }, [openTraceId]);

  const handleInputChange = (deviceId) => {
    selectedInputRef.current = deviceId;
    selectInput(deviceId);
    restartTest();
  };

  const handleSelectProcessingMode = (nextMode) => {
    if (nextMode === processingModeRef.current) {
      return;
    }

    const uiTraceId = startPerfTrace('voice-mode-switch-ui', {
      surface: 'audio-settings',
      fromMode: processingModeRef.current,
      toMode: nextMode,
      testing,
    });
    addPerfPhase(uiTraceId, 'click');

    const nextState = setVoiceProcessingMode
      ? setVoiceProcessingMode(nextMode, {
        perfSource: 'audio-settings',
        uiTraceId,
      })
      : { mode: nextMode, noiseSuppression: nextMode !== VOICE_PROCESSING_MODES.ULTRA_LOW_LATENCY };

    processingModeRef.current = nextState.mode;
    noiseSuppressionRef.current = nextState.noiseSuppression;
    setProcessingModeLocal(nextState.mode);
    setNoiseSuppression(nextState.noiseSuppression);
    restartTest();
    endPerfTraceAfterNextPaint(uiTraceId, {
      status: 'ready',
      surface: 'audio-settings',
      testing,
    });
  };
  const lowLatencyEnabled = isUltraLowLatencyMode(processingMode);
  const activeMonitorProfile = getMonitorProfile(outputDevices, selectedOutput);
  const preferredSuppressionImplementation = getPreferredNoiseSuppressionImplementation();
  const noiseSuppressionFallbackReason = !lowLatencyEnabled
    ? (testDiagnostics?.filter?.fallbackReason || liveVoiceFallbackReason || null)
    : null;
  const selectStyle = {
    width: '100%',
    padding: '8px 10px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 13,
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: 6,
  };

  return (
    <Modal onClose={handleClose} title="Audio Settings">
      <div style={{ minWidth: 320 }}>
        {/* Input device */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Input Device</label>
          <select
            value={selectedInput}
            onChange={e => handleInputChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">Default</option>
            {inputDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>

          <div style={{ marginTop: 10 }}>
            <button
              onClick={testing ? stopTest : startTest}
              disabled={testStarting && !testing}
              style={{
                padding: '6px 14px',
                background: testing ? 'var(--danger)' : 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: testing ? '#fff' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 500,
                cursor: testStarting ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
                opacity: testStarting ? 0.85 : 1,
              }}
            >
              {testStarting ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Starting...
                </>
              ) : testing ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                  Stop
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                  Test Mic
                </>
              )}
            </button>

            {testing && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    flex: 1,
                    height: 4,
                    background: 'var(--bg-primary)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: '0%',
                      height: '100%',
                      background: 'var(--text-muted)',
                      borderRadius: 2,
                      transition: 'background 0.12s ease',
                    }} ref={meterFillRef} />
                  </div>
                  <span style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    minWidth: 20,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }} ref={meterValueRef}>
                    0
                  </span>
                </div>
                <span
                  ref={meterStatusRef}
                  style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, display: 'block' }}
                >
                  No input detected — speak to test
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block', lineHeight: 1.4 }}>
                  You should hear yourself immediately while the test is running.
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block', lineHeight: 1.4 }}>
                  {activeMonitorProfile.hint}
                </span>
                {!lowLatencyEnabled && noiseSuppression && testing && testDiagnostics?.filter?.requiresWarmup && !testDiagnostics?.filter?.loaded && !noiseSuppressionFallbackReason && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block', lineHeight: 1.4 }}>
                    Noise suppression is starting. You will keep hearing your regular mic until it is ready.
                  </span>
                )}
                {!testing && testStarting && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block', lineHeight: 1.4 }}>
                    Starting mic monitor.
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mic sensitivity */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Mic Sensitivity</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            <input
              type="range"
              min="1"
              max="5"
              step="0.5"
              value={micGain}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setMicGainLocal(val);
                if (gainRef.current) gainRef.current.gain.value = val;
                if (setMicGain) setMicGain(val);
              }}
              style={{
                flex: 1,
                accentColor: 'var(--accent)',
                cursor: 'pointer',
                opacity: 1,
              }}
            />
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              minWidth: 28,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {micGain}x
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            {lowLatencyEnabled
              ? 'Still available when cleanup is off. This boosts input level, not processing latency.'
              : 'Increase for quiet mics (laptop built-in)'}
          </div>
        </div>

        {/* Noise suppression */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Audio Processing</label>
          <button
            onClick={() => handleSelectProcessingMode(VOICE_PROCESSING_MODES.STANDARD)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '8px 10px',
              background: lowLatencyEnabled ? 'var(--bg-input)' : 'rgba(255, 122, 26, 0.08)',
              border: `1px solid ${lowLatencyEnabled ? 'var(--border)' : 'rgba(255, 122, 26, 0.28)'}`,
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 13,
              cursor: 'pointer',
              transition: 'border-color 0.2s',
              textAlign: 'left',
              marginBottom: 10,
            }}
          >
            <div style={{
              width: 32,
              height: 18,
              borderRadius: 9,
              background: lowLatencyEnabled ? 'var(--bg-tertiary)' : 'var(--accent)',
              border: `1px solid ${lowLatencyEnabled ? 'var(--border-strong)' : 'var(--accent)'}`,
              position: 'relative',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}>
              <div style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: '#fff',
                position: 'absolute',
                top: 1,
                left: lowLatencyEnabled ? 1 : 16,
                transition: 'left 0.2s',
              }} />
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 12 }}>Noise Suppression</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.4 }}>
                {preferredSuppressionImplementation.detail}
              </div>
            </div>
          </button>
          <button
            onClick={() => handleSelectProcessingMode(VOICE_PROCESSING_MODES.ULTRA_LOW_LATENCY)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '8px 10px',
              background: lowLatencyEnabled ? 'rgba(255, 82, 82, 0.08)' : 'var(--bg-input)',
              border: `1px solid ${lowLatencyEnabled ? 'rgba(255, 82, 82, 0.26)' : 'var(--border)'}`,
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 13,
              cursor: 'pointer',
              transition: 'border-color 0.2s',
              textAlign: 'left',
            }}
          >
            <div style={{
              width: 32,
              height: 18,
              borderRadius: 9,
              background: lowLatencyEnabled ? 'var(--danger)' : 'var(--bg-tertiary)',
              border: `1px solid ${lowLatencyEnabled ? 'var(--danger)' : 'var(--border-strong)'}`,
              position: 'relative',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}>
              <div style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: '#fff',
                position: 'absolute',
                top: 1,
                left: lowLatencyEnabled ? 16 : 1,
                transition: 'left 0.2s',
              }} />
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 12 }}>Ultra Low Latency</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.4 }}>
                Raw mic path with near-zero extra processing. Best with headsets when you want the fastest possible response.
              </div>
            </div>
          </button>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
            {lowLatencyEnabled
              ? 'Ultra Low Latency is intentionally raw. It skips cleanup and echo control so you get the fastest response.'
              : 'Noise Suppression keeps the cleanup path active while the standard voice path handles speaker safety in the background.'}
          </div>
          {noiseSuppressionFallbackReason && (
            <div style={{
              fontSize: 10,
              color: 'var(--danger)',
              marginTop: 6,
              lineHeight: 1.4,
              padding: '8px 10px',
              borderRadius: 6,
              background: 'rgba(255, 82, 82, 0.08)',
              border: '1px solid rgba(255, 82, 82, 0.22)',
            }}>
              {noiseSuppressionFallbackReason}
            </div>
          )}
        </div>

        {/* Output device */}
        <div>
          <label style={labelStyle}>Output Device</label>
          <select
            value={selectedOutput}
            onChange={e => handleOutputChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">Default</option>
            {outputDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
            {activeMonitorProfile.hint}
          </div>
        </div>

        {/* Close button */}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleClose}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.target.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.target.style.color = 'var(--text-secondary)'}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default memo(AudioSettings);
