import { aes256GcmDecrypt, aes256GcmEncrypt } from '../../crypto/primitives.js';

const DEFAULT_UNENCRYPTED_HEADER_BYTES = 1;
const CODEC_UNENCRYPTED_HEADER_BYTES = {
  'audio/opus': 1,
  'video/vp8': 10,
  'video/vp9': 10,
  'video/h264': 5,
  'video/av1': 16,
};

export function normalizeCodecMimeType(codecMimeType) {
  return String(codecMimeType || '').trim().toLowerCase();
}

export function inferVoiceFrameKind(codecMimeType, options = {}) {
  if (options.kind === 'audio' || options.kind === 'video') {
    return options.kind;
  }

  if (codecMimeType.startsWith('audio/')) return 'audio';
  if (codecMimeType.startsWith('video/')) return 'video';
  return null;
}

export function getVoiceFrameMetadata(frame) {
  try {
    return frame?.getMetadata?.() || {};
  } catch {
    return {};
  }
}

export function readAv1Leb128(data, offset) {
  let value = 0;
  let shift = 0;
  let length = 0;

  while (offset + length < data.length && length < 8) {
    const byte = data[offset + length];
    value |= (byte & 0x7f) << shift;
    length += 1;
    if ((byte & 0x80) === 0) {
      return { value, length };
    }
    shift += 7;
  }

  return { value: 0, length: 0 };
}

export function stripAv1TemporalDelimiterObus(data) {
  let offset = 0;

  while (offset < data.length) {
    const obuHeader = data[offset];
    const obuType = (obuHeader >> 3) & 0x0f;
    const hasExtension = (obuHeader & 0x04) !== 0;
    const hasSizeField = (obuHeader & 0x02) !== 0;
    let cursor = offset + 1 + (hasExtension ? 1 : 0);

    if (!hasSizeField || cursor >= data.length) {
      break;
    }

    const { value: payloadSize, length: leb128Length } = readAv1Leb128(data, cursor);
    if (!leb128Length) {
      break;
    }
    cursor += leb128Length;

    const obuLength = cursor - offset + payloadSize;
    if (obuType !== 2 || obuLength <= 0 || offset + obuLength > data.length) {
      break;
    }

    offset += obuLength;
  }

  return offset > 0 ? data.slice(offset) : data;
}

export function normalizeVoiceFrameDataForEncryption(data, frame, options = {}) {
  const metadata = getVoiceFrameMetadata(frame);
  const codecMimeType = normalizeCodecMimeType(metadata.mimeType || options.codecMimeType);
  if (codecMimeType === 'video/av1') {
    return stripAv1TemporalDelimiterObus(data);
  }
  return data;
}

export function getVoiceUnencryptedHeaderBytes(frame, options = {}, dataLengthOverride = null) {
  const dataLength = Number.isInteger(dataLengthOverride)
    ? dataLengthOverride
    : (frame?.data?.byteLength ?? 0);
  if (!dataLength) {
    return 0;
  }

  const metadata = getVoiceFrameMetadata(frame);
  const codecMimeType = normalizeCodecMimeType(metadata.mimeType || options.codecMimeType);
  const codecHeaderBytes = CODEC_UNENCRYPTED_HEADER_BYTES[codecMimeType];
  if (Number.isInteger(codecHeaderBytes) && codecHeaderBytes > 0) {
    return Math.min(codecHeaderBytes, dataLength);
  }

  const kind = inferVoiceFrameKind(codecMimeType, options);
  if (kind === 'video') {
    return Math.min(CODEC_UNENCRYPTED_HEADER_BYTES['video/vp8'], dataLength);
  }

  return Math.min(DEFAULT_UNENCRYPTED_HEADER_BYTES, dataLength);
}

export function shouldFailOpenVoiceAudio({ frame, options = {}, failOpenAudio = false }) {
  if (!failOpenAudio) return false;
  const metadata = getVoiceFrameMetadata(frame);
  const codecMimeType = normalizeCodecMimeType(metadata.mimeType || options.codecMimeType);
  return inferVoiceFrameKind(codecMimeType, options) === 'audio';
}

export function buildVoiceFrameAad(channelId, epoch) {
  return new TextEncoder().encode(`${channelId}:${epoch}`);
}

export function selectVoiceFrameDecryptionState({
  frameEpoch,
  currentKey,
  currentEpoch,
  previousKey,
  previousEpoch,
}) {
  if (frameEpoch === currentEpoch) {
    return {
      key: currentKey,
      epoch: currentEpoch,
      shouldRetryPreviousKey: false,
    };
  }

  if (previousKey && frameEpoch === previousEpoch) {
    return {
      key: previousKey,
      epoch: previousEpoch,
      shouldRetryPreviousKey: false,
    };
  }

  return {
    key: currentKey,
    epoch: currentEpoch,
    shouldRetryPreviousKey: Boolean(previousKey) && frameEpoch !== currentEpoch,
  };
}

function rebuildVoiceFrame(header, payload) {
  const rebuilt = new Uint8Array(header.length + payload.length);
  rebuilt.set(header, 0);
  rebuilt.set(payload, header.length);
  return rebuilt;
}

export function encryptVoiceFrameData({
  frameData,
  frame,
  options = {},
  key,
  epoch,
  channelId,
}) {
  const originalData = new Uint8Array(frameData);
  const data = normalizeVoiceFrameDataForEncryption(originalData, frame, options);
  if (data.length === 0) {
    return null;
  }

  const unencryptedHeaderBytes = getVoiceUnencryptedHeaderBytes(frame, options, data.length);
  const header = data.slice(0, unencryptedHeaderBytes);
  const payload = data.slice(unencryptedHeaderBytes);

  const epochBytes = new Uint8Array(2);
  epochBytes[0] = epoch & 0xff;
  epochBytes[1] = (epoch >> 8) & 0xff;

  const aad = buildVoiceFrameAad(channelId, epoch);
  const { ciphertext, nonce } = aes256GcmEncrypt(key, payload, aad);
  const encrypted = new Uint8Array(header.length + 2 + 12 + ciphertext.length);
  encrypted.set(header, 0);
  encrypted.set(epochBytes, header.length);
  encrypted.set(nonce, header.length + 2);
  encrypted.set(ciphertext, header.length + 14);
  return encrypted;
}

export function decryptVoiceFrameData({
  frameData,
  frame,
  options = {},
  channelId,
  currentKey,
  currentEpoch,
  previousKey,
  previousEpoch,
}) {
  const data = new Uint8Array(frameData);
  if (data.length < 32) {
    return null;
  }

  const unencryptedHeaderBytes = getVoiceUnencryptedHeaderBytes(frame, options, data.length);
  const header = data.slice(0, unencryptedHeaderBytes);
  const frameEpoch = data[unencryptedHeaderBytes] | (data[unencryptedHeaderBytes + 1] << 8);
  const nonce = data.slice(unencryptedHeaderBytes + 2, unencryptedHeaderBytes + 14);
  const ciphertext = data.slice(unencryptedHeaderBytes + 14);

  const selected = selectVoiceFrameDecryptionState({
    frameEpoch,
    currentKey,
    currentEpoch,
    previousKey,
    previousEpoch,
  });

  try {
    const plaintext = aes256GcmDecrypt(
      selected.key,
      ciphertext,
      nonce,
      buildVoiceFrameAad(channelId, selected.epoch),
    );
    return rebuildVoiceFrame(header, plaintext);
  } catch {
    if (!selected.shouldRetryPreviousKey || !previousKey) {
      return null;
    }

    try {
      const plaintext = aes256GcmDecrypt(
        previousKey,
        ciphertext,
        nonce,
        buildVoiceFrameAad(channelId, previousEpoch),
      );
      return rebuildVoiceFrame(header, plaintext);
    } catch {
      return null;
    }
  }
}
