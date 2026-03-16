import pcmBridgeWorkletPath from '../audio-worklets/pcmBridge.worklet.js?url';

const registeredContexts = new WeakSet();

export const APPLE_VOICE_CAPTURE_OWNERS = {
  LIVE_VOICE: 'live-voice',
  MIC_TEST: 'mic-test',
};

function unwrapElectronInvokeError(message) {
  const raw = String(message || '').trim();
  if (!raw) {
    return '';
  }

  const remoteInvokePrefix = /^Error invoking remote method '[^']+':\s*/i;
  const withoutInvokePrefix = raw.replace(remoteInvokePrefix, '');
  return withoutInvokePrefix.replace(/^Error:\s*/i, '').trim();
}

export function shouldDisableAppleVoiceForSession(message) {
  const normalized = unwrapElectronInvokeError(message).toLowerCase();
  return normalized.includes('could not initialize the audio unit')
    || normalized.includes('could not create the audio unit')
    || normalized.includes('could not configure')
    || normalized.includes('voiceprocessingio is unavailable')
    || normalized.includes('apple voice processing is unavailable');
}

export function getFriendlyAppleVoiceFallbackMessage(message) {
  const normalized = unwrapElectronInvokeError(message);
  const lowered = normalized.toLowerCase();

  if (lowered.includes('microphone permission')) {
    return 'Microphone access is needed before Mac voice cleanup can turn on. Using standard cleanup instead.';
  }

  if (lowered.includes('took too long to start')) {
    return 'Mac voice cleanup was not ready in time. Using standard cleanup instead.';
  }

  if (lowered.includes('microphone audio never arrived')) {
    return 'Mac voice cleanup did not receive microphone audio in time. Using standard cleanup instead.';
  }

  if (
    lowered.includes('stopped unexpectedly')
    || lowered.includes('exited unexpectedly')
    || shouldDisableAppleVoiceForSession(lowered)
    || lowered.includes('audio unit')
    || lowered.includes('osstatus')
    || lowered.includes('apple-voice-capture-start')
  ) {
    return 'Mac voice cleanup is unavailable right now. Using standard cleanup instead.';
  }

  return normalized || 'Mac voice cleanup is unavailable right now. Using standard cleanup instead.';
}

async function ensurePcmBridgeWorklet(audioContext) {
  if (registeredContexts.has(audioContext)) {
    return;
  }

  await audioContext.audioWorklet.addModule(pcmBridgeWorkletPath);
  registeredContexts.add(audioContext);
}

export async function createApplePcmBridgeNode(audioContext) {
  await ensurePcmBridgeWorklet(audioContext);

  return new AudioWorkletNode(audioContext, 'apple-pcm-bridge', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
}

export function normalizeElectronBinaryChunk(chunk) {
  if (!chunk) {
    return null;
  }

  if (chunk instanceof ArrayBuffer) {
    return chunk;
  }

  if (ArrayBuffer.isView(chunk)) {
    return chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
  }

  if (chunk?.type === 'Buffer' && Array.isArray(chunk.data)) {
    return Uint8Array.from(chunk.data).buffer;
  }

  if (Array.isArray(chunk)) {
    return Uint8Array.from(chunk).buffer;
  }

  return null;
}
