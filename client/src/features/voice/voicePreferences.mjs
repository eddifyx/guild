export const VOICE_INPUT_DEVICE_STORAGE_KEY = 'voice:inputDeviceId';
export const VOICE_OUTPUT_DEVICE_STORAGE_KEY = 'voice:outputDeviceId';
export const VOICE_MIC_GAIN_STORAGE_KEY = 'voice:micGain';
export const VOICE_USER_VOLUME_STORAGE_PREFIX = 'voice:userVolume:';

export function normalizeVoiceInputDeviceId(deviceId) {
  const normalized = String(deviceId || '').trim();
  return normalized === 'default' ? '' : normalized;
}

function resolveStorage(storage = null) {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export function clampVoiceVolume(value, fallback = 1) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(0, Math.min(1, numericValue));
}

export function readStoredVoiceInputDeviceId(storage = null) {
  const resolvedStorage = resolveStorage(storage);
  return normalizeVoiceInputDeviceId(
    resolvedStorage?.getItem?.(VOICE_INPUT_DEVICE_STORAGE_KEY) || ''
  );
}

export function readStoredVoiceOutputDeviceId(storage = null) {
  const resolvedStorage = resolveStorage(storage);
  return String(resolvedStorage?.getItem?.(VOICE_OUTPUT_DEVICE_STORAGE_KEY) || 'default') || 'default';
}

export function readStoredMicGain(storage = null, fallback = 3) {
  const resolvedStorage = resolveStorage(storage);
  const storedValue = resolvedStorage?.getItem?.(VOICE_MIC_GAIN_STORAGE_KEY);
  const parsedValue = storedValue !== null ? parseFloat(storedValue) : Number.NaN;
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

export function readStoredUserVolume(userId, storage = null, fallback = 1) {
  if (!userId) return fallback;
  const resolvedStorage = resolveStorage(storage);
  const storedValue = resolvedStorage?.getItem?.(`${VOICE_USER_VOLUME_STORAGE_PREFIX}${userId}`);
  if (storedValue == null || storedValue === '') return fallback;
  return clampVoiceVolume(storedValue, fallback);
}

export function persistStoredMicGain(gain, storage = null) {
  const resolvedStorage = resolveStorage(storage);
  resolvedStorage?.setItem?.(VOICE_MIC_GAIN_STORAGE_KEY, String(gain));
  return gain;
}

export function persistStoredUserVolume(userId, volume, storage = null) {
  if (!userId) return clampVoiceVolume(volume);
  const nextVolume = clampVoiceVolume(volume);
  const resolvedStorage = resolveStorage(storage);
  resolvedStorage?.setItem?.(`${VOICE_USER_VOLUME_STORAGE_PREFIX}${userId}`, String(nextVolume));
  return nextVolume;
}

export async function applyVoiceOutputDevice(audioElement, deviceId) {
  const targetSinkId = deviceId || 'default';
  const currentSinkId = typeof audioElement?.sinkId === 'string' ? audioElement.sinkId : null;
  if (!audioElement?.setSinkId) return targetSinkId;
  if (targetSinkId === 'default' && (!currentSinkId || currentSinkId === 'default')) {
    return 'default';
  }

  try {
    await audioElement.setSinkId(targetSinkId);
    return targetSinkId;
  } catch {
    if (targetSinkId !== 'default') {
      try {
        await audioElement.setSinkId('default');
      } catch {}
    }
    return 'default';
  }
}

export function applyVoiceOutputDeviceToAll(audioElements, deviceId) {
  const targetSinkId = deviceId || 'default';
  for (const audioElement of audioElements || []) {
    const currentSinkId = typeof audioElement?.sinkId === 'string' ? audioElement.sinkId : null;
    if (
      audioElement?.setSinkId
      && !(targetSinkId === 'default' && (!currentSinkId || currentSinkId === 'default'))
    ) {
      audioElement.setSinkId(targetSinkId).catch(() => {});
    }
  }
  return targetSinkId;
}
