export function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function describeSignerError(err, fallback = 'Unknown signer error') {
  if (typeof err === 'string' && err.trim()) return err;
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object') {
    if (typeof err.message === 'string' && err.message.trim()) return err.message;
    if (typeof err.error === 'string' && err.error.trim()) return err.error;
    if (typeof err.reason === 'string' && err.reason.trim()) return err.reason;
    try {
      const serialized = JSON.stringify(err);
      if (serialized && serialized !== '{}') return serialized;
    } catch {}
  }
  return fallback;
}

export function isMissingNip04Capability(errorText = '') {
  const normalized = String(errorText || '').toLowerCase();
  return normalized.includes('no nip04_encrypt_method')
    || normalized.includes('nip04')
    || normalized.includes('unsupported method');
}

export function toBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function buildProfileMetadataContent(profile = {}) {
  return JSON.stringify({
    name: (profile.name || '').slice(0, 50),
    about: (profile.about || '').slice(0, 250),
    picture: profile.picture || '',
    banner: profile.banner || '',
    lud16: profile.lud16 || '',
  });
}

export function buildProfileEventTemplate(profile = {}, nowMs = Date.now(), pubkey = null) {
  return {
    kind: 0,
    created_at: Math.floor(nowMs / 1000),
    tags: [],
    content: buildProfileMetadataContent(profile),
    ...(pubkey ? { pubkey } : {}),
  };
}

export function buildNoteEventTemplate(content = '', nowMs = Date.now(), pubkey = null) {
  return {
    kind: 1,
    created_at: Math.floor(nowMs / 1000),
    tags: [],
    content: String(content || '').slice(0, 1000),
    ...(pubkey ? { pubkey } : {}),
  };
}

export function buildGiftWrapUnavailableMessage({ loginMode = '', giftWrapError = '' } = {}) {
  if (loginMode === 'nip46') {
    return `This signer session cannot send encrypted Nostr DMs yet (${giftWrapError}). Reconnect your signer and approve modern DM permissions, or use the invite code tab.`;
  }
  return `Encrypted Nostr DMs are unavailable in this signer session (${giftWrapError}). Use the invite code tab instead.`;
}
