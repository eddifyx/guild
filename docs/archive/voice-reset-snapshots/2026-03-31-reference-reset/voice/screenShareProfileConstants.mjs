export const SCREEN_SHARE_CAPTURE_IDEAL_WIDTH = 1280;
export const SCREEN_SHARE_CAPTURE_IDEAL_HEIGHT = 720;
export const SCREEN_SHARE_TARGET_WIDTH = 1920;
export const SCREEN_SHARE_TARGET_HEIGHT = 1080;
export const SCREEN_SHARE_TARGET_FPS = 30;
export const SCREEN_SHARE_CAPTURE_MAX_FPS = 30;
export const SCREEN_SHARE_MAX_BITRATE = 6_000_000;
export const SCREEN_SHARE_MIN_BITRATE_KBPS = 1_500;
export const SCREEN_SHARE_START_BITRATE_KBPS = 3_000;
export const SCREEN_SHARE_ADAPTATION_HOLD_MS = 0;
export const SCREEN_SHARE_PROMOTION_FAILURE_COOLDOWN_MS = 30_000;
export const SCREEN_SHARE_CODEC_MODE_STORAGE_KEY = 'guild:screenShareCodecMode';
export const SCREEN_SHARE_INITIAL_PROFILE_INDEX = 1;

export const SCREEN_SHARE_PROFILES = [
  {
    id: 'high-1080p30',
    label: '1080p30',
    width: SCREEN_SHARE_TARGET_WIDTH,
    height: SCREEN_SHARE_TARGET_HEIGHT,
    fps: SCREEN_SHARE_TARGET_FPS,
    maxBitrate: SCREEN_SHARE_MAX_BITRATE,
    startBitrateKbps: SCREEN_SHARE_START_BITRATE_KBPS,
    minBitrateKbps: SCREEN_SHARE_MIN_BITRATE_KBPS,
  },
  {
    id: 'balanced-720p30',
    label: '720p30',
    width: 1280,
    height: 720,
    fps: 30,
    maxBitrate: 3_000_000,
    startBitrateKbps: 2_000,
    minBitrateKbps: 1_000,
  },
  {
    id: 'efficiency-540p30',
    label: '540p30',
    width: 960,
    height: 540,
    fps: 30,
    maxBitrate: 1_200_000,
    startBitrateKbps: 1_000,
    minBitrateKbps: 600,
  },
];

export const SCREEN_SHARE_SIMULCAST_ENCODINGS = [
  {
    rid: 'l',
    scaleResolutionDownBy: 2.0,
    maxBitrate: 1_200_000,
    maxFramerate: 30,
    priority: 'high',
    networkPriority: 'high',
    scalabilityMode: 'L1T3',
  },
  {
    rid: 'm',
    scaleResolutionDownBy: 1.5,
    maxBitrate: 2_500_000,
    maxFramerate: 30,
    priority: 'high',
    networkPriority: 'high',
    scalabilityMode: 'L1T3',
  },
  {
    rid: 'h',
    scaleResolutionDownBy: 1.0,
    maxBitrate: 6_000_000,
    maxFramerate: 30,
    priority: 'high',
    networkPriority: 'high',
    scalabilityMode: 'L1T3',
  },
];
