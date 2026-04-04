export const SCREEN_SHARE_DOWNGRADE_SAMPLE_THRESHOLD = 3;
export const SCREEN_SHARE_UPGRADE_SAMPLE_THRESHOLD = 7;

export function getBitrateBps(statValue, statValueBps = null) {
  if (typeof statValueBps === 'number' && Number.isFinite(statValueBps)) {
    return statValueBps;
  }
  if (typeof statValue !== 'number' || !Number.isFinite(statValue)) {
    return null;
  }

  return statValue * 1000;
}

export function decideScreenShareAdaptation({
  senderStats = null,
  currentProfileIndex = 0,
  profiles = [],
  adaptation = null,
  now = 0,
  holdMs = 0,
  initialProfileIndex = 0,
  simulcastEnabled = false,
  promotionInFlight = false,
} = {}) {
  const outboundVideo = senderStats?.outboundVideo || null;
  const candidatePair = senderStats?.candidatePair || null;
  const remoteInboundVideo = senderStats?.remoteInboundVideo || null;

  if (!outboundVideo || simulcastEnabled || promotionInFlight) {
    return {
      nextAdaptation: adaptation,
      action: null,
    };
  }

  const currentProfile = profiles[currentProfileIndex] || null;
  const nextLowerProfile = profiles[currentProfileIndex + 1] || null;
  const nextHigherProfile = profiles[currentProfileIndex - 1] || null;
  if (!currentProfile || !adaptation) {
    return {
      nextAdaptation: adaptation,
      action: null,
    };
  }

  const timeSinceLastChange = now - adaptation.lastChangedAtMs;
  const qualityLimitationReason = outboundVideo.qualityLimitationReason || 'none';
  const availableOutgoingBitrate = getBitrateBps(
    candidatePair?.availableOutgoingBitrate,
    candidatePair?.availableOutgoingBitrateBps,
  );
  const roundTripTimeMs = remoteInboundVideo?.roundTripTimeMs ?? candidatePair?.currentRoundTripTimeMs ?? null;
  const framesEncoded = outboundVideo.framesEncoded ?? null;
  const sentFps = outboundVideo.framesPerSecond ?? null;

  const cpuPressure = qualityLimitationReason === 'cpu';
  const bandwidthPressure = (
    qualityLimitationReason === 'bandwidth'
    || (
      typeof availableOutgoingBitrate === 'number'
      && availableOutgoingBitrate > 0
      && availableOutgoingBitrate < currentProfile.maxBitrate * 0.5
    )
    || (
      typeof roundTripTimeMs === 'number'
      && roundTripTimeMs > 220
      && typeof availableOutgoingBitrate === 'number'
      && availableOutgoingBitrate < currentProfile.maxBitrate * 0.7
    )
  );
  const pacingPressure = (
    qualityLimitationReason !== 'none'
    && typeof sentFps === 'number'
    && sentFps < Math.max(24, currentProfile.fps * 0.8)
  );
  const shouldDowngrade = Boolean(nextLowerProfile) && (cpuPressure || bandwidthPressure || pacingPressure);

  if (shouldDowngrade) {
    const nextAdaptation = {
      ...adaptation,
      degradeSamples: adaptation.degradeSamples + 1,
      recoverySamples: 0,
    };
    const action = (
      nextAdaptation.degradeSamples >= SCREEN_SHARE_DOWNGRADE_SAMPLE_THRESHOLD
      && timeSinceLastChange >= holdMs
    )
      ? {
          type: 'apply-profile',
          profileIndex: currentProfileIndex + 1,
          reason: cpuPressure
            ? 'auto-cpu-pressure'
            : bandwidthPressure
              ? 'auto-bandwidth-pressure'
              : 'auto-send-instability',
        }
      : null;

    return { nextAdaptation, action };
  }

  const afterDowngradeReset = {
    ...adaptation,
    degradeSamples: 0,
  };
  const promotionTargetBitrate = nextHigherProfile?.id === profiles[0]?.id
    ? 6_000_000
    : nextHigherProfile?.maxBitrate;

  const hasRecoveryHeadroom = Boolean(nextHigherProfile) && (
    qualityLimitationReason === 'none'
    && typeof availableOutgoingBitrate === 'number'
    && typeof promotionTargetBitrate === 'number'
    && availableOutgoingBitrate > promotionTargetBitrate
    && (
      typeof roundTripTimeMs !== 'number'
      || roundTripTimeMs < 100
    )
    && (
      typeof framesEncoded !== 'number'
      || framesEncoded >= 28
    )
  );

  if (hasRecoveryHeadroom) {
    const nextAdaptation = {
      ...afterDowngradeReset,
      recoverySamples: adaptation.recoverySamples + 1,
    };
    const action = (
      nextAdaptation.recoverySamples >= SCREEN_SHARE_UPGRADE_SAMPLE_THRESHOLD
      && timeSinceLastChange >= holdMs
    )
      ? (
          currentProfileIndex === initialProfileIndex
            ? { type: 'promote-simulcast', reason: 'auto-promoted-simulcast' }
            : { type: 'apply-profile', profileIndex: currentProfileIndex - 1, reason: 'auto-recovered-headroom' }
        )
      : null;

    return { nextAdaptation, action };
  }

  return {
    nextAdaptation: {
      ...afterDowngradeReset,
      recoverySamples: 0,
    },
    action: null,
  };
}
