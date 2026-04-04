function setDiagnostics(setter, updater) {
  if (typeof setter !== 'function') return;
  setter(updater);
}

export async function publishVoiceScreenShareVideoProducer({
  track = null,
  transport = null,
  profile = null,
  screenShareCodecMode = 'auto',
  simulcast = false,
  device = null,
  getPreferredScreenShareCodecCandidatesFn = () => [],
  getSimulcastScreenShareEncodingsFn = () => [],
  getSingleScreenShareEncodingFn = () => ({}),
  applySenderPreferencesFn = async () => null,
  attachSenderEncryptionFn = () => {},
  getPrimaryCodecMimeTypeFromRtpParametersFn = () => null,
  getExperimentalScreenVideoBypassModeFn = () => null,
  warnFn = () => {},
} = {}) {
  const screenShareCodecCandidates = getPreferredScreenShareCodecCandidatesFn(
    device,
    { preference: screenShareCodecMode }
  );
  const screenShareCodecAttempts = screenShareCodecCandidates.length > 0
    ? screenShareCodecCandidates
    : [null];

  let producer = null;
  let selectedScreenShareCodec = null;
  let lastScreenShareProduceError = null;

  for (const codecCandidate of screenShareCodecAttempts) {
    try {
      producer = await transport.produce({
        track,
        codec: codecCandidate || undefined,
        encodings: simulcast
          ? getSimulcastScreenShareEncodingsFn()
          : [getSingleScreenShareEncodingFn(track, profile)],
        codecOptions: {
          videoGoogleStartBitrate: profile.startBitrateKbps,
          videoGoogleMinBitrate: profile.minBitrateKbps,
          videoGoogleMaxBitrate: Math.round(profile.maxBitrate / 1000),
        },
        appData: {
          source: 'screen-video',
          codecPreference: screenShareCodecMode,
          requestedCodecMimeType: codecCandidate?.mimeType || null,
        },
      });
      selectedScreenShareCodec = codecCandidate || null;
      break;
    } catch (produceErr) {
      lastScreenShareProduceError = produceErr;
      warnFn(
        '[Voice] Failed to publish screen share video with codec candidate:',
        codecCandidate?.mimeType || 'browser-default',
        produceErr
      );
    }
  }

  if (!producer) {
    throw lastScreenShareProduceError || new Error('Screen sharing failed to start.');
  }

  const videoSender = producer.rtpSender;
  if (!videoSender) {
    producer.close();
    throw new Error('Screen sharing is unavailable because secure media transforms could not attach to video.');
  }

  const selectedScreenShareCodecMimeType = selectedScreenShareCodec?.mimeType
    || getPrimaryCodecMimeTypeFromRtpParametersFn(producer.rtpParameters);
  const screenVideoBypassMode = getExperimentalScreenVideoBypassModeFn({
    source: 'screen-video',
    codecMimeType: selectedScreenShareCodecMimeType,
  });
  const bypassScreenVideoEncryption = Boolean(screenVideoBypassMode);

  let senderParameters = null;
  try {
    senderParameters = await applySenderPreferencesFn(videoSender, simulcast
      ? {
          maxFramerate: profile.fps,
          priority: 'high',
          networkPriority: 'high',
          degradationPreference: 'maintain-framerate',
        }
      : {
          maxBitrate: profile.maxBitrate,
          maxFramerate: profile.fps,
          scaleResolutionDownBy: getSingleScreenShareEncodingFn(track, profile).scaleResolutionDownBy,
          priority: 'high',
          networkPriority: 'high',
          degradationPreference: 'maintain-framerate',
          scalabilityMode: 'L1T3',
        });
  } catch (senderParamErr) {
    warnFn('[Voice] Failed to set screen share sender parameters:', senderParamErr);
  }

  if (!bypassScreenVideoEncryption) {
    attachSenderEncryptionFn(videoSender, {
      kind: 'video',
      codecMimeType: selectedScreenShareCodecMimeType,
    });
  }

  return {
    producer,
    selectedScreenShareCodec,
    screenVideoBypassMode,
    bypassScreenVideoEncryption,
    senderParameters,
    streamMode: simulcast ? 'simulcast' : 'single',
  };
}

export async function applyVoiceScreenShareProfile({
  profileIndex = 0,
  reason = 'manual',
  force = false,
  refs = {},
  screenShareProfiles = [],
  applyPreferredScreenShareConstraintsFn = async () => {},
  applySenderPreferencesFn = async () => null,
  getSingleScreenShareEncodingFn = () => ({}),
  summarizeTrackSnapshotFn = () => null,
  summarizeScreenShareProfileFn = () => null,
  summarizeSenderParametersFn = () => null,
  summarizeScreenShareHardwareFn = () => null,
  setScreenShareDiagnosticsFn = () => {},
  performanceNowFn = () => 0,
  nowIsoFn = () => new Date().toISOString(),
  warnFn = () => {},
} = {}) {
  const boundedIndex = Math.max(0, Math.min(profileIndex, screenShareProfiles.length - 1));
  const nextProfile = screenShareProfiles[boundedIndex];
  const currentProfile = screenShareProfiles[refs.screenShareProfileIndexRef?.current];
  if (!nextProfile) return false;
  if (!force && currentProfile?.id === nextProfile.id) {
    return false;
  }

  const track = refs.screenShareStreamRef?.current?.getVideoTracks?.()?.[0] || null;
  let captureTrackSnapshot = null;
  if (track) {
    await applyPreferredScreenShareConstraintsFn(track, nextProfile);
    try {
      track.contentHint = nextProfile.fps >= 30 ? 'motion' : 'detail';
    } catch {}
    captureTrackSnapshot = summarizeTrackSnapshotFn(track);
  }

  const sender = refs.screenShareProducerRef?.current?.rtpSender || null;
  let parameters = null;
  if (sender && !refs.screenShareSimulcastEnabledRef?.current) {
    try {
      parameters = await applySenderPreferencesFn(sender, {
        maxBitrate: nextProfile.maxBitrate,
        maxFramerate: nextProfile.fps,
        scaleResolutionDownBy: getSingleScreenShareEncodingFn(track, nextProfile).scaleResolutionDownBy,
        priority: 'high',
        networkPriority: 'high',
        degradationPreference: 'maintain-framerate',
        scalabilityMode: 'L1T3',
      });
    } catch (err) {
      warnFn('[Voice] Failed to apply screen share profile:', err);
    }
  }

  if (refs.screenShareProfileIndexRef) {
    refs.screenShareProfileIndexRef.current = boundedIndex;
  }
  if (refs.screenShareAdaptationRef) {
    refs.screenShareAdaptationRef.current = {
      degradeSamples: 0,
      recoverySamples: 0,
      lastChangedAtMs: performanceNowFn(),
      lastReason: reason,
    };
  }

  setDiagnostics(setScreenShareDiagnosticsFn, (prev) => prev ? {
    ...prev,
    activeProfile: summarizeScreenShareProfileFn(nextProfile),
    captureTrack: captureTrackSnapshot || prev.captureTrack || null,
    senderParameters: parameters ? summarizeSenderParametersFn(parameters) : (prev.senderParameters || null),
    adaptation: {
      hardware: prev?.adaptation?.hardware || summarizeScreenShareHardwareFn(),
      lastReason: reason,
      lastChangedAt: nowIsoFn(),
      degradeSamples: 0,
      recoverySamples: 0,
    },
  } : prev);

  return true;
}

export async function promoteVoiceScreenShareToSimulcast({
  reason = 'auto-promoted-simulcast',
  refs = {},
  screenShareProfiles = [],
  promotionFailureCooldownMs = 0,
  applyPreferredScreenShareConstraintsFn = async () => {},
  publishScreenShareVideoProducerFn = async () => ({}),
  applyScreenShareProfileFn = async () => false,
  summarizeTrackSnapshotFn = () => null,
  summarizeScreenShareProfileFn = () => null,
  summarizeSelectedCodecFn = () => null,
  summarizeSenderParametersFn = () => null,
  summarizeScreenShareHardwareFn = () => null,
  setScreenShareDiagnosticsFn = () => {},
  performanceNowFn = () => 0,
  nowIsoFn = () => new Date().toISOString(),
  normalizeVoiceErrorMessageFn = () => '',
  warnFn = () => {},
} = {}) {
  if (refs.screenShareSimulcastEnabledRef?.current || refs.screenSharePromotionInFlightRef?.current) {
    return false;
  }

  if (performanceNowFn() < (refs.screenSharePromotionCooldownUntilRef?.current || 0)) {
    return false;
  }

  const transport = refs.screenSendTransportRef?.current || null;
  const track = refs.screenShareStreamRef?.current?.getVideoTracks?.()?.[0] || null;
  const currentProducer = refs.screenShareProducerRef?.current || null;
  if (!transport || transport.closed || !track || !currentProducer) {
    return false;
  }

  refs.screenSharePromotionInFlightRef.current = true;
  const promotedProfile = screenShareProfiles[0];

  try {
    await applyPreferredScreenShareConstraintsFn(track, promotedProfile);
    try {
      track.contentHint = promotedProfile.fps >= 30 ? 'motion' : 'detail';
    } catch {}

    const captureTrackSnapshot = summarizeTrackSnapshotFn(track);
    const {
      producer,
      selectedScreenShareCodec,
      screenVideoBypassMode,
      bypassScreenVideoEncryption,
      senderParameters,
    } = await publishScreenShareVideoProducerFn({
      track,
      transport,
      profile: promotedProfile,
      simulcast: true,
    });

    try {
      currentProducer.close();
    } catch {}

    refs.screenShareProducerRef.current = producer;
    refs.screenShareSimulcastEnabledRef.current = true;
    if (refs.screenShareStatsRef) {
      refs.screenShareStatsRef.current = null;
    }
    if (refs.screenShareProfileIndexRef) {
      refs.screenShareProfileIndexRef.current = 0;
    }
    if (refs.screenShareAdaptationRef) {
      refs.screenShareAdaptationRef.current = {
        degradeSamples: 0,
        recoverySamples: 0,
        lastChangedAtMs: performanceNowFn(),
        lastReason: reason,
      };
    }

    setDiagnostics(setScreenShareDiagnosticsFn, (prev) => prev ? {
      ...prev,
      activeProfile: summarizeScreenShareProfileFn(promotedProfile),
      selectedCodec: summarizeSelectedCodecFn(selectedScreenShareCodec),
      e2eeMode: bypassScreenVideoEncryption ? screenVideoBypassMode : 'encrypted',
      captureTrack: captureTrackSnapshot,
      senderParameters: senderParameters
        ? summarizeSenderParametersFn(senderParameters)
        : (prev.senderParameters || null),
      producerMode: 'simulcast',
      promotionFailure: null,
      adaptation: {
        hardware: prev?.adaptation?.hardware || summarizeScreenShareHardwareFn(),
        lastReason: reason,
        lastChangedAt: nowIsoFn(),
        degradeSamples: 0,
        recoverySamples: 0,
      },
    } : prev);

    return true;
  } catch (err) {
    warnFn('[Voice] Failed to promote screen share to simulcast:', err);
    if (refs.screenSharePromotionCooldownUntilRef) {
      refs.screenSharePromotionCooldownUntilRef.current = performanceNowFn() + promotionFailureCooldownMs;
    }
    await applyScreenShareProfileFn(0, {
      reason: 'promotion-failed',
      force: true,
    });
    setDiagnostics(setScreenShareDiagnosticsFn, (prev) => prev ? {
      ...prev,
      producerMode: 'single',
      promotionFailure: {
        at: nowIsoFn(),
        retryAfterMs: promotionFailureCooldownMs,
        message: normalizeVoiceErrorMessageFn(err) || 'Promotion failed',
      },
    } : prev);
    return false;
  } finally {
    refs.screenSharePromotionInFlightRef.current = false;
  }
}

export async function maybeAdaptVoiceScreenShareProfile({
  senderStats = null,
  refs = {},
  screenShareProfiles = [],
  adaptationHoldMs = 0,
  initialProfileIndex = 0,
  decideScreenShareAdaptationFn = () => ({}),
  applyScreenShareProfileFn = async () => false,
  promoteScreenShareToSimulcastFn = async () => false,
  performanceNowFn = () => 0,
} = {}) {
  const decision = decideScreenShareAdaptationFn({
    senderStats,
    currentProfileIndex: refs.screenShareProfileIndexRef?.current ?? 0,
    profiles: screenShareProfiles,
    adaptation: refs.screenShareAdaptationRef?.current ?? null,
    now: performanceNowFn(),
    holdMs: adaptationHoldMs,
    initialProfileIndex,
    simulcastEnabled: Boolean(refs.screenShareSimulcastEnabledRef?.current),
    promotionInFlight: Boolean(refs.screenSharePromotionInFlightRef?.current),
  });

  if (decision?.nextAdaptation && refs.screenShareAdaptationRef) {
    refs.screenShareAdaptationRef.current = decision.nextAdaptation;
  }
  if (!decision?.action) {
    return;
  }

  if (decision.action.type === 'promote-simulcast') {
    await promoteScreenShareToSimulcastFn({ reason: decision.action.reason });
    return;
  }

  if (decision.action.type === 'apply-profile') {
    await applyScreenShareProfileFn(decision.action.profileIndex, { reason: decision.action.reason });
  }
}
