import {
  maybeAdaptVoiceScreenShareProfile,
  applyVoiceScreenShareProfile,
  promoteVoiceScreenShareToSimulcast,
  publishVoiceScreenShareVideoProducer,
} from './voiceScreenShareRuntime.mjs';

export function createVoiceScreenShareRuntimeBindings({
  refs = {},
  setters = {},
  runtime = {},
  constants = {},
  deps = {},
} = {}) {
  const {
    deviceRef = { current: null },
    screenSendTransportRef = { current: null },
    screenShareStreamRef = { current: null },
    screenShareProducerRef = { current: null },
    screenShareStatsRef = { current: null },
    screenShareProfileIndexRef = { current: 0 },
    screenShareSimulcastEnabledRef = { current: false },
    screenSharePromotionInFlightRef = { current: false },
    screenSharePromotionCooldownUntilRef = { current: 0 },
    screenShareAdaptationRef = { current: null },
  } = refs;

  const {
    setScreenShareDiagnosticsFn = () => {},
  } = setters;

  const {
    getPreferredScreenShareCodecCandidatesFn = () => [],
    getSimulcastScreenShareEncodingsFn = () => [],
    getSingleScreenShareEncodingFn = () => [],
    applySenderPreferencesFn = async () => {},
    attachSenderEncryptionFn = async () => {},
    getPrimaryCodecMimeTypeFromRtpParametersFn = () => null,
    getExperimentalScreenVideoBypassModeFn = () => null,
    applyPreferredScreenShareConstraintsFn = async () => {},
    summarizeTrackSnapshotFn = (value) => value,
    summarizeScreenShareProfileFn = (value) => value,
    summarizeSenderParametersFn = (value) => value,
    summarizeScreenShareHardwareFn = (value) => value,
    summarizeSelectedCodecFn = (value) => value,
    normalizeVoiceErrorMessageFn = (value) => value,
    decideScreenShareAdaptationFn = () => null,
    getRuntimeScreenShareCodecModeFn = () => null,
    performanceNowFn = () => globalThis.performance?.now?.() ?? Date.now(),
    nowIsoFn = () => new Date().toISOString(),
    warnFn = () => {},
  } = runtime;

  const {
    screenShareProfiles = [],
    promotionFailureCooldownMs = 0,
    adaptationHoldMs = 0,
    initialProfileIndex = 0,
  } = constants;

  const publishVoiceScreenShareVideoProducerFn =
    deps.publishVoiceScreenShareVideoProducerFn || publishVoiceScreenShareVideoProducer;
  const applyVoiceScreenShareProfileFn =
    deps.applyVoiceScreenShareProfileFn || applyVoiceScreenShareProfile;
  const promoteVoiceScreenShareToSimulcastFn =
    deps.promoteVoiceScreenShareToSimulcastFn || promoteVoiceScreenShareToSimulcast;
  const maybeAdaptVoiceScreenShareProfileFn =
    deps.maybeAdaptVoiceScreenShareProfileFn || maybeAdaptVoiceScreenShareProfile;

  function resetScreenShareAdaptation() {
    screenShareProfileIndexRef.current = initialProfileIndex;
    screenShareSimulcastEnabledRef.current = false;
    screenSharePromotionInFlightRef.current = false;
    screenSharePromotionCooldownUntilRef.current = 0;
    screenShareAdaptationRef.current = {
      degradeSamples: 0,
      recoverySamples: 0,
      lastChangedAtMs: 0,
      lastReason: 'cold-start',
    };
  }

  async function publishScreenShareVideoProducer({
    track,
    transport,
    profile,
    screenShareCodecMode,
    simulcast = false,
  }) {
    return publishVoiceScreenShareVideoProducerFn({
      track,
      transport,
      profile,
      screenShareCodecMode,
      simulcast,
      device: deviceRef.current,
      getPreferredScreenShareCodecCandidatesFn,
      getSimulcastScreenShareEncodingsFn,
      getSingleScreenShareEncodingFn,
      applySenderPreferencesFn,
      attachSenderEncryptionFn,
      getPrimaryCodecMimeTypeFromRtpParametersFn,
      getExperimentalScreenVideoBypassModeFn,
      warnFn,
    });
  }

  async function applyScreenShareProfile(profileIndex, {
    reason = 'manual',
    force = false,
  } = {}) {
    return applyVoiceScreenShareProfileFn({
      profileIndex,
      reason,
      force,
      refs: {
        screenShareStreamRef,
        screenShareProducerRef,
        screenShareProfileIndexRef,
        screenShareSimulcastEnabledRef,
        screenShareAdaptationRef,
      },
      screenShareProfiles,
      applyPreferredScreenShareConstraintsFn,
      applySenderPreferencesFn,
      getSingleScreenShareEncodingFn,
      summarizeTrackSnapshotFn,
      summarizeScreenShareProfileFn,
      summarizeSenderParametersFn,
      summarizeScreenShareHardwareFn,
      setScreenShareDiagnosticsFn,
      performanceNowFn,
      nowIsoFn,
      warnFn,
    });
  }

  async function promoteScreenShareToSimulcast({
    reason = 'auto-promoted-simulcast',
  } = {}) {
    return promoteVoiceScreenShareToSimulcastFn({
      reason,
      refs: {
        screenSendTransportRef,
        screenShareStreamRef,
        screenShareProducerRef,
        screenShareSimulcastEnabledRef,
        screenSharePromotionInFlightRef,
        screenSharePromotionCooldownUntilRef,
        screenShareStatsRef,
        screenShareProfileIndexRef,
        screenShareAdaptationRef,
      },
      screenShareProfiles,
      promotionFailureCooldownMs,
      applyPreferredScreenShareConstraintsFn,
      publishScreenShareVideoProducerFn: ({ track, transport, profile, simulcast }) => (
        publishScreenShareVideoProducer({
          track,
          transport,
          profile,
          screenShareCodecMode: getRuntimeScreenShareCodecModeFn(),
          simulcast,
        })
      ),
      applyScreenShareProfileFn: applyScreenShareProfile,
      summarizeTrackSnapshotFn,
      summarizeScreenShareProfileFn,
      summarizeSelectedCodecFn,
      summarizeSenderParametersFn,
      summarizeScreenShareHardwareFn,
      setScreenShareDiagnosticsFn,
      performanceNowFn,
      nowIsoFn,
      normalizeVoiceErrorMessageFn,
      warnFn,
    });
  }

  async function maybeAdaptScreenShareProfile(senderStats) {
    return maybeAdaptVoiceScreenShareProfileFn({
      senderStats,
      refs: {
        screenShareProfileIndexRef,
        screenShareAdaptationRef,
        screenShareSimulcastEnabledRef,
        screenSharePromotionInFlightRef,
      },
      screenShareProfiles,
      adaptationHoldMs,
      initialProfileIndex,
      decideScreenShareAdaptationFn,
      applyScreenShareProfileFn: applyScreenShareProfile,
      promoteScreenShareToSimulcastFn: promoteScreenShareToSimulcast,
      performanceNowFn,
    });
  }

  return {
    resetScreenShareAdaptation,
    publishScreenShareVideoProducer,
    applyScreenShareProfile,
    promoteScreenShareToSimulcast,
    maybeAdaptScreenShareProfile,
  };
}
