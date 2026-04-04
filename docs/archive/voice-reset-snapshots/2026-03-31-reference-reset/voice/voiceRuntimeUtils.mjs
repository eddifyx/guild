const FORCE_VOICE_AUDIO_BYPASS = import.meta?.env?.VITE_FORCE_VOICE_AUDIO_BYPASS === '1';
const DEFAULT_VOICE_AUDIO_BYPASS_MODE = FORCE_VOICE_AUDIO_BYPASS
  ? 'forced-audio-bypass'
  : null;

export function applyNoiseSuppressionRouting(routing, enabled) {
  if (!routing) {
    return false;
  }

  const processedReady = routing.processedReady === true;
  const useProcessedLane = enabled && processedReady;
  routing.rawBypassGain.gain.value = useProcessedLane ? 0 : 1;
  routing.processedGain.gain.value = useProcessedLane ? 1 : 0;
  return useProcessedLane;
}

export function roundMs(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
}

export function roundRate(value, decimals = 1) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function ensureVoiceAudioHost(documentObj = typeof document !== 'undefined' ? document : null) {
  if (!documentObj) return null;

  let host = documentObj.getElementById?.('voice-audio-host');
  if (!host) {
    host = documentObj.createElement?.('div');
    if (!host) return null;
    host.id = 'voice-audio-host';
    host.setAttribute?.('aria-hidden', 'true');
    Object.assign(host.style, {
      position: 'fixed',
      width: '0',
      height: '0',
      overflow: 'hidden',
      opacity: '0',
      pointerEvents: 'none',
    });
    documentObj.body?.appendChild?.(host);
  }

  return host;
}

export function summarizeSenderParameters(parameters) {
  return {
    degradationPreference: parameters?.degradationPreference || null,
    encodings: Array.isArray(parameters?.encodings)
      ? parameters.encodings.map((encoding) => ({
        active: encoding.active ?? null,
        maxBitrate: encoding.maxBitrate ?? null,
        maxFramerate: encoding.maxFramerate ?? null,
        scaleResolutionDownBy: encoding.scaleResolutionDownBy ?? null,
        scalabilityMode: encoding.scalabilityMode || null,
        priority: encoding.priority || null,
        networkPriority: encoding.networkPriority || null,
      }))
      : [],
  };
}

export function getVoiceAudioBypassMode({
  kind = null,
  source = null,
  forceAudioBypassByKind = FORCE_VOICE_AUDIO_BYPASS,
  voiceSafeMode = false,
  disableVoiceInsertableStreams = false,
  bypassMode = DEFAULT_VOICE_AUDIO_BYPASS_MODE,
} = {}) {
  if (kind !== 'audio') return null;
  if (!forceAudioBypassByKind && source !== 'microphone') return null;
  if (voiceSafeMode) return 'bypassed-voice-safe-mode';
  if (disableVoiceInsertableStreams) return 'bypassed-plain-voice-transport';
  return bypassMode;
}

export async function applySenderPreferences(sender, {
  maxBitrate = null,
  maxFramerate = null,
  priority = null,
  networkPriority = null,
  degradationPreference = null,
  scaleResolutionDownBy = null,
  scalabilityMode = null,
} = {}) {
  if (!sender?.getParameters || !sender?.setParameters) {
    return null;
  }

  const parameters = sender.getParameters() || {};
  if (degradationPreference) {
    parameters.degradationPreference = degradationPreference;
  }

  const nextEncodings = Array.isArray(parameters.encodings) && parameters.encodings.length > 0
    ? parameters.encodings
    : [{}];

  parameters.encodings = nextEncodings.map((encoding) => {
    const nextEncoding = { ...encoding };
    if (typeof maxBitrate === 'number') nextEncoding.maxBitrate = maxBitrate;
    if (typeof maxFramerate === 'number') nextEncoding.maxFramerate = maxFramerate;
    if (typeof scaleResolutionDownBy === 'number') nextEncoding.scaleResolutionDownBy = scaleResolutionDownBy;
    if (priority) nextEncoding.priority = priority;
    if (networkPriority) nextEncoding.networkPriority = networkPriority;
    if (scalabilityMode) nextEncoding.scalabilityMode = scalabilityMode;
    return nextEncoding;
  });

  await sender.setParameters(parameters);
  return parameters;
}

export function normalizeVoiceErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error.trim();
  return String(error?.message || error?.name || error).trim();
}

export function isExpectedVoiceTeardownError(error) {
  const normalized = normalizeVoiceErrorMessage(error).toLowerCase();
  if (!normalized) return false;

  return normalized === 'closed'
    || normalized === 'transport closed'
    || normalized === 'connection closed'
    || normalized === 'producer closed'
    || normalized === 'consumer closed'
    || normalized.endsWith(': closed')
    || normalized.includes('awaitqueuestoppederror')
    || normalized.includes('transport closed')
    || normalized.includes('connection closed');
}

export function withTimeout(
  promise,
  timeoutMs,
  message,
  {
    setTimeoutFn = globalThis.setTimeout.bind(globalThis),
    clearTimeoutFn = globalThis.clearTimeout.bind(globalThis),
  } = {}
) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeoutFn(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeoutFn(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeoutFn(timeoutId);
        reject(error);
      }
    );
  });
}

export function buildPlaybackErrorMessage(error) {
  if (!error) return 'Playback failed';
  return error?.message || error?.name || String(error);
}
