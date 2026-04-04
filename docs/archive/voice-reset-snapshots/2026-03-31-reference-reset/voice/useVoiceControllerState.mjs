import { useCallback, useRef, useState } from 'react';

import { isVoiceDiagnosticsEnabled } from '../../utils/voiceDiagnostics.js';
import {
  getStoredVoiceProcessingMode,
  prefersAppleSystemVoiceIsolation,
} from '../../utils/voiceProcessing.js';
import { SCREEN_SHARE_INITIAL_PROFILE_INDEX } from './screenShareProfile.mjs';

export function createInitialVoiceDiagnosticsState() {
  return {
    updatedAt: null,
    session: null,
    liveCapture: null,
    senderStats: null,
    screenShare: null,
    consumers: {},
  };
}

export function createInitialScreenShareAdaptationState() {
  return {
    degradeSamples: 0,
    recoverySamples: 0,
    lastChangedAtMs: 0,
    lastReason: 'initial',
  };
}

export function useVoiceControllerState() {
  const [channelId, setChannelId] = useState(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [peers, setPeers] = useState({});
  const [joinError, setJoinError] = useState(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState(null);
  const [screenShareError, setScreenShareError] = useState(null);
  const [incomingScreenShares, setIncomingScreenShares] = useState([]);
  const [screenShareDiagnostics, setScreenShareDiagnostics] = useState(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [voiceE2E, setVoiceE2E] = useState(false);
  const [e2eWarning, setE2EWarning] = useState(null);
  const [voiceProcessingMode, setVoiceProcessingModeState] = useState(() => getStoredVoiceProcessingMode());
  const [liveVoiceFallbackReason, setLiveVoiceFallbackReason] = useState(null);
  const [voiceDiagnostics, setVoiceDiagnostics] = useState(() => createInitialVoiceDiagnosticsState());

  const updateVoiceDiagnostics = useCallback((updater) => {
    if (!isVoiceDiagnosticsEnabled()) return;
    setVoiceDiagnostics((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      return {
        ...next,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  return {
    channelId,
    muted,
    deafened,
    speaking,
    peers,
    joinError,
    screenSharing,
    screenShareStream,
    screenShareError,
    incomingScreenShares,
    screenShareDiagnostics,
    showSourcePicker,
    voiceE2E,
    e2eWarning,
    voiceProcessingMode,
    liveVoiceFallbackReason,
    voiceDiagnostics,
    setChannelId,
    setMuted,
    setDeafened,
    setSpeaking,
    setPeers,
    setJoinError,
    setScreenSharing,
    setScreenShareStream,
    setScreenShareError,
    setIncomingScreenShares,
    setScreenShareDiagnostics,
    setShowSourcePicker,
    setVoiceE2E,
    setE2EWarning,
    setVoiceProcessingModeState,
    setLiveVoiceFallbackReason,
    setVoiceDiagnostics,
    updateVoiceDiagnostics,
  };
}

export function useVoiceControllerRefs({
  voiceProcessingMode = null,
} = {}) {
  return {
    deviceRef: useRef(null),
    sendTransportRef: useRef(null),
    screenSendTransportRef: useRef(null),
    recvTransportRef: useRef(null),
    producerRef: useRef(null),
    consumersRef: useRef(new Map()),
    localStreamRef: useRef(null),
    audioElementsRef: useRef(new Map()),
    userAudioRef: useRef(new Map()),
    vadIntervalRef: useRef(null),
    voiceHealthProbeTimeoutRef: useRef(null),
    voiceHealthProbeRetryCountRef: useRef(0),
    channelIdRef: useRef(null),
    micAudioCtxRef: useRef(null),
    micGainNodeRef: useRef(null),
    noiseSuppressorNodeRef: useRef(null),
    residualDenoiserNodeRef: useRef(null),
    noiseGateNodeRef: useRef(null),
    speechFocusChainRef: useRef(null),
    keyboardSuppressorNodeRef: useRef(null),
    noiseSuppressionRoutingRef: useRef(null),
    appleVoiceFrameCleanupRef: useRef(null),
    appleVoiceStateCleanupRef: useRef(null),
    appleVoiceSourceNodeRef: useRef(null),
    appleVoiceAvailableRef: useRef(prefersAppleSystemVoiceIsolation()),
    screenShareProducerRef: useRef(null),
    screenShareAudioProducerRef: useRef(null),
    screenShareStreamRef: useRef(null),
    screenShareVideosRef: useRef(new Map()),
    producerUserMapRef: useRef(new Map()),
    producerMetaRef: useRef(new Map()),
    mutedRef: useRef(false),
    deafenedRef: useRef(false),
    mutedBeforeDeafenRef: useRef(false),
    participantIdsRef: useRef([]),
    joinGenRef: useRef(0),
    pendingSecureVoiceJoinRef: useRef(null),
    pendingLiveReconfigureRef: useRef(null),
    pendingVoiceModeSwitchTraceRef: useRef(null),
    voiceProcessingModeRef: useRef(voiceProcessingMode),
    liveCaptureRef: useRef(null),
    liveCaptureConfigGenRef: useRef(0),
    screenShareStatsRef: useRef(null),
    screenShareProfileIndexRef: useRef(SCREEN_SHARE_INITIAL_PROFILE_INDEX),
    screenShareSimulcastEnabledRef: useRef(false),
    screenSharePromotionInFlightRef: useRef(false),
    screenSharePromotionCooldownUntilRef: useRef(0),
    screenShareAdaptationRef: useRef(createInitialScreenShareAdaptationState()),
    leaveChannelRef: useRef(null),
    stopScreenShareRef: useRef(null),
  };
}
