import { SCREEN_SHARE_CODEC_MODE_STORAGE_KEY } from './screenShareProfileConstants.mjs';

function resolveStorage(storage = null) {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export function normalizeCodecMimeType(codec) {
  return String(codec?.mimeType || '').toLowerCase();
}

export function summarizeSelectedCodec(codec) {
  if (!codec) return null;

  return {
    mimeType: codec.mimeType || null,
    preferredPayloadType: codec.preferredPayloadType ?? null,
    clockRate: codec.clockRate ?? null,
    parameters: codec.parameters || null,
  };
}

export function summarizeReceiverVideoCodecSupport(
  getCapabilities = () => globalThis.RTCRtpReceiver?.getCapabilities?.('video')?.codecs || [],
) {
  try {
    const codecs = getCapabilities() || [];
    const normalizedMimeTypes = codecs
      .map((codec) => normalizeCodecMimeType(codec))
      .filter(Boolean);

    return {
      av1: normalizedMimeTypes.includes('video/av1'),
      h264: normalizedMimeTypes.includes('video/h264'),
      vp8: normalizedMimeTypes.includes('video/vp8'),
      vp9: normalizedMimeTypes.includes('video/vp9'),
    };
  } catch {
    return null;
  }
}

export function getPrimaryCodecMimeTypeFromRtpParameters(rtpParameters) {
  const codecs = Array.isArray(rtpParameters?.codecs) ? rtpParameters.codecs : [];
  const primaryCodec = codecs.find((codec) => {
    const mimeType = normalizeCodecMimeType(codec);
    return mimeType && !mimeType.endsWith('/rtx') && !mimeType.endsWith('/red') && !mimeType.endsWith('/ulpfec');
  });
  return primaryCodec?.mimeType || null;
}

export function areExperimentalScreenCodecsEnabled({
  isDev = Boolean(import.meta?.env?.DEV),
  getAppFlavor = () => globalThis.window?.electronAPI?.getAppFlavor?.() || null,
} = {}) {
  if (isDev) {
    return true;
  }

  try {
    return getAppFlavor() === 'staging';
  } catch {
    return false;
  }
}

export function getRuntimeScreenShareCodecMode({
  storage = null,
  getAppFlavor = () => globalThis.window?.electronAPI?.getAppFlavor?.() || 'production',
  getPlatform = () => globalThis.window?.electronAPI?.getPlatform?.() || null,
  experimentsEnabled = areExperimentalScreenCodecsEnabled({ getAppFlavor }),
} = {}) {
  const resolvedStorage = resolveStorage(storage);
  const runtimeAppFlavor = getAppFlavor();
  const runtimePlatform = getPlatform();

  if (runtimeAppFlavor === 'staging' && runtimePlatform === 'win32') {
    try {
      const storedPreference = String(resolvedStorage?.getItem?.(SCREEN_SHARE_CODEC_MODE_STORAGE_KEY) || '')
        .trim()
        .toLowerCase();
      if (storedPreference === 'h264') {
        resolvedStorage?.removeItem?.(SCREEN_SHARE_CODEC_MODE_STORAGE_KEY);
      }
    } catch {}

    return 'vp8';
  }

  try {
    const storedPreference = String(resolvedStorage?.getItem?.(SCREEN_SHARE_CODEC_MODE_STORAGE_KEY) || '')
      .trim()
      .toLowerCase();
    if (experimentsEnabled && ['vp8', 'h264', 'av1'].includes(storedPreference)) {
      return storedPreference;
    }
    if (!experimentsEnabled && storedPreference && storedPreference !== 'vp8') {
      resolvedStorage?.removeItem?.(SCREEN_SHARE_CODEC_MODE_STORAGE_KEY);
    }
  } catch {}

  return 'vp8';
}

export function getExperimentalScreenVideoBypassMode({
  source = null,
  codecMimeType = null,
  experimentsEnabled = areExperimentalScreenCodecsEnabled(),
} = {}) {
  if (source !== 'screen-video') return null;
  if (!experimentsEnabled) return null;

  const normalizedCodecMimeType = String(codecMimeType || '').trim().toLowerCase();
  if (normalizedCodecMimeType === 'video/av1') {
    return 'bypassed-staging-av1';
  }

  if (normalizedCodecMimeType === 'video/h264') {
    return 'bypassed-staging-h264';
  }

  return null;
}

export function scoreScreenShareCodec(codec, { preference = 'vp8' } = {}) {
  const mimeType = normalizeCodecMimeType(codec);
  if (preference === 'av1' && mimeType === 'video/av1') {
    return 300;
  }

  if (preference === 'h264' && mimeType === 'video/h264') {
    let score = 260;
    const packetizationMode = Number(codec?.parameters?.['packetization-mode'] ?? 0);
    const profileLevelId = String(codec?.parameters?.['profile-level-id'] || '').toLowerCase();

    if (packetizationMode === 1) score += 20;
    if (profileLevelId.startsWith('42')) score += 10;

    return score;
  }

  if (mimeType === 'video/vp8') {
    return preference === 'vp8' ? 240 : 220;
  }

  if (mimeType === 'video/h264') {
    let score = 100;
    const packetizationMode = Number(codec?.parameters?.['packetization-mode'] ?? 0);
    const profileLevelId = String(codec?.parameters?.['profile-level-id'] || '').toLowerCase();

    if (packetizationMode === 1) score += 20;
    if (profileLevelId.startsWith('42')) score += 10;

    return score;
  }

  if (mimeType === 'video/av1') {
    return 90;
  }

  if (mimeType === 'video/vp9') {
    return 80;
  }

  return -1;
}

export function getPreferredScreenShareCodecCandidates(device, { preference = 'vp8' } = {}) {
  const codecs = Array.isArray(device?.sendRtpCapabilities?.codecs)
    ? device.sendRtpCapabilities.codecs
    : [];

  const rankedCodecs = codecs
    .map((codec) => ({
      codec,
      score: scoreScreenShareCodec(codec, { preference }),
    }))
    .filter(({ score }) => score >= 0)
    .sort((left, right) => right.score - left.score);

  const seenMimeTypes = new Set();
  const candidates = [];
  for (const { codec } of rankedCodecs) {
    const mimeType = normalizeCodecMimeType(codec);
    if (!mimeType || seenMimeTypes.has(mimeType)) {
      continue;
    }
    seenMimeTypes.add(mimeType);
    candidates.push(codec);
  }

  return candidates;
}
