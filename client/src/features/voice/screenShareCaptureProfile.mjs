import {
  SCREEN_SHARE_CAPTURE_IDEAL_HEIGHT,
  SCREEN_SHARE_CAPTURE_IDEAL_WIDTH,
  SCREEN_SHARE_CAPTURE_MAX_FPS,
  SCREEN_SHARE_INITIAL_PROFILE_INDEX,
  SCREEN_SHARE_PROFILES,
  SCREEN_SHARE_SIMULCAST_ENCODINGS,
} from './screenShareProfileConstants.mjs';

export function formatResolution(width, height) {
  if (!width || !height) return null;
  return `${width}x${height}`;
}

export function summarizeScreenShareProfile(profile) {
  if (!profile) return null;

  return {
    id: profile.id,
    label: profile.label,
    targetResolution: formatResolution(profile.width, profile.height),
    targetFps: profile.fps,
    maxBitrate: profile.maxBitrate,
    startBitrateKbps: profile.startBitrateKbps,
    minBitrateKbps: profile.minBitrateKbps,
  };
}

export function getScreenShareRequestedCapture(profile = SCREEN_SHARE_PROFILES[SCREEN_SHARE_INITIAL_PROFILE_INDEX]) {
  return {
    idealResolution: formatResolution(SCREEN_SHARE_CAPTURE_IDEAL_WIDTH, SCREEN_SHARE_CAPTURE_IDEAL_HEIGHT),
    minimumResolution: formatResolution(profile.width, profile.height),
    targetFps: profile.fps,
    captureFpsCeiling: SCREEN_SHARE_CAPTURE_MAX_FPS,
    maxBitrate: profile.maxBitrate,
    startBitrateKbps: profile.startBitrateKbps,
    minBitrateKbps: profile.minBitrateKbps,
  };
}

export function summarizeScreenShareHardware({
  navigatorObject = typeof navigator !== 'undefined' ? navigator : null,
  getPlatform = () => globalThis.window?.electronAPI?.getPlatform?.() || null,
  isHardwareAccelerationEnabled = () => globalThis.window?.electronAPI?.isHardwareAccelerationEnabled?.() ?? null,
  getGPUFeatureStatus = () => globalThis.window?.electronAPI?.getGPUFeatureStatus?.() || null,
} = {}) {
  if (!navigatorObject) return null;

  const platform = getPlatform();
  const cpuThreads = typeof navigatorObject.hardwareConcurrency === 'number'
    ? navigatorObject.hardwareConcurrency
    : null;
  const deviceMemoryGb = typeof navigatorObject.deviceMemory === 'number'
    ? navigatorObject.deviceMemory
    : null;
  const gpuFeatureStatus = getGPUFeatureStatus();

  return {
    platform,
    cpuThreads,
    deviceMemoryGb,
    hardwareAccelerationEnabled: isHardwareAccelerationEnabled(),
    gpuCompositing: gpuFeatureStatus?.gpuCompositing || null,
    gpuRasterization: gpuFeatureStatus?.gpuRasterization || null,
    videoDecode: gpuFeatureStatus?.videoDecode || null,
    videoEncode: gpuFeatureStatus?.videoEncode || null,
    lowResourceHint: (
      (platform === 'darwin' && typeof cpuThreads === 'number' && cpuThreads <= 8)
      || (typeof deviceMemoryGb === 'number' && deviceMemoryGb <= 8)
    ),
  };
}

export function getTrackSnapshotDimensions(track) {
  if (!track) return { width: null, height: null };

  try {
    const settings = track.getSettings?.() || {};
    const width = Number(settings.width) || null;
    const height = Number(settings.height) || null;
    return { width, height };
  } catch {
    return { width: null, height: null };
  }
}

export function getScreenShareScaleResolutionDownBy(track, profile) {
  if (!profile) return 1;

  const { width, height } = getTrackSnapshotDimensions(track);
  if (!width || !height) return 1;

  const widthScale = profile.width ? width / profile.width : 1;
  const heightScale = profile.height ? height / profile.height : 1;
  const scale = Math.max(widthScale, heightScale, 1);
  return Math.round(scale * 100) / 100;
}

export function getSingleScreenShareEncoding(track, profile) {
  return {
    maxBitrate: profile.maxBitrate,
    maxFramerate: profile.fps,
    scaleResolutionDownBy: getScreenShareScaleResolutionDownBy(track, profile),
    priority: 'high',
    networkPriority: 'high',
    scalabilityMode: 'L1T3',
  };
}

export function getSimulcastScreenShareEncodings() {
  return SCREEN_SHARE_SIMULCAST_ENCODINGS.map((encoding) => ({ ...encoding }));
}

export async function applyPreferredScreenShareConstraints(
  videoTrack,
  preferredProfile = SCREEN_SHARE_PROFILES[0],
) {
  if (!videoTrack?.applyConstraints) return;

  const attempts = [
    {
      width: { ideal: preferredProfile.width, max: preferredProfile.width },
      height: { ideal: preferredProfile.height, max: preferredProfile.height },
      frameRate: { ideal: preferredProfile.fps, max: SCREEN_SHARE_CAPTURE_MAX_FPS },
    },
    ...SCREEN_SHARE_PROFILES
      .filter((profile) => profile.id !== preferredProfile.id)
      .map((profile) => ({
        width: { ideal: profile.width, max: profile.width },
        height: { ideal: profile.height, max: profile.height },
        frameRate: { ideal: profile.fps, max: SCREEN_SHARE_CAPTURE_MAX_FPS },
      })),
  ];

  for (const constraints of attempts) {
    try {
      await videoTrack.applyConstraints(constraints);
      return;
    } catch {}
  }
}
