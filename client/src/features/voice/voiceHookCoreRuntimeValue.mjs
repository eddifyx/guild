export function buildUseVoiceHookCoreRuntimeValue({
  screenShare = {},
  security = {},
  capture = {},
  mediaTransport = {},
} = {}) {
  return {
    ...screenShare,
    ...security,
    ...capture,
    ...mediaTransport,
  };
}
