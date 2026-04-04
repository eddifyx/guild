import { getMicLevelColor, getMicStatusText } from './audioSettingsModel.mjs';

export function updateAudioSettingsMicMeter({
  level = 0,
  refs = {},
  getMicLevelColorFn = getMicLevelColor,
  getMicStatusTextFn = getMicStatusText,
} = {}) {
  const normalized = Math.max(0, Math.min(100, level));
  const color = getMicLevelColorFn(normalized);

  if (refs.meterFillRef?.current) {
    refs.meterFillRef.current.style.width = `${normalized}%`;
    refs.meterFillRef.current.style.background = color;
  }

  if (refs.meterValueRef?.current) {
    refs.meterValueRef.current.textContent = String(Math.round(normalized));
    refs.meterValueRef.current.style.color = color;
  }

  if (refs.meterStatusRef?.current) {
    refs.meterStatusRef.current.textContent = getMicStatusTextFn(normalized);
  }

  return { normalized, color };
}

export function applyAudioSettingsNoiseSuppressionRouting({
  enabled = false,
  routing = null,
} = {}) {
  if (!routing) {
    return false;
  }

  const processedReady = routing.processedReady === true;
  const useProcessedLane = enabled && processedReady;
  routing.rawBypassGain.gain.value = useProcessedLane ? 0 : 1;
  routing.processedGain.gain.value = useProcessedLane ? 1 : 0;
  return useProcessedLane;
}
