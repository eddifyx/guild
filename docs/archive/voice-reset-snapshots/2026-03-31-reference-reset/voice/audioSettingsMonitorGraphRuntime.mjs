export function attachAudioSettingsMonitorGraph({
  ctx,
  gainNode,
  monitorProfile,
  monitorGainRef = { current: null },
} = {}) {
  const monitorGain = ctx.createGain();

  monitorGain.gain.value = monitorProfile.gain;
  monitorGainRef.current = monitorGain;

  // A direct monitor tap is more reliable in Electron/macOS than routing the
  // mono mic through an extra merger stage before playback.
  gainNode.connect(monitorGain);

  return {
    monitorGain,
  };
}
