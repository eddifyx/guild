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
  aes256GcmEncrypt,
  aes256GcmDecrypt,
  randomBytes,
  toBase64,
  fromBase64,
} from './primitives.js';
import { encryptDirectMessage } from './messageEncryption.js';
import { getCurrentUserId } from './sessionManager.js';

let _voiceKey = null;
let _voiceChannelId = null;
let _voiceKeyEpoch = 0;
let _voiceChannelParticipants = new Set();

let _prevVoiceKey = null;
let _prevVoiceKeyEpoch = 0;
let _prevKeyTimer = null;

function emitVoiceKeyEnvelope(socket, toUserId, envelope) {
  return new Promise((resolve, reject) => {
    socket.emit('dm:sender_key', { toUserId, envelope }, (response) => {
      if (response?.ok) {
        resolve();
        return;
      }
      reject(new Error(response?.error || 'Voice key delivery was rejected by the server.'));
    });
  });
}

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

const UNENCRYPTED_HEADER_BYTES = 1;

export function encryptFrame(frame, controller) {
  if (!_voiceKey) {
    return;
  }

  const data = new Uint8Array(frame.data);
  if (data.length === 0) {
    controller.enqueue(frame);
    return;
  }

  const header = data.slice(0, UNENCRYPTED_HEADER_BYTES);
  const payload = data.slice(UNENCRYPTED_HEADER_BYTES);

  try {
    const epochBytes = new Uint8Array(2);
    epochBytes[0] = _voiceKeyEpoch & 0xff;
    epochBytes[1] = (_voiceKeyEpoch >> 8) & 0xff;

    const aad = new TextEncoder().encode(`${_voiceChannelId}:${_voiceKeyEpoch}`);
    const { ciphertext, nonce } = aes256GcmEncrypt(_voiceKey, payload, aad);

    const encrypted = new Uint8Array(header.length + 2 + 12 + ciphertext.length);
    encrypted.set(header, 0);
    encrypted.set(epochBytes, header.length);
    encrypted.set(nonce, header.length + 2);
    encrypted.set(ciphertext, header.length + 2 + 12);

    frame.data = encrypted.buffer;
    controller.enqueue(frame);
  } catch {
    console.error('[Voice] Frame encryption failed, dropping frame');
  }
}

export function decryptFrame(frame, controller) {
  if (!_voiceKey) {
    return;
  }

  const data = new Uint8Array(frame.data);
  if (data.length < 32) {
    return;
  }

  const header = data.slice(0, UNENCRYPTED_HEADER_BYTES);
  const frameEpoch = data[UNENCRYPTED_HEADER_BYTES] | (data[UNENCRYPTED_HEADER_BYTES + 1] << 8);
  const nonce = data.slice(UNENCRYPTED_HEADER_BYTES + 2, UNENCRYPTED_HEADER_BYTES + 14);
  const ciphertext = data.slice(UNENCRYPTED_HEADER_BYTES + 14);

  let key = null;
  let epoch = frameEpoch;
  if (frameEpoch === _voiceKeyEpoch) {
    key = _voiceKey;
  } else if (_prevVoiceKey && frameEpoch === _prevVoiceKeyEpoch) {
    key = _prevVoiceKey;
  } else {
    key = _voiceKey;
    epoch = _voiceKeyEpoch;
  }

  const aad = new TextEncoder().encode(`${_voiceChannelId}:${epoch}`);

  try {
    const plaintext = aes256GcmDecrypt(key, ciphertext, nonce, aad);
    const decrypted = new Uint8Array(header.length + plaintext.length);
    decrypted.set(header, 0);
    decrypted.set(plaintext, header.length);
    frame.data = decrypted.buffer;
    controller.enqueue(frame);
  } catch {
    if (key === _voiceKey && _prevVoiceKey && frameEpoch !== _voiceKeyEpoch) {
      try {
        const prevAad = new TextEncoder().encode(`${_voiceChannelId}:${_prevVoiceKeyEpoch}`);
        const plaintext = aes256GcmDecrypt(_prevVoiceKey, ciphertext, nonce, prevAad);
        const decrypted = new Uint8Array(header.length + plaintext.length);
        decrypted.set(header, 0);
        decrypted.set(plaintext, header.length);
        frame.data = decrypted.buffer;
        controller.enqueue(frame);
        return;
      } catch {}
    }
  }
}

export function isInsertableStreamsSupported() {
  return typeof RTCRtpScriptTransform !== 'undefined' ||
    (typeof RTCRtpSender !== 'undefined' && 'createEncodedStreams' in RTCRtpSender.prototype);
}

export function attachSenderEncryption(sender) {
  if (!sender) return;
  if ('createEncodedStreams' in sender) {
    const { readable, writable } = sender.createEncodedStreams();
    const transform = new TransformStream({ transform: encryptFrame });
    readable.pipeThrough(transform).pipeTo(writable);
  }
}

export function attachReceiverDecryption(receiver) {
  if (!receiver) return;
  if ('createEncodedStreams' in receiver) {
    const { readable, writable } = receiver.createEncodedStreams();
    const transform = new TransformStream({ transform: decryptFrame });
    readable.pipeThrough(transform).pipeTo(writable);
  }
}

export async function distributeVoiceKey(channelId, participantUserIds, key, epoch, socket) {
  _voiceChannelId = channelId;
  const myUserId = getCurrentUserId();
  const failures = [];

  for (const participantId of participantUserIds) {
    if (participantId === myUserId) continue;

    try {
      const payload = JSON.stringify({
        type: 'voice_key_distribution',
        channelId,
        key: toBase64(key),
        epoch,
      });

      const envelope = await encryptDirectMessage(participantId, payload);
      await emitVoiceKeyEnvelope(socket, participantId, envelope);
    } catch (err) {
      console.error(`Failed to distribute voice key to ${participantId}:`, err);
      failures.push(participantId);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Failed to distribute the secure voice key to ${failures.join(', ')}`);
  }
}

export async function processDecryptedVoiceKey(fromUserId, payload) {
  if (payload.type !== 'voice_key_distribution') return false;

  if (!_voiceChannelId) {
    const err = new Error('Voice key received before the local channel was ready.');
    err.retryable = true;
    throw err;
  }
  if (payload.channelId !== _voiceChannelId) {
    return false;
  }
  if (!_voiceChannelParticipants.has(fromUserId)) {
    const err = new Error('Voice key received before the participant list was ready.');
    err.retryable = true;
    throw err;
  }

  return setVoiceKey(payload.key, payload.epoch);
}
