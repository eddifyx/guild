import { useState, useRef, useCallback, useEffect } from 'react';
import { Device } from 'mediasoup-client';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { flushPendingControlMessagesNow } from '../socket';
import { playConnectChime, playLeaveChime, playStreamStartChime, playStreamStopChime } from '../utils/chime';
import {
  summarizeAudioContext,
  summarizeConsumerStats,
  summarizeProducerStats,
  summarizeTrackSnapshot,
} from '../utils/voiceDiagnostics';
import {
  applyVoiceModeDependencies,
  buildVoiceCaptureConstraints,
  buildVoiceTrackConstraintPatch,
  getNoiseSuppressionRuntimeState,
  resolveNoiseSuppressionRuntimeState,
  getStoredVoiceProcessingMode,
  getVoiceAudioContextOptions,
  isUltraLowLatencyMode,
  persistNoiseSuppressionEnabled,
  persistVoiceProcessingMode,
  prefersAppleSystemVoiceIsolation,
  VOICE_PROCESSING_MODES,
  VOICE_NOISE_SUPPRESSION_BACKENDS,
} from '../utils/voiceProcessing';
import { createNoiseGateNode, createRnnoiseNode, createSpeexNode } from '../utils/rnnoise';
import { createKeyboardSuppressorNode } from '../utils/keyboardSuppressor';
import { createSpeechFocusChain } from '../utils/voiceToneShaping';
import {
  APPLE_VOICE_CAPTURE_OWNERS,
  createApplePcmBridgeNode,
  getFriendlyAppleVoiceFallbackMessage,
  normalizeElectronBinaryChunk,
  shouldDisableAppleVoiceForSession,
} from '../utils/appleVoiceCapture';
import {
  addPerfPhase,
  cancelPerfTrace,
  endPerfTrace,
  startPerfTrace,
} from '../utils/devPerf';
import {
  generateVoiceKey,
  getVoiceKey,
  setVoiceKey,
  clearVoiceKey,
  distributeVoiceKey,
  isInsertableStreamsSupported,
  attachSenderEncryption,
  attachReceiverDecryption,
  setVoiceChannelId,
  setVoiceChannelParticipants,
  waitForVoiceKey,
} from '../crypto/voiceEncryption';
import { isE2EInitialized } from '../crypto/sessionManager';
import { toBase64 } from '../crypto/primitives';
import { hasKnownNpub, rememberUsers } from '../crypto/identityDirectory.js';

const MAC_SCREEN_CAPTURE_PERMISSION_MESSAGE = 'Screen sharing needs macOS Screen Recording permission. Open System Settings > Privacy & Security > Screen & System Audio Recording and enable /guild, then fully restart the app.';
const RNNOISE_SEND_MAKEUP_GAIN = 2.4;
const APPLE_VOICE_LIVE_START_TIMEOUT_MS = 3200;
const SCREEN_SHARE_CAPTURE_IDEAL_WIDTH = 2560;
const SCREEN_SHARE_CAPTURE_IDEAL_HEIGHT = 1440;
const SCREEN_SHARE_TARGET_WIDTH = 1920;
const SCREEN_SHARE_TARGET_HEIGHT = 1080;
const SCREEN_SHARE_TARGET_FPS = 30;
const SCREEN_SHARE_CAPTURE_MAX_FPS = 60;
const SCREEN_SHARE_MAX_BITRATE = 24_000_000;
const SCREEN_SHARE_MIN_BITRATE_KBPS = 3000;
const SCREEN_SHARE_START_BITRATE_KBPS = 12_000;

function applyNoiseSuppressionRoutingTo(routing, enabled) {
  if (!routing) {
    return false;
  }

  const processedReady = routing.processedReady === true;
  const useProcessedLane = enabled && processedReady;
  routing.rawBypassGain.gain.value = useProcessedLane ? 0 : 1;
  routing.processedGain.gain.value = useProcessedLane ? 1 : 0;
  return useProcessedLane;
}

function areVoiceDiagnosticsEnabled() {
  return Boolean(import.meta.env.DEV);
}

function roundMs(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
}

function roundRate(value, decimals = 1) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatResolution(width, height) {
  if (!width || !height) return null;
  return `${width}x${height}`;
}

async function applyPreferredScreenShareConstraints(videoTrack) {
  if (!videoTrack?.applyConstraints) return;

  const attempts = [
    {
      width: { ideal: SCREEN_SHARE_CAPTURE_IDEAL_WIDTH, min: SCREEN_SHARE_TARGET_WIDTH },
      height: { ideal: SCREEN_SHARE_CAPTURE_IDEAL_HEIGHT, min: SCREEN_SHARE_TARGET_HEIGHT },
      frameRate: { ideal: SCREEN_SHARE_TARGET_FPS, min: 24, max: SCREEN_SHARE_CAPTURE_MAX_FPS },
    },
    {
      width: { ideal: SCREEN_SHARE_TARGET_WIDTH },
      height: { ideal: SCREEN_SHARE_TARGET_HEIGHT },
      frameRate: { ideal: SCREEN_SHARE_TARGET_FPS, min: 24, max: SCREEN_SHARE_TARGET_FPS },
    },
    {
      width: SCREEN_SHARE_TARGET_WIDTH,
      height: SCREEN_SHARE_TARGET_HEIGHT,
      frameRate: SCREEN_SHARE_TARGET_FPS,
    },
  ];

  for (const constraints of attempts) {
    try {
      await videoTrack.applyConstraints(constraints);
      return;
    } catch {}
  }
}

function normalizeVoiceErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error.trim();
  return String(error?.message || error?.name || error).trim();
}

function isExpectedVoiceTeardownError(error) {
  const normalized = normalizeVoiceErrorMessage(error).toLowerCase();
  if (!normalized) return false;

  return normalized === 'closed'
    || normalized === 'transport closed'
    || normalized === 'connection closed'
    || normalized === 'producer closed'
    || normalized === 'consumer closed'
    || normalized.endsWith(': closed')
    || normalized.includes('awaitqueuestoppederror')
    || normalized.includes('transport closed')
    || normalized.includes('connection closed');
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

function buildPlaybackErrorMessage(error) {
  if (!error) return 'Playback failed';
  return error?.message || error?.name || String(error);
}

async function buildScreenShareStartError(err) {
  const baseMessage = err?.message || 'Secure screen sharing could not start.';
  const platform = window.electronAPI?.getPlatform?.();
  if (platform !== 'darwin') {
    return baseMessage;
  }

  const normalized = String(baseMessage).toLowerCase();
  const looksLikeCaptureStartFailure =
    normalized.includes('could not start media source')
    || normalized.includes('could not start video source')
    || normalized.includes('could not start video capture');

  if (!looksLikeCaptureStartFailure) {
    return baseMessage;
  }

  try {
    const status = await window.electronAPI?.getScreenCaptureAccessStatus?.();
    if (status === 'denied' || status === 'restricted') {
      return MAC_SCREEN_CAPTURE_PERMISSION_MESSAGE;
    }
  } catch {}

  return 'Screen sharing could not start the selected source. On macOS this usually means Screen Recording permission is missing or the selected source became unavailable. Check System Settings > Privacy & Security > Screen & System Audio Recording, then retry with a full screen source.';
}

export function useVoice() {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [channelId, setChannelId] = useState(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [peers, setPeers] = useState({}); // { userId: { muted, deafened, speaking } }
  const [joinError, setJoinError] = useState(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState(null);
  const [screenShareError, setScreenShareError] = useState(null);
  const [incomingScreenShares, setIncomingScreenShares] = useState([]); // [{ userId, stream }]
  const [screenShareDiagnostics, setScreenShareDiagnostics] = useState(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [voiceE2E, setVoiceE2E] = useState(false); // Whether voice E2E encryption is active
  const [e2eWarning, setE2EWarning] = useState(null); // Warning message when E2E fails
  const [voiceProcessingMode, setVoiceProcessingModeState] = useState(() => getStoredVoiceProcessingMode());
  const [liveVoiceFallbackReason, setLiveVoiceFallbackReason] = useState(null);
  const [voiceDiagnostics, setVoiceDiagnostics] = useState(() => ({
    updatedAt: null,
    session: null,
    liveCapture: null,
    senderStats: null,
    screenShare: null,
    consumers: {},
  }));

  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producerRef = useRef(null);
  const consumersRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const audioElementsRef = useRef(new Map());
  const userAudioRef = useRef(new Map()); // userId -> Map<producerId, HTMLAudioElement>
  const vadIntervalRef = useRef(null);
  const channelIdRef = useRef(null);
  const micAudioCtxRef = useRef(null);
  const micGainNodeRef = useRef(null);
  const noiseSuppressorNodeRef = useRef(null);
  const residualDenoiserNodeRef = useRef(null);
  const noiseGateNodeRef = useRef(null);
  const speechFocusChainRef = useRef(null);
  const keyboardSuppressorNodeRef = useRef(null);
  const noiseSuppressionRoutingRef = useRef(null);
  const appleVoiceFrameCleanupRef = useRef(null);
  const appleVoiceStateCleanupRef = useRef(null);
  const appleVoiceSourceNodeRef = useRef(null);
  const appleVoiceAvailableRef = useRef(prefersAppleSystemVoiceIsolation());
  const screenShareProducerRef = useRef(null);
  const screenShareAudioProducerRef = useRef(null);
  const screenShareStreamRef = useRef(null);
  const screenShareVideosRef = useRef(new Map()); // producerId -> { userId, stream }
  const producerUserMapRef = useRef(new Map()); // producerId -> producerUserId
  const producerMetaRef = useRef(new Map()); // producerId -> { userId, kind, source }
  const mutedRef = useRef(false);
  const deafenedRef = useRef(false);
  const participantIdsRef = useRef([]);
  const joinGenRef = useRef(0); // Generation counter to abort stale joins
  const pendingLiveReconfigureRef = useRef(null);
  const pendingVoiceModeSwitchTraceRef = useRef(null);
  const voiceProcessingModeRef = useRef(voiceProcessingMode);
  const liveCaptureRef = useRef(null);
  const liveCaptureConfigGenRef = useRef(0);
  const screenShareStatsRef = useRef(null);

  const applyNoiseSuppressionRouting = useCallback((enabled) => {
    return applyNoiseSuppressionRoutingTo(noiseSuppressionRoutingRef.current, enabled);
  }, []);

  const updateVoiceDiagnostics = useCallback((updater) => {
    if (!areVoiceDiagnosticsEnabled()) return;
    setVoiceDiagnostics((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      return {
        ...next,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const switchLiveCaptureModeInPlace = useCallback((nextMode, { perfTraceId = null } = {}) => {
    const capture = liveCaptureRef.current;
    if (!capture) {
      return false;
    }

    const wantsProcessedLane = !isUltraLowLatencyMode(nextMode);

    if (!capture.routing) {
      if (wantsProcessedLane) {
        return false;
      }

      addPerfPhase(perfTraceId, 'routing-only', {
        backend: 'raw',
        mode: nextMode,
      });
      endPerfTrace(perfTraceId, {
        status: 'ready',
        strategy: 'routing-only',
        backend: 'raw',
        mode: nextMode,
      });
      if (pendingVoiceModeSwitchTraceRef.current === perfTraceId) {
        pendingVoiceModeSwitchTraceRef.current = null;
      }
      return true;
    }

    if (wantsProcessedLane && capture.routing.processedReady !== true) {
      return false;
    }

    const usingProcessedLane = applyNoiseSuppressionRoutingTo(capture.routing, wantsProcessedLane);
    const activeBackend = usingProcessedLane
      ? (
        capture.usesAppleVoiceProcessing
          ? VOICE_NOISE_SUPPRESSION_BACKENDS.APPLE
          : capture.noiseSuppressorNode
            ? VOICE_NOISE_SUPPRESSION_BACKENDS.RNNOISE
            : 'raw'
      )
      : 'raw';
    const fallbackReason = wantsProcessedLane && !usingProcessedLane
      ? 'Noise suppression is unavailable right now.'
      : null;

    setLiveVoiceFallbackReason(fallbackReason);
    updateVoiceDiagnostics((prev) => prev?.liveCapture ? {
      ...prev,
      liveCapture: {
        ...prev.liveCapture,
        mode: nextMode,
        filter: {
          ...(prev.liveCapture.filter || {}),
          backend: activeBackend,
          suppressionEnabled: wantsProcessedLane,
          loaded: wantsProcessedLane ? usingProcessedLane : true,
          fallbackReason,
        },
      },
    } : prev);

    addPerfPhase(perfTraceId, 'routing-only', {
      backend: activeBackend,
      mode: nextMode,
    });
    endPerfTrace(perfTraceId, {
      status: 'ready',
      strategy: 'routing-only',
      backend: activeBackend,
      mode: nextMode,
      fallbackReason,
    });
    if (pendingVoiceModeSwitchTraceRef.current === perfTraceId) {
      pendingVoiceModeSwitchTraceRef.current = null;
    }
    return true;
  }, [updateVoiceDiagnostics]);

  const syncLiveCaptureRefs = useCallback((capture) => {
    liveCaptureRef.current = capture;
    localStreamRef.current = capture?.stream || null;
    micAudioCtxRef.current = capture?.micCtx || null;
    micGainNodeRef.current = capture?.gainNode || null;
    noiseSuppressorNodeRef.current = capture?.noiseSuppressorNode || null;
    residualDenoiserNodeRef.current = capture?.residualDenoiserNode || null;
    noiseGateNodeRef.current = capture?.noiseGateNode || null;
    speechFocusChainRef.current = capture?.speechFocusChain || null;
    keyboardSuppressorNodeRef.current = capture?.keyboardSuppressorNode || null;
    noiseSuppressionRoutingRef.current = capture?.routing || null;
    appleVoiceFrameCleanupRef.current = capture?.appleVoiceFrameCleanup || null;
    appleVoiceStateCleanupRef.current = capture?.appleVoiceStateCleanup || null;
    appleVoiceSourceNodeRef.current = capture?.appleVoiceSourceNode || null;
  }, []);

  const disposeLiveCapture = useCallback(async (capture, { releaseOwner = true } = {}) => {
    if (!capture || capture.disposed) {
      return;
    }

    capture.disposed = true;

    if (capture.appleVoiceFrameCleanup) {
      try { capture.appleVoiceFrameCleanup(); } catch {}
      capture.appleVoiceFrameCleanup = null;
    }
    if (capture.appleVoiceStateCleanup) {
      try { capture.appleVoiceStateCleanup(); } catch {}
      capture.appleVoiceStateCleanup = null;
    }
    if (capture.appleVoiceSourceNode) {
      try { capture.appleVoiceSourceNode.port.postMessage({ type: 'reset' }); } catch {}
      try { capture.appleVoiceSourceNode.disconnect?.(); } catch {}
      capture.appleVoiceSourceNode = null;
    }
    if (capture.noiseSuppressorNode) {
      try { capture.noiseSuppressorNode.destroy?.(); } catch {}
      try { capture.noiseSuppressorNode.disconnect?.(); } catch {}
      capture.noiseSuppressorNode = null;
    }
    if (capture.residualDenoiserNode) {
      try { capture.residualDenoiserNode.destroy?.(); } catch {}
      try { capture.residualDenoiserNode.disconnect?.(); } catch {}
      capture.residualDenoiserNode = null;
    }
    if (capture.noiseGateNode) {
      try { capture.noiseGateNode.disconnect?.(); } catch {}
      capture.noiseGateNode = null;
    }
    if (capture.speechFocusChain) {
      try { capture.speechFocusChain.disconnect?.(); } catch {}
      capture.speechFocusChain = null;
    }
    if (capture.keyboardSuppressorNode) {
      try { capture.keyboardSuppressorNode.disconnect?.(); } catch {}
      capture.keyboardSuppressorNode = null;
    }
    if (capture.micCtx) {
      try { await capture.micCtx.close(); } catch {}
      capture.micCtx = null;
    }
    if (capture.stream) {
      if (capture.ownsStream !== false) {
        try { capture.stream.getTracks().forEach((track) => track.stop()); } catch {}
      }
      capture.stream = null;
    }
    if (releaseOwner && capture.usesAppleVoiceProcessing && window.electronAPI?.stopAppleVoiceCapture) {
      try {
        await window.electronAPI.stopAppleVoiceCapture(APPLE_VOICE_CAPTURE_OWNERS.LIVE_VOICE);
      } catch {}
    }
  }, []);

  const createLiveMicCapture = useCallback(async ({
    chId,
    mode = getStoredVoiceProcessingMode(),
    previousCapture = null,
  }) => {
    const activeVoiceProcessingMode = mode;
    const useRawMicPath = isUltraLowLatencyMode(activeVoiceProcessingMode);
    const noiseSuppressionEnabled = !useRawMicPath;
    const inputId = localStorage.getItem('voice:inputDeviceId');
    const requestedInputId = inputId || '';
    const preferAppleVoiceProcessing =
      prefersAppleSystemVoiceIsolation()
      && appleVoiceAvailableRef.current
      && noiseSuppressionEnabled
      && !inputId;
    const requestedSuppressionRuntime = getNoiseSuppressionRuntimeState({
      mode: activeVoiceProcessingMode,
      noiseSuppressionEnabled,
      preferAppleVoiceProcessing,
    });
    const initialConstraints = buildVoiceCaptureConstraints({
      mode: activeVoiceProcessingMode,
      deviceId: inputId,
      noiseSuppressionEnabled,
    });
    const fallbackConstraints = buildVoiceCaptureConstraints({
      mode: activeVoiceProcessingMode,
      noiseSuppressionEnabled,
    });
    let appliedConstraints = initialConstraints;
    const captureStartedAt = new Date().toISOString();
    const captureStart = performance.now();
    let getUserMediaMs = null;
    let audioGraphSetupMs = null;
    let workletCreateMs = null;
    let usedDefaultDeviceFallback = false;
    let reusedExistingStream = false;
    let stream = null;

    const previousTrack = previousCapture?.stream?.getAudioTracks?.()?.[0] || null;
    const canReuseExistingStream =
      previousCapture?.stream
      && previousTrack?.readyState === 'live'
      && (previousCapture.requestedInputId || '') === requestedInputId
      && (!requestedInputId || previousCapture.usedDefaultDeviceFallback !== true);

    if (canReuseExistingStream) {
      try {
        await previousTrack.applyConstraints?.(buildVoiceTrackConstraintPatch({
          mode: activeVoiceProcessingMode,
          noiseSuppressionEnabled,
        }));
        stream = previousCapture.stream;
        reusedExistingStream = true;
        getUserMediaMs = 0;
      } catch (reuseErr) {
        console.warn('[Voice] Could not reuse live mic track constraints, reacquiring:', reuseErr);
      }
    }

    if (!stream) {
      try {
        try {
          const getUserMediaStart = performance.now();
          stream = await navigator.mediaDevices.getUserMedia(initialConstraints);
          getUserMediaMs = roundMs(performance.now() - getUserMediaStart);
        } catch (micErr) {
          console.warn('Saved mic device failed, trying default:', micErr);
          usedDefaultDeviceFallback = true;
          appliedConstraints = fallbackConstraints;
          const getUserMediaStart = performance.now();
          stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
          getUserMediaMs = roundMs(performance.now() - getUserMediaStart);
        }
      } catch (micErr) {
        return {
          capture: null,
          error: micErr,
          diagnostics: {
            channelId: chId,
            startedAt: captureStartedAt,
            mode: activeVoiceProcessingMode,
            requestedConstraints: appliedConstraints.audio,
            usedDefaultDeviceFallback,
            reusedSourceStream: false,
            filter: {
              backend: requestedSuppressionRuntime.backend,
              requestedBackend: requestedSuppressionRuntime.backend,
              suppressionEnabled: noiseSuppressionEnabled,
              loaded: useRawMicPath || !requestedSuppressionRuntime.requiresWarmup,
              requiresWarmup: requestedSuppressionRuntime.requiresWarmup,
              fallbackReason: null,
            },
            timingsMs: {
              getUserMedia: getUserMediaMs,
              total: roundMs(performance.now() - captureStart),
            },
            error: micErr?.message || 'Microphone unavailable',
          },
        };
      }
    }

    const sourceTrack = stream.getAudioTracks()[0] || null;
    let suppressionRuntime = preferAppleVoiceProcessing
      ? {
        ...requestedSuppressionRuntime,
        requestedBackend: requestedSuppressionRuntime.backend,
        fallbackReason: null,
      }
      : resolveNoiseSuppressionRuntimeState({
        mode: activeVoiceProcessingMode,
        noiseSuppressionEnabled,
        track: sourceTrack,
      });

    const capture = {
      disposed: false,
      stream,
      ownsStream: !reusedExistingStream,
      requestedInputId,
      usedDefaultDeviceFallback,
      sourceTrack,
      micCtx: null,
      gainNode: null,
      outputTrack: null,
      routing: null,
      noiseSuppressorNode: null,
      residualDenoiserNode: null,
      noiseGateNode: null,
      speechFocusChain: null,
      keyboardSuppressorNode: null,
      appleVoiceFrameCleanup: null,
      appleVoiceStateCleanup: null,
      appleVoiceSourceNode: null,
      usesAppleVoiceProcessing: false,
    };

    const filterDiagnostics = {
      backend: suppressionRuntime.backend,
      requestedBackend: requestedSuppressionRuntime.backend,
      suppressionEnabled: noiseSuppressionEnabled,
      loaded: useRawMicPath || !suppressionRuntime.requiresWarmup,
      requiresWarmup: suppressionRuntime.requiresWarmup,
      fallbackReason: suppressionRuntime.fallbackReason,
    };

    const audioGraphStart = performance.now();
    const micCtx = new AudioContext(getVoiceAudioContextOptions());
    capture.micCtx = micCtx;
    if (micCtx.state === 'suspended') {
      await micCtx.resume().catch(() => {});
    }
    const micSource = micCtx.createMediaStreamSource(stream);
    const gainNode = micCtx.createGain();
    const savedGain = parseFloat(localStorage.getItem('voice:micGain') || '3');
    gainNode.gain.value = savedGain;
    capture.gainNode = gainNode;
    const destination = micCtx.createMediaStreamDestination();
    gainNode.connect(destination);
    capture.outputTrack = destination.stream.getAudioTracks()[0] || stream.getAudioTracks()[0] || null;
    audioGraphSetupMs = roundMs(performance.now() - audioGraphStart);

    const ensureBypassRouting = () => {
      if (capture.routing) {
        return capture.routing;
      }

      const rawBypassGain = micCtx.createGain();
      const processedGain = micCtx.createGain();
      const processedMakeupGain = micCtx.createGain();
      rawBypassGain.gain.value = 1;
      processedGain.gain.value = 0;
      processedMakeupGain.gain.value = 1;

      capture.routing = {
        rawBypassGain,
        processedGain,
        processedMakeupGain,
        processedReady: false,
      };

      micSource.connect(rawBypassGain);
      rawBypassGain.connect(gainNode);
      processedGain.connect(processedMakeupGain);
      processedMakeupGain.connect(gainNode);

      return capture.routing;
    };

    const cleanupAppleLane = async ({ releaseOwner = false } = {}) => {
      if (capture.appleVoiceFrameCleanup) {
        try { capture.appleVoiceFrameCleanup(); } catch {}
        capture.appleVoiceFrameCleanup = null;
      }
      if (capture.appleVoiceStateCleanup) {
        try { capture.appleVoiceStateCleanup(); } catch {}
        capture.appleVoiceStateCleanup = null;
      }
      if (capture.appleVoiceSourceNode) {
        try { capture.appleVoiceSourceNode.port.postMessage({ type: 'reset' }); } catch {}
        try { capture.appleVoiceSourceNode.disconnect?.(); } catch {}
        capture.appleVoiceSourceNode = null;
      }
      capture.usesAppleVoiceProcessing = false;
      if (releaseOwner && window.electronAPI?.stopAppleVoiceCapture) {
        try {
          await window.electronAPI.stopAppleVoiceCapture(APPLE_VOICE_CAPTURE_OWNERS.LIVE_VOICE);
        } catch {}
      }
    };

    const startAppleProcessingLane = async () => {
      if (!window.electronAPI?.startAppleVoiceCapture || !window.electronAPI?.isAppleVoiceCaptureSupported) {
        throw new Error('macOS voice processing is unavailable on this build.');
      }

      const supported = await window.electronAPI.isAppleVoiceCaptureSupported().catch(() => false);
      if (!supported) {
        appleVoiceAvailableRef.current = false;
        throw new Error('macOS voice processing is unavailable on this Mac.');
      }

      const routing = ensureBypassRouting();
      routing.processedMakeupGain.gain.value = 1;
      routing.processedReady = false;

      const appleSourceNode = await createApplePcmBridgeNode(micCtx);
      capture.appleVoiceSourceNode = appleSourceNode;
      appleSourceNode.connect(routing.processedGain);

      capture.appleVoiceFrameCleanup = window.electronAPI.onAppleVoiceCaptureFrame((chunk) => {
        if (capture.disposed || !capture.appleVoiceSourceNode) {
          return;
        }

        const normalizedChunk = normalizeElectronBinaryChunk(chunk);
        if (!normalizedChunk) {
          return;
        }

        capture.appleVoiceSourceNode.port.postMessage(
          { type: 'push', samples: normalizedChunk },
          [normalizedChunk]
        );
      });

      capture.appleVoiceStateCleanup = window.electronAPI.onAppleVoiceCaptureState((payload) => {
        if (capture.disposed || !payload) {
          return;
        }

        if (payload.type === 'unavailable') {
          appleVoiceAvailableRef.current = false;
        }

        if (payload.type === 'error' || payload.type === 'ended') {
          const nextFallbackReason = getFriendlyAppleVoiceFallbackMessage(payload.message);
          filterDiagnostics.backend = 'raw';
          filterDiagnostics.loaded = false;
          filterDiagnostics.fallbackReason = nextFallbackReason;
          if (capture.routing) {
            capture.routing.processedReady = false;
            applyNoiseSuppressionRoutingTo(capture.routing, true);
          }
          if (liveCaptureRef.current === capture) {
            setLiveVoiceFallbackReason(nextFallbackReason);
            updateVoiceDiagnostics((prev) => ({
              ...prev,
              liveCapture: prev?.liveCapture ? {
                ...prev.liveCapture,
                filter: {
                  ...(prev.liveCapture.filter || {}),
                  backend: 'raw',
                  loaded: false,
                  fallbackReason: nextFallbackReason,
                },
              } : prev?.liveCapture,
            }));
          }
        }
      });

      const helperStart = performance.now();
      const helperMetadata = await withTimeout(
        window.electronAPI.startAppleVoiceCapture(APPLE_VOICE_CAPTURE_OWNERS.LIVE_VOICE),
        APPLE_VOICE_LIVE_START_TIMEOUT_MS,
        'macOS Voice Isolation took too long to start for live voice.'
      );
      if (helperMetadata?.configuration && helperMetadata.configuration !== 'full-duplex') {
        throw new Error('Mac voice cleanup is unavailable in this audio configuration.');
      }
      workletCreateMs = roundMs(performance.now() - helperStart);

      if (capture.disposed) {
        await cleanupAppleLane({ releaseOwner: true });
        return;
      }

      capture.usesAppleVoiceProcessing = true;
      routing.processedReady = true;
      const usingProcessedLane = applyNoiseSuppressionRoutingTo(routing, noiseSuppressionEnabled);
      filterDiagnostics.loaded = true;
      filterDiagnostics.backend = usingProcessedLane ? suppressionRuntime.backend : 'raw';
      filterDiagnostics.fallbackReason = null;
    };

    const startRnnoiseProcessingLane = async () => {
      const routing = ensureBypassRouting();
      routing.processedMakeupGain.gain.value = RNNOISE_SEND_MAKEUP_GAIN;
      routing.processedReady = false;

      const workletStart = performance.now();
      const rnnoiseNode = await createRnnoiseNode(micCtx, { maxChannels: 1 });
      workletCreateMs = roundMs(performance.now() - workletStart);
      if (capture.disposed) {
        rnnoiseNode.destroy?.();
        return;
      }

      const speexNode = await createSpeexNode(micCtx, { maxChannels: 1 });
      const noiseGateNode = await createNoiseGateNode(micCtx, { maxChannels: 1 });
      const speechFocusChain = createSpeechFocusChain(micCtx);
      const keyboardSuppressorNode = await createKeyboardSuppressorNode(micCtx, { maxChannels: 1 });
      if (capture.disposed) {
        keyboardSuppressorNode.disconnect?.();
        speechFocusChain.disconnect?.();
        speexNode.destroy?.();
        noiseGateNode.disconnect?.();
        rnnoiseNode.destroy?.();
        return;
      }

      capture.noiseSuppressorNode = rnnoiseNode;
      capture.residualDenoiserNode = speexNode;
      capture.noiseGateNode = noiseGateNode;
      capture.speechFocusChain = speechFocusChain;
      capture.keyboardSuppressorNode = keyboardSuppressorNode;
      routing.processedReady = true;
      micSource.connect(rnnoiseNode);
      rnnoiseNode.connect(speexNode);
      speexNode.connect(noiseGateNode);
      noiseGateNode.connect(speechFocusChain.input);
      speechFocusChain.output.connect(keyboardSuppressorNode);
      keyboardSuppressorNode.connect(routing.processedGain);
      const usingProcessedLane = applyNoiseSuppressionRoutingTo(routing, noiseSuppressionEnabled);
      filterDiagnostics.loaded = true;
      filterDiagnostics.backend = usingProcessedLane ? suppressionRuntime.backend : 'raw';
      filterDiagnostics.fallbackReason = null;
    };

    const usesBrowserApm = suppressionRuntime.backend === VOICE_NOISE_SUPPRESSION_BACKENDS.WEBRTC_APM;
    let usesAppleVoiceProcessing = suppressionRuntime.backend === VOICE_NOISE_SUPPRESSION_BACKENDS.APPLE;

    if (useRawMicPath || usesBrowserApm || !noiseSuppressionEnabled) {
      micSource.connect(gainNode);
    } else if (usesAppleVoiceProcessing) {
      try {
        await startAppleProcessingLane();
      } catch (appleErr) {
        if (shouldDisableAppleVoiceForSession(appleErr?.message)) {
          appleVoiceAvailableRef.current = false;
        }
        await cleanupAppleLane({ releaseOwner: true });
        suppressionRuntime = {
          ...getNoiseSuppressionRuntimeState({
            mode: activeVoiceProcessingMode,
            noiseSuppressionEnabled,
            noiseSuppressionBackend: VOICE_NOISE_SUPPRESSION_BACKENDS.RNNOISE,
          }),
          requestedBackend: requestedSuppressionRuntime.backend,
          fallbackReason: getFriendlyAppleVoiceFallbackMessage(appleErr?.message),
        };
        filterDiagnostics.backend = suppressionRuntime.backend;
        filterDiagnostics.requestedBackend = requestedSuppressionRuntime.backend;
        filterDiagnostics.requiresWarmup = suppressionRuntime.requiresWarmup;
        filterDiagnostics.fallbackReason = suppressionRuntime.fallbackReason;
        filterDiagnostics.loaded = false;

        try {
          await startRnnoiseProcessingLane();
        } catch (rnnoiseErr) {
          filterDiagnostics.fallbackReason = rnnoiseErr?.message || suppressionRuntime.fallbackReason || 'Noise suppression failed to initialize.';
          if (capture.routing) {
            capture.routing.processedReady = false;
            applyNoiseSuppressionRoutingTo(capture.routing, noiseSuppressionEnabled);
          }
        }
      }
    } else {
      try {
        await startRnnoiseProcessingLane();
      } catch (rnnoiseErr) {
        filterDiagnostics.fallbackReason = rnnoiseErr?.message || 'RNNoise failed to initialize';
        if (capture.routing) {
          capture.routing.processedReady = false;
          applyNoiseSuppressionRoutingTo(capture.routing, noiseSuppressionEnabled);
        }
      }
    }

    return {
      capture,
      diagnostics: {
        channelId: chId,
        startedAt: captureStartedAt,
        mode: activeVoiceProcessingMode,
        requestedConstraints: appliedConstraints.audio,
        usedDefaultDeviceFallback,
        reusedSourceStream: reusedExistingStream,
        sourceTrack: summarizeTrackSnapshot(sourceTrack),
        producedTrack: summarizeTrackSnapshot(capture.outputTrack),
        audioContext: summarizeAudioContext(micCtx),
        filter: {
          ...filterDiagnostics,
          workletCreateMs,
        },
        timingsMs: {
          getUserMedia: getUserMediaMs,
          audioGraphSetup: audioGraphSetupMs,
          total: roundMs(performance.now() - captureStart),
        },
      },
      noiseSuppressionEnabled,
    };
  }, [updateVoiceDiagnostics]);

  const syncIncomingScreenShares = useCallback(() => {
    setIncomingScreenShares(
      Array.from(screenShareVideosRef.current.values()).map(({ userId, stream }) => ({ userId, stream }))
    );
  }, []);

  const setUserAudioEntry = useCallback((userId, producerId, audio) => {
    let userAudioEntries = userAudioRef.current.get(userId);
    if (!userAudioEntries) {
      userAudioEntries = new Map();
      userAudioRef.current.set(userId, userAudioEntries);
    }
    userAudioEntries.set(producerId, audio);
  }, []);

  useEffect(() => {
    voiceProcessingModeRef.current = voiceProcessingMode;
  }, [voiceProcessingMode]);

  const removeUserAudioEntry = useCallback((userId, producerId) => {
    const userAudioEntries = userAudioRef.current.get(userId);
    if (!userAudioEntries) return;
    userAudioEntries.delete(producerId);
    if (userAudioEntries.size === 0) {
      userAudioRef.current.delete(userId);
    }
  }, []);

  const cleanupRemoteProducer = useCallback((producerId, { producerUserId = null, source = null } = {}) => {
    const consumer = consumersRef.current.get(producerId);
    if (consumer) {
      try { consumer.close(); } catch {}
      consumersRef.current.delete(producerId);
    }

    const producerMeta = producerMetaRef.current.get(producerId);
    const ownerId = producerUserId || producerMeta?.userId || producerUserMapRef.current.get(producerId);
    const producerSource = source || producerMeta?.source || null;

    const audio = audioElementsRef.current.get(producerId);
    if (audio) {
      try { audio._voiceRetryCleanup?.(); } catch {}
      audio.pause();
      audio.srcObject = null;
      audioElementsRef.current.delete(producerId);
    }

    if (ownerId) {
      removeUserAudioEntry(ownerId, producerId);
    }

    if (producerSource === 'screen-video' || screenShareVideosRef.current.has(producerId)) {
      screenShareVideosRef.current.delete(producerId);
      syncIncomingScreenShares();
    }

    producerMetaRef.current.delete(producerId);
    producerUserMapRef.current.delete(producerId);

    updateVoiceDiagnostics((prev) => {
      if (!prev.consumers[producerId]) return prev;
      const nextConsumers = { ...prev.consumers };
      delete nextConsumers[producerId];
      return {
        ...prev,
        consumers: nextConsumers,
      };
    });
  }, [removeUserAudioEntry, syncIncomingScreenShares, updateVoiceDiagnostics]);

  // Keep refs in sync
  useEffect(() => { channelIdRef.current = channelId; }, [channelId]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { deafenedRef.current = deafened; }, [deafened]);

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

  // Helper: emit with callback as promise
  const emitAsync = useCallback((event, data) => {
    return new Promise((resolve, reject) => {
      socket.emit(event, data, (res) => {
        if (!res) return reject(new Error('No response from server'));
        if (res.ok) resolve(res);
        else reject(new Error(res.error || 'Socket call failed'));
      });
    });
  }, [socket]);

  const ensureSecureMediaReady = useCallback((feature) => {
    if (!isE2EInitialized()) {
      throw new Error(feature + ' is unavailable until end-to-end encryption is ready.');
    }
    if (!isInsertableStreamsSupported()) {
      throw new Error(feature + ' is unavailable because this device does not support secure media transforms.');
    }
  }, []);

  const getVoiceKeyLeaders = useCallback((participantIds) => {
    const orderedParticipantIds = Array.from(new Set(
      Array.isArray(participantIds) ? participantIds.filter(Boolean) : []
    )).sort();

    return {
      orderedParticipantIds,
      primaryLeaderId: orderedParticipantIds[0] || null,
      recoveryLeaderId: orderedParticipantIds[1] || orderedParticipantIds[0] || null,
    };
  }, []);

  const recoverVoiceKeyForParticipants = useCallback(async (participantIds, {
    activeChannelId = channelIdRef.current,
    timeoutMs = 5000,
  } = {}) => {
    const currentUserId = user?.userId;
    const otherParticipantIds = Array.isArray(participantIds)
      ? participantIds.filter(id => id && id !== currentUserId)
      : [];

    if (!activeChannelId || !socket || !currentUserId || otherParticipantIds.length === 0) {
      throw new Error('Secure voice recovery requires another participant.');
    }

    const allParticipantIds = Array.from(new Set([currentUserId, ...otherParticipantIds]));
    const { primaryLeaderId, recoveryLeaderId } = getVoiceKeyLeaders(allParticipantIds);
    const existingVoiceKey = getVoiceKey();

    if (currentUserId === primaryLeaderId) {
      if (existingVoiceKey) {
        try {
          await distributeVoiceKey(activeChannelId, otherParticipantIds, existingVoiceKey.key, existingVoiceKey.epoch, socket);
          return existingVoiceKey;
        } catch (err) {
          console.warn('[Voice] Primary leader re-distribution failed, rotating secure voice key:', err);
        }
      }

      const nextEpochFloor = Math.max(existingVoiceKey?.epoch || 0, 1023) + 1;
      const { key, epoch } = generateVoiceKey({ minEpoch: nextEpochFloor });
      setVoiceKey(toBase64(key), epoch);
      await distributeVoiceKey(activeChannelId, otherParticipantIds, key, epoch, socket);
      return { key, epoch };
    }

    if (currentUserId === recoveryLeaderId) {
      try {
        return await waitForVoiceKey(activeChannelId, Math.min(timeoutMs, 1500));
      } catch {}

      const latestVoiceKey = getVoiceKey();
      if (latestVoiceKey) {
        return latestVoiceKey;
      }

      const nextEpochFloor = Math.max(existingVoiceKey?.epoch || 0, 2047) + 1;
      const { key, epoch } = generateVoiceKey({ minEpoch: nextEpochFloor });
      setVoiceKey(toBase64(key), epoch);
      await distributeVoiceKey(activeChannelId, otherParticipantIds, key, epoch, socket);
      return { key, epoch };
    }

    return waitForVoiceKey(activeChannelId, timeoutMs);
  }, [getVoiceKeyLeaders, socket, user?.userId]);

  const ensureVoiceKeyForParticipants = useCallback(async (participantIds, {
    activeChannelId = channelIdRef.current,
    feature = 'Voice chat',
    timeoutMs = 5000,
  } = {}) => {
    const currentUserId = user?.userId;
    const otherParticipantIds = Array.isArray(participantIds)
      ? participantIds.filter(id => id && id !== currentUserId)
      : [];

    if (!activeChannelId || !currentUserId || otherParticipantIds.length === 0) {
      return getVoiceKey();
    }

    const existingVoiceKey = getVoiceKey();
    if (existingVoiceKey) {
      return existingVoiceKey;
    }

    try {
      return await waitForVoiceKey(activeChannelId, timeoutMs);
    } catch {
      const currentOtherParticipants = participantIdsRef.current.filter(id => id && id !== currentUserId);
      if (channelIdRef.current !== activeChannelId || currentOtherParticipants.length === 0) {
        return getVoiceKey();
      }
      const lateVoiceKey = getVoiceKey();
      if (lateVoiceKey) {
        return lateVoiceKey;
      }
      try {
        return await recoverVoiceKeyForParticipants(
          [currentUserId, ...currentOtherParticipants],
          { activeChannelId, timeoutMs }
        );
      } catch {}
      throw new Error(`${feature} is unavailable because the secure media key did not arrive in time.`);
    }
  }, [recoverVoiceKeyForParticipants, user?.userId]);

  const syncVoiceE2EState = useCallback(async (participantIds, {
    activeChannelId = channelIdRef.current,
    feature = 'Voice chat',
  } = {}) => {
    const hasOtherParticipants = Array.isArray(participantIds)
      && participantIds.some(id => id && id !== user?.userId);

    updateVoiceDiagnostics((prev) => ({
      ...prev,
      session: {
        ...(prev.session || {}),
        secureVoice: {
          state: hasOtherParticipants ? 'waiting' : 'idle',
          channelId: activeChannelId || null,
          participantCount: Array.isArray(participantIds) ? participantIds.length : 0,
          updatedAt: new Date().toISOString(),
          warning: null,
        },
      },
    }));

    if (!hasOtherParticipants) {
      setVoiceE2E(true);
      setE2EWarning(null);
      return getVoiceKey();
    }

    setVoiceE2E(false);

    try {
      const voiceKey = await ensureVoiceKeyForParticipants(participantIds, { activeChannelId, feature });
      if (channelIdRef.current !== activeChannelId) {
        return voiceKey;
      }

      setVoiceE2E(true);
      setE2EWarning(null);
      setJoinError((current) => (
        current && current.includes('secure media key') ? null : current
      ));
      updateVoiceDiagnostics((prev) => ({
        ...prev,
        session: {
          ...(prev.session || {}),
          secureVoice: {
            state: 'ready',
            channelId: activeChannelId || null,
            participantCount: Array.isArray(participantIds) ? participantIds.length : 0,
            updatedAt: new Date().toISOString(),
            warning: null,
          },
        },
      }));
      return voiceKey;
    } catch (err) {
      if (channelIdRef.current !== activeChannelId) {
        return null;
      }

      const message = err?.message || `${feature} is unavailable because the secure media key did not arrive in time.`;
      setVoiceE2E(false);
      setE2EWarning(message);
      setJoinError(message);
      setTimeout(() => {
        setJoinError((current) => (current === message ? null : current));
      }, 5000);
      updateVoiceDiagnostics((prev) => ({
        ...prev,
        session: {
          ...(prev.session || {}),
          secureVoice: {
            state: 'waiting',
            channelId: activeChannelId || null,
            participantCount: Array.isArray(participantIds) ? participantIds.length : 0,
            updatedAt: new Date().toISOString(),
            warning: message,
          },
        },
      }));
      return null;
    }
  }, [ensureVoiceKeyForParticipants, updateVoiceDiagnostics, user?.userId]);

  const getUntrustedVoiceParticipants = useCallback((participants) => {
    const normalizedParticipants = Array.isArray(participants)
      ? participants.filter(participant => participant?.userId)
      : [];
    return normalizedParticipants.filter(participant => (
      participant.userId !== user?.userId && !hasKnownNpub(participant.userId, participant.npub || null)
    ));
  }, [user?.userId]);

  const buildVoiceTrustError = useCallback((participants) => {
    const names = Array.from(new Set(
      getUntrustedVoiceParticipants(participants)
        .map(participant => participant.username || 'an untrusted participant')
    ));
    if (names.length === 0) {
      return 'Secure voice is waiting for every participant\'s Nostr identity.';
    }
    if (names.length === 1) {
      return `Secure voice is waiting for ${names[0]}'s Nostr identity.`;
    }
    if (names.length === 2) {
      return `Secure voice is waiting for ${names[0]} and ${names[1]}.`;
    }
    return `Secure voice is waiting for ${names.slice(0, 3).join(', ')}.`;
  }, [getUntrustedVoiceParticipants]);

  const syncVoiceParticipants = useCallback(async (participants, { channelId: activeChannelId = channelIdRef.current } = {}) => {
    const currentUserId = user?.userId;
    const normalizedParticipants = Array.isArray(participants)
      ? participants.filter(participant => participant?.userId)
      : [];
    const participantIds = Array.from(new Set(normalizedParticipants.map(participant => participant.userId)));
    const previousParticipantIds = participantIdsRef.current;

    participantIdsRef.current = participantIds;
    if (activeChannelId) {
      setVoiceChannelId(activeChannelId);
    }
    setVoiceChannelParticipants(participantIds);
    await flushPendingControlMessagesNow().catch(() => {});

    setPeers(() => {
      const nextPeers = {};
      for (const participant of normalizedParticipants) {
        if (participant.userId === currentUserId) continue;
        nextPeers[participant.userId] = {
          muted: !!participant.muted,
          deafened: !!participant.deafened,
          speaking: !!participant.speaking,
          screenSharing: !!participant.screenSharing,
        };
      }
      return nextPeers;
    });

    if (!activeChannelId || !currentUserId || !participantIds.includes(currentUserId) || !socket) {
      return;
    }

    const otherParticipantIds = participantIds.filter(id => id !== currentUserId);
    const previousOtherParticipantIds = previousParticipantIds.filter(id => id !== currentUserId);
    const addedParticipantIds = otherParticipantIds.filter(id => !previousOtherParticipantIds.includes(id));
    const removedParticipantIds = previousOtherParticipantIds.filter(id => !otherParticipantIds.includes(id));
    const membershipChanged = addedParticipantIds.length > 0 || removedParticipantIds.length > 0 || previousParticipantIds.length === 0;
    const leaderId = [...participantIds].sort()[0];

    // Do not mint a voice key while alone in the channel.
    // The eventual channel leader may be a different participant, and pre-generating
    // a solo key here can leave peers on different keys once someone joins.
    if (otherParticipantIds.length === 0) {
      if (previousOtherParticipantIds.length > 0) {
        clearVoiceKey({ preserveChannelState: true });
      }
      return;
    }

    let voiceKey = getVoiceKey();

    if (!voiceKey || removedParticipantIds.length > 0) {
      if (leaderId !== currentUserId) {
        return;
      }
      const { key, epoch } = generateVoiceKey();
      setVoiceKey(toBase64(key), epoch);
      voiceKey = { key, epoch };
      if (otherParticipantIds.length > 0) {
        try {
          await distributeVoiceKey(activeChannelId, otherParticipantIds, key, epoch, socket);
        } catch (err) {
          console.warn('[Voice] Primary secure voice key distribution failed, keeping local key for retry:', err);
        }
      }
      return;
    }

    if (membershipChanged && otherParticipantIds.length > 0) {
      try {
        await distributeVoiceKey(activeChannelId, otherParticipantIds, voiceKey.key, voiceKey.epoch, socket);
      } catch (err) {
        console.warn('[Voice] Failed to sync secure voice key to updated participants:', err);
      }
    }
  }, [socket, user?.userId]);

  const resetVoiceSession = useCallback(async ({ channelId: targetChannelId = channelIdRef.current, notifyServer = false } = {}) => {
    if (pendingLiveReconfigureRef.current) {
      clearTimeout(pendingLiveReconfigureRef.current);
      pendingLiveReconfigureRef.current = null;
    }
    liveCaptureConfigGenRef.current += 1;

    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
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

    if (appleVoiceFrameCleanupRef.current) {
      try { appleVoiceFrameCleanupRef.current(); } catch {}
      appleVoiceFrameCleanupRef.current = null;
    }
    if (appleVoiceStateCleanupRef.current) {
      try { appleVoiceStateCleanupRef.current(); } catch {}
      appleVoiceStateCleanupRef.current = null;
    }
    if (appleVoiceSourceNodeRef.current) {
      try { appleVoiceSourceNodeRef.current.port.postMessage({ type: 'reset' }); } catch {}
      try { appleVoiceSourceNodeRef.current.disconnect?.(); } catch {}
      appleVoiceSourceNodeRef.current = null;
    }
    if (window.electronAPI?.stopAppleVoiceCapture) {
      try {
        await window.electronAPI.stopAppleVoiceCapture(APPLE_VOICE_CAPTURE_OWNERS.LIVE_VOICE);
      } catch {}
    }

    if (micAudioCtxRef.current) {
      micAudioCtxRef.current.close().catch(() => {});
      micAudioCtxRef.current = null;
      micGainNodeRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    if (screenShareAudioProducerRef.current) {
      screenShareAudioProducerRef.current.close();
      screenShareAudioProducerRef.current = null;
    }
    if (screenShareProducerRef.current) {
      screenShareProducerRef.current.close();
      screenShareProducerRef.current = null;
    }
    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach(t => t.stop());
      screenShareStreamRef.current = null;
    }
    setShowSourcePicker(false);
    setScreenSharing(false);
    setScreenShareStream(null);
    setScreenShareError(null);
    screenShareStatsRef.current = null;
    setScreenShareDiagnostics(null);
    screenShareVideosRef.current.clear();
    setIncomingScreenShares([]);

    if (producerRef.current) {
      producerRef.current.close();
      producerRef.current = null;
    }

    for (const consumer of consumersRef.current.values()) {
      consumer.close();
    }
    consumersRef.current.clear();
    producerUserMapRef.current.clear();
    producerMetaRef.current.clear();

    for (const audio of audioElementsRef.current.values()) {
      audio.pause();
      audio.srcObject = null;
    }
    audioElementsRef.current.clear();
    userAudioRef.current.clear();

    if (sendTransportRef.current) {
      sendTransportRef.current.close();
      sendTransportRef.current = null;
    }
    if (recvTransportRef.current) {
      recvTransportRef.current.close();
      recvTransportRef.current = null;
    }

    deviceRef.current = null;
    liveCaptureRef.current = null;
    participantIdsRef.current = [];
    channelIdRef.current = null;
    setChannelId(null);
    clearVoiceKey();
    setVoiceChannelId(null);
    setVoiceChannelParticipants([]);
    setJoinError(null);
    setVoiceE2E(false);
    setE2EWarning(null);
    setLiveVoiceFallbackReason(null);
    updateVoiceDiagnostics((prev) => ({
      ...prev,
      session: {
        ...(prev.session || {}),
        active: false,
        channelId: targetChannelId || null,
        endedAt: new Date().toISOString(),
      },
      senderStats: null,
      screenShare: null,
      consumers: {},
    }));

    if (notifyServer && targetChannelId && socket) {
      try { await emitAsync('voice:leave', { channelId: targetChannelId }); } catch {}
    }

    setMuted(false);
    setDeafened(false);
    setSpeaking(false);
    setPeers({});
  }, [socket, emitAsync, updateVoiceDiagnostics]);

  // Start VAD (Voice Activity Detection) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â takes a GainNode so it reads the boosted signal
  const startVAD = useCallback((gainNode) => {
    try {
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current);
        vadIntervalRef.current = null;
      }
      const analyser = gainNode.context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      gainNode.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeaking = false;
      let speechFrames = 0;   // consecutive frames above threshold
      let silenceFrames = 0;  // consecutive frames below threshold
      const SPEAK_THRESHOLD = 30;  // amplitude needed to count as speech
      const FRAMES_TO_ACTIVATE = 3;  // ~150ms of speech to trigger
      const FRAMES_TO_DEACTIVATE = 8; // ~400ms of silence to stop

      vadIntervalRef.current = setInterval(() => {
        // Don't report speaking while muted
        if (mutedRef.current) {
          if (wasSpeaking) {
            wasSpeaking = false;
            speechFrames = 0;
            silenceFrames = 0;
            setSpeaking(false);
            if (channelIdRef.current && socket) {
              socket.emit('voice:speaking', { channelId: channelIdRef.current, speaking: false });
            }
          }
          return;
        }
        analyser.getByteFrequencyData(data);
        // Skip bins below ~85Hz (fan/AC hum). Each bin = sampleRate / fftSize Hz.
        // At 48kHz with fftSize 512: bin width = 93.75Hz, so start at bin 1.
        // At 44.1kHz: bin width = 86.1Hz, same applies.
        const startBin = 1;
        let peak = 0;
        for (let i = startBin; i < data.length; i++) {
          if (data[i] > peak) peak = data[i];
        }
        const aboveThreshold = peak > SPEAK_THRESHOLD;

        if (aboveThreshold) {
          speechFrames++;
          silenceFrames = 0;
        } else {
          silenceFrames++;
          speechFrames = 0;
        }

        // Require sustained speech/silence to change state (debounce)
        let isSpeaking = wasSpeaking;
        if (!wasSpeaking && speechFrames >= FRAMES_TO_ACTIVATE) {
          isSpeaking = true;
        } else if (wasSpeaking && silenceFrames >= FRAMES_TO_DEACTIVATE) {
          isSpeaking = false;
        }

        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          setSpeaking(isSpeaking);
          if (channelIdRef.current && socket) {
            socket.emit('voice:speaking', { channelId: channelIdRef.current, speaking: isSpeaking });
          }
        }
      }, 50);
    } catch (err) {
      console.error('VAD setup failed:', err);
    }
  }, [socket]);

  const applyLiveCaptureToProducer = useCallback(async ({
    chId,
    sendTransport = sendTransportRef.current,
    perfTraceId = null,
  }) => {
    const configGen = ++liveCaptureConfigGenRef.current;
    const previousCapture = liveCaptureRef.current;
    const previousProducer = producerRef.current;
    addPerfPhase(perfTraceId, 'capture-build-start', {
      hadPreviousCapture: Boolean(previousCapture),
      producerOperation: previousProducer ? 'replaceTrack' : 'produce',
    });
    const nextCaptureState = await createLiveMicCapture({
      chId,
      mode: getStoredVoiceProcessingMode(),
      previousCapture,
    });
    addPerfPhase(perfTraceId, 'capture-build-ready', {
      backend: nextCaptureState?.diagnostics?.filter?.backend || null,
      fallbackReason: nextCaptureState?.diagnostics?.filter?.fallbackReason || null,
      requestedBackend: nextCaptureState?.diagnostics?.filter?.requestedBackend || null,
      reusedSourceStream: nextCaptureState?.diagnostics?.reusedSourceStream || false,
    });

    if (configGen !== liveCaptureConfigGenRef.current || channelIdRef.current !== chId) {
      if (nextCaptureState?.capture) {
        await disposeLiveCapture(nextCaptureState.capture);
      }
      cancelPerfTrace(perfTraceId, {
        reason: 'stale-config',
      });
      if (pendingVoiceModeSwitchTraceRef.current === perfTraceId) {
        pendingVoiceModeSwitchTraceRef.current = null;
      }
      return null;
    }

    if (!nextCaptureState?.capture) {
      if (!previousProducer) {
        setMuted(true);
        setLiveVoiceFallbackReason(nextCaptureState?.diagnostics?.filter?.fallbackReason || null);
        updateVoiceDiagnostics((prev) => ({
          ...prev,
          liveCapture: nextCaptureState?.diagnostics || null,
        }));
      }
      endPerfTrace(perfTraceId, {
        status: 'no-capture',
        backend: nextCaptureState?.diagnostics?.filter?.backend || null,
        fallbackReason: nextCaptureState?.diagnostics?.filter?.fallbackReason || null,
      });
      if (pendingVoiceModeSwitchTraceRef.current === perfTraceId) {
        pendingVoiceModeSwitchTraceRef.current = null;
      }
      return null;
    }

    let producerOpMs = null;
    try {
      const producerStart = performance.now();
      if (previousProducer) {
        await previousProducer.replaceTrack({ track: nextCaptureState.capture.outputTrack });
      } else {
        if (!sendTransport) {
          throw new Error('Voice send transport is unavailable.');
        }
        producerRef.current = await sendTransport.produce({
          track: nextCaptureState.capture.outputTrack,
          appData: {
            source: 'microphone',
            processingMode: nextCaptureState.diagnostics.mode,
          },
        });
        const rtpSender = producerRef.current.rtpSender;
        if (!rtpSender) {
          throw new Error('Voice chat is unavailable because secure media transforms could not attach.');
        }
        attachSenderEncryption(rtpSender);
      }
      producerOpMs = roundMs(performance.now() - producerStart);
      addPerfPhase(perfTraceId, previousProducer ? 'replace-track-ready' : 'producer-ready', {
        durationMs: producerOpMs,
      });
    } catch (err) {
      await disposeLiveCapture(nextCaptureState.capture);
      endPerfTrace(perfTraceId, {
        status: 'error',
        error: normalizeVoiceErrorMessage(err),
      });
      if (pendingVoiceModeSwitchTraceRef.current === perfTraceId) {
        pendingVoiceModeSwitchTraceRef.current = null;
      }
      throw err;
    }

    if (configGen !== liveCaptureConfigGenRef.current || channelIdRef.current !== chId) {
      await disposeLiveCapture(nextCaptureState.capture);
      cancelPerfTrace(perfTraceId, {
        reason: 'stale-after-producer',
      });
      if (pendingVoiceModeSwitchTraceRef.current === perfTraceId) {
        pendingVoiceModeSwitchTraceRef.current = null;
      }
      return null;
    }

    if (
      previousCapture
      && previousCapture !== nextCaptureState.capture
      && previousCapture.stream
      && previousCapture.stream === nextCaptureState.capture.stream
    ) {
      previousCapture.ownsStream = false;
      nextCaptureState.capture.ownsStream = true;
    }

    syncLiveCaptureRefs(nextCaptureState.capture);
    setLiveVoiceFallbackReason(nextCaptureState.diagnostics.filter?.fallbackReason || null);
    updateVoiceDiagnostics((prev) => ({
      ...prev,
      liveCapture: {
        ...nextCaptureState.diagnostics,
        timingsMs: {
          ...(nextCaptureState.diagnostics.timingsMs || {}),
          produce: previousProducer ? null : producerOpMs,
          replaceTrack: previousProducer ? producerOpMs : null,
        },
      },
    }));
    startVAD(nextCaptureState.capture.gainNode);

    if (producerRef.current) {
      if (mutedRef.current) producerRef.current.pause();
      else producerRef.current.resume();
    }
    setMuted(mutedRef.current);

    if (previousCapture && previousCapture !== nextCaptureState.capture) {
      await disposeLiveCapture(previousCapture);
    }

    endPerfTrace(perfTraceId, {
      status: 'ready',
      backend: nextCaptureState?.diagnostics?.filter?.backend || null,
      fallbackReason: nextCaptureState?.diagnostics?.filter?.fallbackReason || null,
      producerOperation: previousProducer ? 'replaceTrack' : 'produce',
      mode: nextCaptureState?.diagnostics?.mode || null,
    });
    if (pendingVoiceModeSwitchTraceRef.current === perfTraceId) {
      pendingVoiceModeSwitchTraceRef.current = null;
    }

    return nextCaptureState.capture;
  }, [attachSenderEncryption, createLiveMicCapture, disposeLiveCapture, startVAD, syncLiveCaptureRefs, updateVoiceDiagnostics]);

  const reconfigureLiveCapture = useCallback(async ({ perfTraceId = null } = {}) => {
    const activeChannelId = channelIdRef.current;
    if (!activeChannelId) {
      cancelPerfTrace(perfTraceId, {
        reason: 'no-active-channel',
      });
      if (pendingVoiceModeSwitchTraceRef.current === perfTraceId) {
        pendingVoiceModeSwitchTraceRef.current = null;
      }
      return;
    }

    try {
      addPerfPhase(perfTraceId, 'reconfigure-start');
      await applyLiveCaptureToProducer({ chId: activeChannelId, perfTraceId });
    } catch (err) {
      console.warn('[Voice] Live capture reconfigure failed:', err);
      endPerfTrace(perfTraceId, {
        status: 'error',
        error: normalizeVoiceErrorMessage(err),
      });
      if (pendingVoiceModeSwitchTraceRef.current === perfTraceId) {
        pendingVoiceModeSwitchTraceRef.current = null;
      }
    }
  }, [applyLiveCaptureToProducer]);

  // Create send transport
  const createSendTransport = useCallback(async (chId) => {
    const { transportOptions } = await emitAsync('voice:create-transport', {
      channelId: chId, direction: 'send',
    });

    const transport = deviceRef.current.createSendTransport({
      ...transportOptions,
      additionalSettings: { encodedInsertableStreams: true },
    });

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      emitAsync('voice:connect-transport', {
        channelId: chId, transportId: transport.id, dtlsParameters,
      }).then(callback).catch(errback);
    });

    transport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
      emitAsync('voice:produce', {
        channelId: chId, transportId: transport.id, kind, rtpParameters, appData,
      }).then(({ producerId }) => callback({ id: producerId })).catch(errback);
    });

    sendTransportRef.current = transport;
    return transport;
  }, [emitAsync]);

  // Create recv transport
  const createRecvTransport = useCallback(async (chId) => {
    const { transportOptions } = await emitAsync('voice:create-transport', {
      channelId: chId, direction: 'recv',
    });

    const transport = deviceRef.current.createRecvTransport({
      ...transportOptions,
      additionalSettings: { encodedInsertableStreams: true },
    });

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      emitAsync('voice:connect-transport', {
        channelId: chId, transportId: transport.id, dtlsParameters,
      }).then(callback).catch(errback);
    });

    recvTransportRef.current = transport;
    return transport;
  }, [emitAsync]);

  // Consume a remote producer
  const consumeProducer = useCallback(async (chId, producerId, producerUserId, source = null) => {
    if (!deviceRef.current || !recvTransportRef.current) return;
    if (producerUserId && producerUserId === user?.userId) return;

    if (consumersRef.current.has(producerId)) return;

    const consumeStartedAt = new Date().toISOString();
    const consumeRequestStart = performance.now();
    const data = await emitAsync('voice:consume', {
      channelId: chId,
      producerId,
      producerUserId,
      rtpCapabilities: deviceRef.current.rtpCapabilities,
    });
    const consumeRequestMs = roundMs(performance.now() - consumeRequestStart);

    const consumeTransportStart = performance.now();
    const consumer = await recvTransportRef.current.consume({
      id: data.id,
      producerId: data.producerId,
      kind: data.kind,
      rtpParameters: data.rtpParameters,
    });
    const consumeTransportMs = roundMs(performance.now() - consumeTransportStart);

    consumer.resume();

    let decryptAttachMs = null;
    try {
      const decryptStart = performance.now();
      const rtpReceiver = consumer.rtpReceiver;
      if (!rtpReceiver) {
        throw new Error('Voice media receiver is missing secure transform support.');
      }
      attachReceiverDecryption(rtpReceiver);
      decryptAttachMs = roundMs(performance.now() - decryptStart);
    } catch (e2eErr) {
      consumer.close();
      throw new Error('Voice chat is unavailable because end-to-end media decryption could not start.');
    }

    const producerSource = source || (data.kind === 'video' ? 'screen-video' : 'microphone');

    for (const [existingProducerId, meta] of producerMetaRef.current.entries()) {
      if (existingProducerId === producerId) continue;
      if (meta.userId !== producerUserId || meta.source !== producerSource) continue;
      cleanupRemoteProducer(existingProducerId, { producerUserId, source: producerSource });
    }

    consumersRef.current.set(producerId, consumer);
    producerUserMapRef.current.set(producerId, producerUserId);
    producerMetaRef.current.set(producerId, {
      userId: producerUserId,
      kind: data.kind,
      source: producerSource,
    });

    if (producerSource === 'screen-video') {
      const stream = new MediaStream([consumer.track]);
      screenShareVideosRef.current.set(producerId, { userId: producerUserId, stream });
      syncIncomingScreenShares();
      updateVoiceDiagnostics((prev) => ({
        ...prev,
        consumers: {
          ...prev.consumers,
          [producerId]: {
            producerUserId,
            source: producerSource,
            startedAt: consumeStartedAt,
            track: summarizeTrackSnapshot(consumer.track),
            timingsMs: {
              consumeRequest: consumeRequestMs,
              transportSetup: consumeTransportMs,
              decryptAttach: decryptAttachMs,
            },
            stats: prev.consumers[producerId]?.stats || null,
          },
        },
      }));
      return;
    }

    const audioElementStart = performance.now();
    const stream = new MediaStream([consumer.track]);
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.playsInline = true;
    audio.preload = 'auto';

    const outputId = localStorage.getItem('voice:outputDeviceId') || 'default';
    if (audio.setSinkId) {
      audio.setSinkId(outputId).catch(() => {});
    }

    audioElementsRef.current.set(producerId, audio);
    setUserAudioEntry(producerUserId, producerId, audio);

    const savedVol = localStorage.getItem(`voice:userVolume:${producerUserId}`);
    if (savedVol !== null) audio.volume = parseFloat(savedVol);

    const updateConsumerPlayback = (playback) => {
      updateVoiceDiagnostics((prev) => ({
        ...prev,
        consumers: {
          ...prev.consumers,
          [producerId]: {
            ...prev.consumers[producerId],
            playback,
          },
        },
      }));
    };

    const clearPlaybackRetryHooks = () => {
      try { audio._voiceRetryCleanup?.(); } catch {}
      delete audio._voiceRetryCleanup;
    };

    const attemptAudioPlayback = async ({ via = 'initial' } = {}) => {
      try {
        await audio.play();
        clearPlaybackRetryHooks();
        updateConsumerPlayback({
          state: 'playing',
          via,
          startedAt: new Date().toISOString(),
          error: null,
        });
        return true;
      } catch (err) {
        updateConsumerPlayback({
          state: 'blocked',
          via,
          startedAt: null,
          error: buildPlaybackErrorMessage(err),
        });
        return false;
      }
    };

    void attemptAudioPlayback().then((started) => {
      if (started) return;

      const retry = () => {
        void attemptAudioPlayback({ via: 'user-gesture' });
      };
      const cleanup = () => {
        document.removeEventListener('click', retry);
        document.removeEventListener('keydown', retry);
        document.removeEventListener('pointerdown', retry);
        document.removeEventListener('visibilitychange', retry);
        window.removeEventListener('focus', retry);
      };

      audio._voiceRetryCleanup = cleanup;

      document.addEventListener('click', retry, { once: true });
      document.addEventListener('keydown', retry, { once: true });
      document.addEventListener('pointerdown', retry, { once: true });
      document.addEventListener('visibilitychange', retry, { once: true });
      window.addEventListener('focus', retry, { once: true });
    });
    const audioElementSetupMs = roundMs(performance.now() - audioElementStart);

    updateVoiceDiagnostics((prev) => ({
      ...prev,
      consumers: {
        ...prev.consumers,
        [producerId]: {
          producerUserId,
          source: producerSource,
          startedAt: consumeStartedAt,
          track: summarizeTrackSnapshot(consumer.track),
          timingsMs: {
            consumeRequest: consumeRequestMs,
            transportSetup: consumeTransportMs,
            decryptAttach: decryptAttachMs,
            audioElementSetup: audioElementSetupMs,
          },
          playback: prev.consumers[producerId]?.playback || {
            state: 'pending',
            via: 'initial',
            startedAt: null,
            error: null,
          },
          stats: prev.consumers[producerId]?.stats || null,
        },
      },
    }));
  }, [cleanupRemoteProducer, emitAsync, setUserAudioEntry, syncIncomingScreenShares, updateVoiceDiagnostics, user?.userId]);

  // Refs to hold callbacks defined later so earlier useCallbacks can reference them
  const leaveChannelRef = useRef(null);
  const stopScreenShareRef = useRef(null);

  // Join a voice channel
  const joinChannel = useCallback(async (chId, { skipConnectChime = false } = {}) => {
    if (!socket) return;

    const gen = ++joinGenRef.current;
    setJoinError(null);
    setE2EWarning(null);
    setLiveVoiceFallbackReason(null);

    try {
      ensureSecureMediaReady('Voice chat');

      if (channelIdRef.current) {
        await resetVoiceSession({ notifyServer: true });
      }
      if (gen !== joinGenRef.current) return;

      const { rtpCapabilities, existingProducers, participants = [] } = await emitAsync('voice:join', { channelId: chId });
      rememberUsers(participants);
      if (gen !== joinGenRef.current) return;

      const untrustedParticipants = getUntrustedVoiceParticipants(participants);
      if (untrustedParticipants.length > 0) {
        throw new Error(buildVoiceTrustError(participants));
      }

      const device = new Device();
      await device.load({ routerRtpCapabilities: rtpCapabilities });
      if (gen !== joinGenRef.current) return;
      deviceRef.current = device;

      const sendTransport = await createSendTransport(chId);
      if (gen !== joinGenRef.current) return;
      await createRecvTransport(chId);
      if (gen !== joinGenRef.current) return;

      setChannelId(chId);
      setDeafened(false);
      setVoiceChannelId(chId);
      setE2EWarning(null);
      await syncVoiceParticipants(participants, { channelId: chId });
      if (gen !== joinGenRef.current) return;
      const participantIds = Array.from(new Set((participants || []).map(participant => participant?.userId).filter(Boolean)));
      updateVoiceDiagnostics((prev) => ({
        ...prev,
        session: {
          active: true,
          channelId: chId,
          joinedAt: new Date().toISOString(),
          participantCount: participantIds.length,
          existingProducerCount: existingProducers.length,
        },
      }));
      await Promise.all(existingProducers.map(({ producerId, producerUserId, source }) =>
        consumeProducer(chId, producerId, producerUserId, source)
      ));
      if (gen !== joinGenRef.current) return;
      void syncVoiceE2EState(participantIds, { activeChannelId: chId, feature: 'Voice chat' });
      if (!skipConnectChime) {
        playConnectChime();
      }

      window.electronAPI?.prefetchDesktopSources?.();
      const localCapture = await applyLiveCaptureToProducer({ chId, sendTransport });
      if (gen !== joinGenRef.current) {
        return;
      }
      if (!localCapture) {
        setMuted(true);
      }
    } catch (err) {
      console.error('joinChannel failed:', err);
      if (gen !== joinGenRef.current || isExpectedVoiceTeardownError(err)) {
        return;
      }

      const message = normalizeVoiceErrorMessage(err) || 'Failed to join voice channel';
      await resetVoiceSession({ channelId: chId, notifyServer: true });
      setJoinError(message);
      setE2EWarning(message);
      setTimeout(() => setJoinError(null), 5000);
    }
  }, [socket, emitAsync, createSendTransport, createRecvTransport, consumeProducer, ensureSecureMediaReady, resetVoiceSession, syncVoiceParticipants, syncVoiceE2EState, user?.userId, getUntrustedVoiceParticipants, buildVoiceTrustError, updateVoiceDiagnostics, applyLiveCaptureToProducer]);

  // Leave voice channel
  const leaveChannel = useCallback(async () => {
    if (pendingLiveReconfigureRef.current) {
      clearTimeout(pendingLiveReconfigureRef.current);
      pendingLiveReconfigureRef.current = null;
    }
    if (pendingVoiceModeSwitchTraceRef.current) {
      cancelPerfTrace(pendingVoiceModeSwitchTraceRef.current, {
        reason: 'left-channel',
      });
      pendingVoiceModeSwitchTraceRef.current = null;
    }
    joinGenRef.current += 1;
    setJoinError(null);
    await resetVoiceSession({ notifyServer: true });
    playLeaveChime();
  }, [resetVoiceSession]);

  // Keep ref in sync so joinChannel can call leaveChannel
  leaveChannelRef.current = leaveChannel;

  // Toggle mute ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â uses refs to avoid stale closure over muted state
  const toggleMute = useCallback(() => {
    if (!channelIdRef.current || !socket) return;
    const newMuted = !mutedRef.current;
    setMuted(newMuted);

    // Pause/resume producer
    if (producerRef.current) {
      if (newMuted) producerRef.current.pause();
      else producerRef.current.resume();
    }

    // Clear speaking state immediately when muting
    if (newMuted) {
      setSpeaking(false);
      socket.emit('voice:speaking', { channelId: channelIdRef.current, speaking: false });
    }

    socket.emit('voice:toggle-mute', { channelId: channelIdRef.current, muted: newMuted });
  }, [socket]);

  // Toggle deafen ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â uses refs to avoid stale closure over deafened/muted state
  const toggleDeafen = useCallback(() => {
    if (!channelIdRef.current || !socket) return;
    const newDeafened = !deafenedRef.current;
    setDeafened(newDeafened);

    // Mute all incoming audio
    for (const audio of audioElementsRef.current.values()) {
      audio.muted = newDeafened;
    }

    // Deafen on ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ also mute mic; Deafen off ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ also unmute mic
    if (newDeafened) {
      if (!mutedRef.current) {
        setMuted(true);
        if (producerRef.current) producerRef.current.pause();
        socket.emit('voice:toggle-mute', { channelId: channelIdRef.current, muted: true });
      }
    } else {
      setMuted(false);
      if (producerRef.current) producerRef.current.resume();
      socket.emit('voice:toggle-mute', { channelId: channelIdRef.current, muted: false });
    }

    socket.emit('voice:toggle-deafen', { channelId: channelIdRef.current, deafened: newDeafened });
  }, [socket]);

  const scheduleLiveVoiceReconfigure = useCallback((perfTraceId = null) => {
    if (!channelIdRef.current) {
      cancelPerfTrace(perfTraceId, {
        reason: 'no-active-channel',
      });
      if (pendingVoiceModeSwitchTraceRef.current === perfTraceId) {
        pendingVoiceModeSwitchTraceRef.current = null;
      }
      return;
    }

    if (pendingLiveReconfigureRef.current) {
      clearTimeout(pendingLiveReconfigureRef.current);
    }
    addPerfPhase(perfTraceId, 'queued');

    pendingLiveReconfigureRef.current = window.setTimeout(() => {
      pendingLiveReconfigureRef.current = null;
      if (!channelIdRef.current) {
        cancelPerfTrace(perfTraceId, {
          reason: 'channel-ended-before-reconfigure',
        });
        if (pendingVoiceModeSwitchTraceRef.current === perfTraceId) {
          pendingVoiceModeSwitchTraceRef.current = null;
        }
        return;
      }
      void reconfigureLiveCapture({ perfTraceId });
    }, 16);
  }, [reconfigureLiveCapture]);

  const setVoiceProcessingMode = useCallback((mode, { perfSource = 'unknown', uiTraceId = null } = {}) => {
    const nextState = isUltraLowLatencyMode(mode)
      ? applyVoiceModeDependencies(mode)
      : {
        mode: persistVoiceProcessingMode(VOICE_PROCESSING_MODES.STANDARD),
        noiseSuppression: persistNoiseSuppressionEnabled(true),
      };
    const { mode: nextMode, noiseSuppression } = nextState;
    const currentMode = voiceProcessingModeRef.current;
    let backendPerfTraceId = null;

    if (channelIdRef.current && nextMode !== currentMode) {
      if (pendingVoiceModeSwitchTraceRef.current) {
        cancelPerfTrace(pendingVoiceModeSwitchTraceRef.current, {
          reason: 'superseded',
        });
      }
      backendPerfTraceId = startPerfTrace('voice-mode-switch-backend', {
        source: perfSource,
        uiTraceId,
        channelId: channelIdRef.current,
        fromMode: currentMode,
        toMode: nextMode,
      });
      pendingVoiceModeSwitchTraceRef.current = backendPerfTraceId;
      addPerfPhase(backendPerfTraceId, 'requested', {
        noiseSuppressionEnabled: noiseSuppression,
      });
    }
    setVoiceProcessingModeState(nextMode);
    setLiveVoiceFallbackReason(null);
    const wantsProcessedLane = !isUltraLowLatencyMode(nextMode) && noiseSuppression;
    if (channelIdRef.current) {
      if (pendingLiveReconfigureRef.current) {
        clearTimeout(pendingLiveReconfigureRef.current);
        pendingLiveReconfigureRef.current = null;
      }
      if (!switchLiveCaptureModeInPlace(nextMode, { perfTraceId: backendPerfTraceId })) {
        applyNoiseSuppressionRouting(wantsProcessedLane);
        scheduleLiveVoiceReconfigure(backendPerfTraceId);
      }
    } else if (backendPerfTraceId) {
      endPerfTrace(backendPerfTraceId, {
        status: 'skipped',
        reason: 'not-in-voice',
      });
      pendingVoiceModeSwitchTraceRef.current = null;
    } else {
      applyNoiseSuppressionRouting(wantsProcessedLane);
    }
    return nextState;
  }, [applyNoiseSuppressionRouting, scheduleLiveVoiceReconfigure, switchLiveCaptureModeInPlace]);

  // Keep the app-wide contract to two meaningful states: cleanup on, or raw ultra-low-latency.
  const toggleNoiseSuppression = useCallback((enabled) => {
    const nextMode = enabled === false
      ? VOICE_PROCESSING_MODES.ULTRA_LOW_LATENCY
      : VOICE_PROCESSING_MODES.STANDARD;
    return setVoiceProcessingMode(nextMode).noiseSuppression;
  }, [setVoiceProcessingMode]);

  // Set mic gain (sensitivity boost)
  const setMicGain = useCallback((gain) => {
    if (micGainNodeRef.current) {
      micGainNodeRef.current.gain.value = gain;
    }
    localStorage.setItem('voice:micGain', String(gain));
  }, []);

  // Set volume for a specific user (0ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“1)
  const setUserVolume = useCallback((userId, volume) => {
    const userAudioEntries = userAudioRef.current.get(userId);
    if (userAudioEntries) {
      for (const audio of userAudioEntries.values()) {
        audio.volume = volume;
      }
    }
    localStorage.setItem(`voice:userVolume:${userId}`, String(volume));
  }, []);

  // Change output device for all audio elements
  const setOutputDevice = useCallback((deviceId) => {
    const targetSinkId = deviceId || 'default';
    for (const audio of audioElementsRef.current.values()) {
      if (audio.setSinkId) audio.setSinkId(targetSinkId).catch(() => {});
    }
  }, []);

  // Confirm screen share with selected source
  // options: { sourceId, includeAudio, macAudioDeviceId } or string (legacy)
  const confirmScreenShare = useCallback(async (options) => {
    setShowSourcePicker(false);
    setScreenShareError(null);
    const sendTransport = sendTransportRef.current;
    if (!channelIdRef.current || !sendTransport) return;

    const sourceId = typeof options === 'string' ? options : options?.sourceId;
    const includeAudio = typeof options === 'string' ? true : options?.includeAudio !== false;
    const macAudioDeviceId = typeof options === 'string' ? null : options?.macAudioDeviceId;

    try {
      ensureSecureMediaReady('Screen sharing');
      await ensureVoiceKeyForParticipants(participantIdsRef.current, {
        activeChannelId: channelIdRef.current,
        feature: 'Screen sharing',
      });

      if (sourceId) {
        await window.electronAPI?.selectDesktopSource?.(sourceId);
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: SCREEN_SHARE_CAPTURE_IDEAL_WIDTH, min: 1280 },
          height: { ideal: SCREEN_SHARE_CAPTURE_IDEAL_HEIGHT, min: 720 },
          frameRate: { ideal: SCREEN_SHARE_TARGET_FPS, min: 24, max: SCREEN_SHARE_CAPTURE_MAX_FPS },
        },
        audio: includeAudio && !macAudioDeviceId,
      });
      screenShareStreamRef.current = stream;
      setScreenShareStream(stream);

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('Screen capture did not provide a video track.');
      }
      await applyPreferredScreenShareConstraints(videoTrack);
      try {
        videoTrack.contentHint = 'detail';
      } catch {
        videoTrack.contentHint = 'text';
      }
      videoTrack.onended = () => {
        stopScreenShareRef.current?.();
      };
      setScreenShareDiagnostics({
        active: true,
        startedAt: new Date().toISOString(),
        requestedCapture: {
          idealResolution: formatResolution(SCREEN_SHARE_CAPTURE_IDEAL_WIDTH, SCREEN_SHARE_CAPTURE_IDEAL_HEIGHT),
          minimumResolution: formatResolution(SCREEN_SHARE_TARGET_WIDTH, SCREEN_SHARE_TARGET_HEIGHT),
          targetFps: SCREEN_SHARE_TARGET_FPS,
          captureFpsCeiling: SCREEN_SHARE_CAPTURE_MAX_FPS,
          maxBitrate: SCREEN_SHARE_MAX_BITRATE,
          startBitrateKbps: SCREEN_SHARE_START_BITRATE_KBPS,
          minBitrateKbps: SCREEN_SHARE_MIN_BITRATE_KBPS,
        },
        sourceId: sourceId || null,
        includeAudio,
        captureTrack: summarizeTrackSnapshot(videoTrack),
        sender: null,
        sampledAt: null,
      });

      const producer = await sendTransport.produce({
        track: videoTrack,
        encodings: [{
          maxBitrate: SCREEN_SHARE_MAX_BITRATE,
          maxFramerate: SCREEN_SHARE_TARGET_FPS,
          scaleResolutionDownBy: 1,
          priority: 'high',
          networkPriority: 'high',
          scalabilityMode: 'L1T2',
        }],
        codecOptions: {
          videoGoogleStartBitrate: SCREEN_SHARE_START_BITRATE_KBPS,
          videoGoogleMinBitrate: SCREEN_SHARE_MIN_BITRATE_KBPS,
          videoGoogleMaxBitrate: Math.round(SCREEN_SHARE_MAX_BITRATE / 1000),
        },
        appData: { source: 'screen-video' },
      });
      screenShareProducerRef.current = producer;

      let audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack && macAudioDeviceId && includeAudio) {
        try {
          const macAudioStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: macAudioDeviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          });
          audioTrack = macAudioStream.getAudioTracks()[0];
          if (audioTrack) {
            screenShareStreamRef.current.addTrack(audioTrack);
          }
        } catch (macAudioErr) {
          console.warn('[Voice] Failed to capture Mac virtual audio device:', macAudioErr);
        }
      }

      if (audioTrack) {
        const audioProducer = await sendTransport.produce({ track: audioTrack, appData: { source: 'screen-audio' } });
        screenShareAudioProducerRef.current = audioProducer;
        const audioSender = audioProducer.rtpSender;
        if (!audioSender) {
          throw new Error('Screen sharing is unavailable because secure media transforms could not attach to audio.');
        }
        attachSenderEncryption(audioSender);
      }

      const videoSender = producer.rtpSender;
      if (!videoSender) {
        throw new Error('Screen sharing is unavailable because secure media transforms could not attach to video.');
      }
      if (videoSender.getParameters && videoSender.setParameters) {
        try {
          const parameters = videoSender.getParameters() || {};
          parameters.degradationPreference = 'maintain-resolution';
          if (Array.isArray(parameters.encodings) && parameters.encodings.length > 0) {
            parameters.encodings = parameters.encodings.map((encoding) => ({
              ...encoding,
              maxBitrate: SCREEN_SHARE_MAX_BITRATE,
              maxFramerate: SCREEN_SHARE_TARGET_FPS,
              scaleResolutionDownBy: 1,
              priority: 'high',
              networkPriority: 'high',
              scalabilityMode: encoding.scalabilityMode || 'L1T1',
            }));
          }
          await videoSender.setParameters(parameters);
          setScreenShareDiagnostics((prev) => prev ? {
            ...prev,
            senderParameters: {
              degradationPreference: parameters.degradationPreference || null,
              encodings: Array.isArray(parameters.encodings)
                ? parameters.encodings.map((encoding) => ({
                  active: encoding.active ?? null,
                  maxBitrate: encoding.maxBitrate ?? null,
                  maxFramerate: encoding.maxFramerate ?? null,
                  scaleResolutionDownBy: encoding.scaleResolutionDownBy ?? null,
                  scalabilityMode: encoding.scalabilityMode || null,
                  priority: encoding.priority || null,
                  networkPriority: encoding.networkPriority || null,
                }))
                : [],
            },
          } : prev);
        } catch (senderParamErr) {
          console.warn('[Voice] Failed to raise screen share sender parameters:', senderParamErr);
        }
      }
      attachSenderEncryption(videoSender);

      setVoiceE2E(true);
      setE2EWarning(null);
      setScreenShareError(null);
      setScreenSharing(true);
      playStreamStartChime();
      socket.emit('voice:screen-share-state', { channelId: channelIdRef.current, sharing: true });
    } catch (err) {
      if (screenShareAudioProducerRef.current) {
        screenShareAudioProducerRef.current.close();
        screenShareAudioProducerRef.current = null;
      }
      if (screenShareProducerRef.current) {
        screenShareProducerRef.current.close();
        screenShareProducerRef.current = null;
      }
      if (screenShareStreamRef.current) {
        screenShareStreamRef.current.getTracks().forEach(t => t.stop());
        screenShareStreamRef.current = null;
      }
      setScreenShareStream(null);
      setScreenSharing(false);

      const cancelled = err?.name === 'NotAllowedError' || err?.name === 'AbortError';
      if (!cancelled) {
        const message = await buildScreenShareStartError(err);
        setScreenShareError(message);
        console.warn('Screen share failed:', err);
      }
    }
  }, [socket, ensureSecureMediaReady, ensureVoiceKeyForParticipants]);

  // Open source picker to start screen sharing
  const startScreenShare = useCallback(async () => {
    setScreenShareError(null);
    ensureSecureMediaReady('Screen sharing');
    if (!channelIdRef.current || !sendTransportRef.current) {
      throw new Error('Join a secure voice channel before starting screen share.');
    }

    const platform = window.electronAPI?.getPlatform?.();
    if (platform === 'darwin') {
      try {
        const status = await window.electronAPI?.getScreenCaptureAccessStatus?.();
        if (status === 'denied' || status === 'restricted') {
          setScreenShareError(MAC_SCREEN_CAPTURE_PERMISSION_MESSAGE);
          return;
        }
      } catch {}
    }

    setShowSourcePicker(true);
  }, [ensureSecureMediaReady]);

  // Cancel source picker
  const cancelSourcePicker = useCallback(() => {
    setShowSourcePicker(false);
    setScreenShareError(null);
  }, []);

  // Stop screen sharing
  const stopScreenShare = useCallback(() => {
    if (screenShareAudioProducerRef.current) {
      screenShareAudioProducerRef.current.close();
      screenShareAudioProducerRef.current = null;
    }
    if (screenShareProducerRef.current) {
      screenShareProducerRef.current.close();
      screenShareProducerRef.current = null;
    }
    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach(t => t.stop());
      screenShareStreamRef.current = null;
    }
    setScreenSharing(false);
    setScreenShareStream(null);
    setScreenShareError(null);
    screenShareStatsRef.current = null;
    setScreenShareDiagnostics(null);
    playStreamStopChime();
    if (channelIdRef.current && socket) {
      socket.emit('voice:screen-share-state', { channelId: channelIdRef.current, sharing: false });
    }
  }, [socket]);

  const clearScreenShareError = useCallback(() => {
    setScreenShareError(null);
  }, []);

  // Keep stopScreenShare ref in sync
  stopScreenShareRef.current = stopScreenShare;

  // Listen for voice events
  useEffect(() => {
    if (!socket) return;

    const handleChannelUpdate = ({ channelId: updatedChannelId, participants }) => {
      if (!updatedChannelId || updatedChannelId !== channelIdRef.current) return;
      const participantList = Array.isArray(participants) ? participants : [];
      rememberUsers(participantList);
      if (user?.userId && !participantList.some(participant => participant.userId === user.userId)) {
        return;
      }
      const untrustedParticipants = getUntrustedVoiceParticipants(participantList);
      if (untrustedParticipants.length > 0) {
        const message = buildVoiceTrustError(participantList);
        setJoinError(message);
        setE2EWarning(message);
        leaveChannelRef.current?.();
        return;
      }
      const participantIds = Array.from(new Set(participantList.map(participant => participant.userId)));
      syncVoiceParticipants(participantList, { channelId: updatedChannelId })
        .then(async () => {
          await syncVoiceE2EState(participantIds, {
            activeChannelId: updatedChannelId,
            feature: 'Voice chat',
          });
        })
        .catch(async (err) => {
          if (channelIdRef.current !== updatedChannelId || isExpectedVoiceTeardownError(err)) {
            return;
          }
          const message = err?.message || 'Secure voice could not synchronize channel participants.';
          setJoinError(message);
          setE2EWarning(message);
          await leaveChannelRef.current?.();
        });
    };

    const handleNewProducer = async ({ producerId, producerUserId, source }) => {
      if (channelIdRef.current) {
        try {
          await consumeProducer(channelIdRef.current, producerId, producerUserId, source);
        } catch (err) {
          if (isExpectedVoiceTeardownError(err)) {
            cleanupRemoteProducer(producerId, { producerUserId, source });
            return;
          }
          const message = err?.message || 'Secure media setup failed for a new participant.';
          cleanupRemoteProducer(producerId, { producerUserId, source });
          setJoinError(message);
          setE2EWarning(message);
          setTimeout(() => {
            setJoinError((current) => (current === message ? null : current));
          }, 5000);
        }
      }
    };

    const handleProducerClosed = ({ producerId, producerUserId, source }) => {
      if (producerId) {
        cleanupRemoteProducer(producerId, { producerUserId, source });
        return;
      }

      for (const [prodId, ownerId] of producerUserMapRef.current.entries()) {
        if (ownerId !== producerUserId) continue;
        cleanupRemoteProducer(prodId, { producerUserId, source });
      }
    };
    const handlePeerMute = ({ userId, muted, deafened }) => {
      setPeers(prev => ({
        ...prev,
        [userId]: { ...prev[userId], muted, deafened },
      }));
    };

    const handlePeerSpeaking = ({ userId, speaking }) => {
      setPeers(prev => ({
        ...prev,
        [userId]: { ...prev[userId], speaking },
      }));
    };

    const handleChannelDeleted = async ({ channelId: deletedChannelId }) => {
      if (!deletedChannelId || deletedChannelId !== channelIdRef.current) return;
      setJoinError('This voice channel was deleted.');
      setTimeout(() => setJoinError(null), 5000);
      await resetVoiceSession({ channelId: deletedChannelId, notifyServer: false });
    };

    socket.on('voice:channel-update', handleChannelUpdate);
    socket.on('voice:new-producer', handleNewProducer);
    socket.on('voice:producer-closed', handleProducerClosed);
    socket.on('voice:peer-mute-update', handlePeerMute);
    socket.on('voice:speaking', handlePeerSpeaking);
    socket.on('voice:channel-deleted', handleChannelDeleted);

    return () => {
      socket.off('voice:channel-update', handleChannelUpdate);
      socket.off('voice:new-producer', handleNewProducer);
      socket.off('voice:producer-closed', handleProducerClosed);
      socket.off('voice:peer-mute-update', handlePeerMute);
      socket.off('voice:speaking', handlePeerSpeaking);
      socket.off('voice:channel-deleted', handleChannelDeleted);
    };
  }, [socket, cleanupRemoteProducer, consumeProducer, syncVoiceParticipants, syncVoiceE2EState, resetVoiceSession, user?.userId, getUntrustedVoiceParticipants, buildVoiceTrustError]);

  useEffect(() => {
    const handleVoiceKeyUpdated = (event) => {
      const updatedChannelId = event?.detail?.channelId;
      if (!updatedChannelId || updatedChannelId !== channelIdRef.current) return;

      setVoiceE2E(true);
      setE2EWarning(null);
      setJoinError((current) => (
        current && current.includes('secure media key') ? null : current
      ));
      updateVoiceDiagnostics((prev) => ({
        ...prev,
        session: {
          ...(prev.session || {}),
          secureVoice: {
            state: 'ready',
            channelId: updatedChannelId,
            participantCount: participantIdsRef.current.length,
            updatedAt: new Date().toISOString(),
            warning: null,
          },
        },
      }));
    };

    window.addEventListener('voice-key-updated', handleVoiceKeyUpdated);
    return () => {
      window.removeEventListener('voice-key-updated', handleVoiceKeyUpdated);
    };
  }, [updateVoiceDiagnostics]);

  useEffect(() => {
    if (!areVoiceDiagnosticsEnabled() || !channelId) return;

    let cancelled = false;

    const pollStats = async () => {
      const producer = producerRef.current;
      let nextSenderStats = null;

      if (producer) {
        try {
          nextSenderStats = summarizeProducerStats(await producer.getStats());
        } catch {}
      }

      const consumerEntries = Array.from(consumersRef.current.entries());
      const consumerStatsEntries = await Promise.all(consumerEntries.map(async ([producerId, consumer]) => {
        try {
          const stats = summarizeConsumerStats(await consumer.getStats());
          return [producerId, stats];
        } catch {
          return null;
        }
      }));

      if (cancelled) return;

      updateVoiceDiagnostics((prev) => {
        const nextConsumers = { ...prev.consumers };
        const sampledAt = new Date().toISOString();

        for (const entry of consumerStatsEntries) {
          if (!entry) continue;
          const [producerId, stats] = entry;
          nextConsumers[producerId] = {
            ...nextConsumers[producerId],
            stats,
            sampledAt,
          };
        }

        return {
          ...prev,
          senderStats: nextSenderStats
            ? {
                ...nextSenderStats,
                sampledAt,
              }
            : null,
          consumers: nextConsumers,
        };
      });
    };

    pollStats();
    const intervalId = setInterval(pollStats, 2000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [channelId, updateVoiceDiagnostics]);

  useEffect(() => {
    if (!areVoiceDiagnosticsEnabled()) return;
    updateVoiceDiagnostics((prev) => ({
      ...prev,
      screenShare: screenShareDiagnostics,
    }));
  }, [screenShareDiagnostics, updateVoiceDiagnostics]);

  useEffect(() => {
    if (!screenSharing) return;

    let cancelled = false;

    const pollScreenShareStats = async () => {
      const producer = screenShareProducerRef.current;
      const track = screenShareStreamRef.current?.getVideoTracks?.()?.[0] || null;
      if (!producer || !track) return;

      let senderStats = null;
      try {
        senderStats = summarizeProducerStats(await producer.getStats());
      } catch {}

      if (cancelled) return;

      const sampledAt = new Date().toISOString();
      const currentBytes = senderStats?.outboundVideo?.bytesSent ?? null;
      const previousSample = screenShareStatsRef.current;
      let outgoingBitrateKbps = null;
      if (
        previousSample
        && currentBytes !== null
        && previousSample.bytesSent !== null
        && typeof previousSample.timestamp === 'number'
      ) {
        const elapsedMs = performance.now() - previousSample.timestamp;
        if (elapsedMs > 0) {
          outgoingBitrateKbps = roundRate(Math.max(0, ((currentBytes - previousSample.bytesSent) * 8) / elapsedMs), 1);
        }
      }

      screenShareStatsRef.current = {
        timestamp: performance.now(),
        bytesSent: currentBytes,
      };

      setScreenShareDiagnostics((prev) => ({
        active: true,
        startedAt: prev?.startedAt || sampledAt,
        requestedCapture: prev?.requestedCapture || null,
        sourceId: prev?.sourceId || null,
        includeAudio: prev?.includeAudio ?? false,
        senderParameters: prev?.senderParameters || null,
        captureTrack: summarizeTrackSnapshot(track),
        sender: senderStats ? {
          ...senderStats,
          outgoingBitrateKbps,
        } : null,
        sampledAt,
      }));
    };

    void pollScreenShareStats();
    const intervalId = window.setInterval(() => {
      void pollScreenShareStats();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [screenSharing]);

  // Cleanup on unmount only ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â use ref to avoid re-running on leaveChannel identity change
  useEffect(() => {
    return () => {
      if (pendingLiveReconfigureRef.current) {
        clearTimeout(pendingLiveReconfigureRef.current);
        pendingLiveReconfigureRef.current = null;
      }
      if (channelIdRef.current) leaveChannelRef.current?.();
    };
  }, []);

  return {
    channelId,
    muted,
    deafened,
    speaking,
    peers,
    joinError,
    joinChannel,
    leaveChannel,
    toggleMute,
    toggleDeafen,
    setOutputDevice,
    setUserVolume,
    setMicGain,
    voiceProcessingMode,
    setVoiceProcessingMode,
    voiceDiagnostics,
    liveVoiceFallbackReason,
    toggleNoiseSuppression,
    screenSharing,
    screenShareStream,
    screenShareDiagnostics,
    startScreenShare,
    stopScreenShare,
    incomingScreenShares,
    showSourcePicker,
    confirmScreenShare,
    cancelSourcePicker,
    screenShareError,
    clearScreenShareError,
    voiceE2E,
    e2eWarning,
  };
}
