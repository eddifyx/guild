/**
 * /guild E2E Encryption - Voice Frame Encryption
 *
 * Adds an E2E encryption layer on top of WebRTC's DTLS-SRTP using
 * the Insertable Streams API (RTCRtpScriptTransform).
 *
 * The mediasoup SFU forwards frames it cannot decrypt, making it a
 * true zero-knowledge relay for voice/video data.
 */

import {
  randomBytes,
  toBase64,
  fromBase64,
} from './primitives.js';
import { encryptDirectMessage } from './messageEncryption.js';
import { getCurrentUserId } from './sessionManager.js';
import {
  decryptVoiceFrameData,
  encryptVoiceFrameData,
  shouldFailOpenVoiceAudio,
} from '../features/crypto/voiceFrameRuntime.mjs';
import {
  distributeVoiceKeyRuntime,
  processDecryptedVoiceKeyRuntime,
} from '../features/crypto/voiceKeyDistributionRuntime.mjs';

let _voiceKey = null;
let _voiceChannelId = null;
let _voiceKeyEpoch = 0;
let _voiceChannelParticipants = new Set();

let _prevVoiceKey = null;
let _prevVoiceKeyEpoch = 0;
let _prevKeyTimer = null;
const VOICE_AUDIO_FAIL_OPEN = import.meta.env.VITE_VOICE_AUDIO_FAIL_OPEN === '1';

export function generateVoiceKey({ minEpoch = null } = {}) {
  if (Number.isInteger(minEpoch) && minEpoch > _voiceKeyEpoch) {
    _voiceKeyEpoch = Math.min(65534, Math.max(0, minEpoch - 1));
  }
  if (_voiceKeyEpoch >= 65535) {
    throw new Error('Voice key epoch exhausted. Rejoin the voice channel to reset.');
  }
  _voiceKeyEpoch += 1;
  return {
    key: randomBytes(32),
    epoch: _voiceKeyEpoch,
  };
}

export function setVoiceKey(keyBase64, epoch) {
  if (!Number.isInteger(epoch) || epoch < 0 || epoch > 65535) {
    console.warn(`[Voice] Rejecting voice key with invalid epoch: ${epoch}`);
    return false;
  }
  if (epoch <= _voiceKeyEpoch && _voiceKey !== null) {
    console.warn(`[Voice] Rejecting voice key with stale epoch ${epoch} (current: ${_voiceKeyEpoch})`);
    return false;
  }

  let keyBytes;
  try {
    keyBytes = fromBase64(keyBase64);
  } catch {
    console.warn('[Voice] Rejecting voice key with invalid base64 encoding');
    return false;
  }
  if (keyBytes.length !== 32) {
    console.warn(`[Voice] Rejecting voice key with invalid length ${keyBytes.length} (expected 32)`);
    keyBytes.fill(0);
    return false;
  }

  if (_prevVoiceKey) _prevVoiceKey.fill(0);
  if (_prevKeyTimer) clearTimeout(_prevKeyTimer);
  _prevVoiceKey = _voiceKey;
  _prevVoiceKeyEpoch = _voiceKeyEpoch;
  _prevKeyTimer = setTimeout(() => {
    if (_prevVoiceKey) _prevVoiceKey.fill(0);
    _prevVoiceKey = null;
    _prevKeyTimer = null;
  }, 5000);

  _voiceKey = keyBytes;
  _voiceKeyEpoch = epoch;
  return true;
}

export function getVoiceKey() {
  return _voiceKey ? { key: new Uint8Array(_voiceKey), epoch: _voiceKeyEpoch } : null;
}

export function waitForVoiceKey(channelId, timeoutMs = 5000) {
  const existingKey = getVoiceKey();
  if (existingKey && (!channelId || _voiceChannelId === channelId)) {
    return Promise.resolve(existingKey);
  }

  return new Promise((resolve, reject) => {
    const intervalId = setInterval(() => {
      const nextKey = getVoiceKey();
      if (nextKey && (!channelId || _voiceChannelId === channelId)) {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
        resolve(nextKey);
      }
    }, 100);

    const timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      reject(new Error('Timed out waiting for secure voice key.'));
    }, timeoutMs);
  });
}

export function clearVoiceKey({ preserveChannelState = false } = {}) {
  if (_voiceKey) {
    _voiceKey.fill(0);
    _voiceKey = null;
  }
  if (_prevVoiceKey) {
    _prevVoiceKey.fill(0);
    _prevVoiceKey = null;
  }
  if (_prevKeyTimer) {
    clearTimeout(_prevKeyTimer);
    _prevKeyTimer = null;
  }
  if (!preserveChannelState) {
    _voiceChannelId = null;
    _voiceChannelParticipants.clear();
  }
  _prevVoiceKeyEpoch = 0;
  _voiceKeyEpoch = 0;
}

export function setVoiceChannelId(channelId) {
  _voiceChannelId = channelId;
}

export function setVoiceChannelParticipants(userIds) {
  _voiceChannelParticipants = new Set(Array.isArray(userIds) ? userIds.filter(Boolean) : []);
}

export function addVoiceChannelParticipant(userId) {
  if (userId) {
    _voiceChannelParticipants.add(userId);
  }
}

export function encryptFrame(frame, controller, options = {}) {
  if (!_voiceKey) {
    if (shouldFailOpenVoiceAudio({ frame, options, failOpenAudio: VOICE_AUDIO_FAIL_OPEN })) {
      controller.enqueue(frame);
    }
    return;
  }

  try {
    const encrypted = encryptVoiceFrameData({
      frameData: frame.data,
      frame,
      options,
      key: _voiceKey,
      epoch: _voiceKeyEpoch,
      channelId: _voiceChannelId,
    });
    if (!encrypted) {
      controller.enqueue(frame);
      return;
    }
    frame.data = encrypted.buffer;
    controller.enqueue(frame);
  } catch {
    console.error('[Voice] Frame encryption failed, dropping frame');
  }
}

export function decryptFrame(frame, controller, options = {}) {
  if (!_voiceKey) {
    if (shouldFailOpenVoiceAudio({ frame, options, failOpenAudio: VOICE_AUDIO_FAIL_OPEN })) {
      controller.enqueue(frame);
    }
    return;
  }

  try {
    const decrypted = decryptVoiceFrameData({
      frameData: frame.data,
      frame,
      options,
      channelId: _voiceChannelId,
      currentKey: _voiceKey,
      currentEpoch: _voiceKeyEpoch,
      previousKey: _prevVoiceKey,
      previousEpoch: _prevVoiceKeyEpoch,
    });
    if (!decrypted) {
      return;
    }
    frame.data = decrypted.buffer;
    controller.enqueue(frame);
  } catch {
  }
}

export function isInsertableStreamsSupported() {
  return isSenderInsertableStreamsSupported() && isReceiverInsertableStreamsSupported();
}

export function isSenderInsertableStreamsSupported() {
  return typeof globalThis.RTCRtpSender === 'function'
    && typeof globalThis.RTCRtpSender.prototype?.createEncodedStreams === 'function';
}

export function isReceiverInsertableStreamsSupported() {
  return typeof globalThis.RTCRtpReceiver === 'function'
    && typeof globalThis.RTCRtpReceiver.prototype?.createEncodedStreams === 'function';
}

export function attachSenderEncryption(sender, options = {}) {
  if (!sender) return false;
  if (typeof sender.createEncodedStreams !== 'function') {
    console.warn('[Voice] Sender encryption unavailable for this transport; bypassing transform attach.');
    return false;
  }

  try {
    const { readable, writable } = sender.createEncodedStreams();
    const transform = new TransformStream({
      transform(frame, controller) {
        encryptFrame(frame, controller, options);
      },
    });
    readable.pipeThrough(transform).pipeTo(writable);
    return true;
  } catch (error) {
    console.warn('[Voice] Sender encryption unavailable for this transport; bypassing transform attach.', error);
    return false;
  }
}

export function attachReceiverDecryption(receiver, options = {}) {
  if (!receiver) return false;
  if (typeof receiver.createEncodedStreams !== 'function') {
    console.warn('[Voice] Receiver decryption unavailable for this transport; bypassing transform attach.');
    return false;
  }

  try {
    const { readable, writable } = receiver.createEncodedStreams();
    const transform = new TransformStream({
      transform(frame, controller) {
        decryptFrame(frame, controller, options);
      },
    });
    readable.pipeThrough(transform).pipeTo(writable);
    return true;
  } catch (error) {
    console.warn('[Voice] Receiver decryption unavailable for this transport; bypassing transform attach.', error);
    return false;
  }
}

export async function distributeVoiceKey(channelId, participantUserIds, key, epoch, socket) {
  _voiceChannelId = channelId;
  await distributeVoiceKeyRuntime({
    channelId,
    participantUserIds,
    key,
    epoch,
    socket,
    myUserId: getCurrentUserId(),
    toBase64Fn: toBase64,
    encryptDirectMessageFn: encryptDirectMessage,
  });
}

export async function processDecryptedVoiceKey(fromUserId, payload) {
  return processDecryptedVoiceKeyRuntime({
    fromUserId,
    payload,
    channelId: _voiceChannelId,
    participantUserIds: _voiceChannelParticipants,
    setVoiceKeyFn: setVoiceKey,
  });
}
