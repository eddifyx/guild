/**
 * /guild — Nostr Profile Publisher
 *
 * Build, sign, and publish kind:0 (metadata) events to public Nostr relays.
 * This allows users to set their Nostr identity (name, bio, picture) from
 * within /guild, visible in any Nostr client (Primal, Damus, etc.).
 */

import { getEventHash } from 'nostr-tools';
import { createWrap } from 'nostr-tools/nip59';
import { SimplePool } from 'nostr-tools/pool';
import { getLoginMode, getSigner, getUserPubkey } from '../utils/nostrConnect';
import { fetchProfile } from '../utils/nostr';

const PUBLISH_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
];
const BLOSSOM_SERVER = 'https://blossom.nostr.build';

function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function describeSignerError(err, fallback = 'Unknown signer error') {
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

function isMissingNip04Capability(errorText = '') {
  const normalized = String(errorText || '').toLowerCase();
  return normalized.includes('no nip04_encrypt_method')
    || normalized.includes('nip04')
    || normalized.includes('unsupported method');
}

async function publishEvent(pool, event) {
  await Promise.any(pool.publish(PUBLISH_RELAYS, event));
}

async function publishLegacyDM({ signer, recipientPubkeyHex, content }) {
  const encrypted = await signer.nip04Encrypt(recipientPubkeyHex, content);

  const signedEvent = await signer.signEvent({
    kind: 4,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['p', recipientPubkeyHex]],
    content: encrypted,
  });

  const pool = new SimplePool();
  try {
    await publishEvent(pool, signedEvent);
    return { ok: true };
  } finally {
    pool.close(PUBLISH_RELAYS);
  }
}

async function publishGiftWrappedDM({ signer, senderPubkeyHex, recipientPubkeyHex, content }) {
  if (typeof signer.nip44Encrypt !== 'function') {
    throw new Error('no nip44_encrypt_method');
  }

  const rumorTemplate = {
    kind: 14,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['p', recipientPubkeyHex]],
    content,
    pubkey: senderPubkeyHex,
  };

  const rumor = {
    ...rumorTemplate,
    id: getEventHash(rumorTemplate),
  };

  const sealForRecipient = await signer.signEvent({
    kind: 13,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: await signer.nip44Encrypt(recipientPubkeyHex, JSON.stringify(rumor)),
  });

  const recipientWrap = createWrap(sealForRecipient, recipientPubkeyHex);

  const pool = new SimplePool();
  try {
    await publishEvent(pool, recipientWrap);

    if (senderPubkeyHex && senderPubkeyHex !== recipientPubkeyHex) {
      try {
        const sealForSender = await signer.signEvent({
          kind: 13,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: await signer.nip44Encrypt(senderPubkeyHex, JSON.stringify(rumor)),
        });

        await publishEvent(pool, createWrap(sealForSender, senderPubkeyHex));
      } catch {
        // Sender copy is best-effort; recipient delivery is the important part.
      }
    }

    return { ok: true };
  } finally {
    pool.close(PUBLISH_RELAYS);
  }
}

function toBase64Url(value) {
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

async function signBlossomAuthEvent({ action, sha256, content }) {
  const signer = getSigner();
  const pubkey = getUserPubkey();
  if (!signer || !pubkey) {
    throw new Error('Signer not available — please re-login');
  }

  const expiresAt = Math.floor(Date.now() / 1000) + (5 * 60);
  const signedEvent = await signer.signEvent({
    kind: 24242,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['t', action],
      ['x', sha256],
      ['expiration', String(expiresAt)],
      ['server', 'blossom.nostr.build'],
    ],
    content,
  });

  return `Nostr ${toBase64Url(JSON.stringify(signedEvent))}`;
}

async function parseBlossomError(res) {
  const text = await res.text().catch(() => '');
  if (!text) {
    return `Upload failed (${res.status})`;
  }

  try {
    const data = JSON.parse(text);
    return data.error || data.message || text;
  } catch {
    return text;
  }
}

/**
 * Fetch the user's existing kind:0 profile from relays.
 * Returns the full profile content object or null.
 * @param {string} [fallbackPubkey] — hex pubkey to use if signer isn't ready
 */
export async function fetchCurrentProfile(fallbackPubkey) {
  const pubkey = getUserPubkey() || fallbackPubkey;
  if (!pubkey) return null;

  const pool = new SimplePool();
  try {
    const event = await pool.get(PUBLISH_RELAYS, {
      kinds: [0],
      authors: [pubkey],
    });
    if (!event) return null;
    return JSON.parse(event.content);
  } catch {
    return null;
  } finally {
    pool.close(PUBLISH_RELAYS);
  }
}

/**
 * Build and publish a kind:0 metadata event.
 *
 * @param {object} profile — { name, about, picture, banner, lud16 }
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function publishProfile(profile) {
  const signer = getSigner();
  const pubkey = getUserPubkey();
  if (!signer || !pubkey) {
    return { ok: false, error: 'Signer not available — please re-login' };
  }

  // Build kind:0 content
  const content = JSON.stringify({
    name: (profile.name || '').slice(0, 50),
    about: (profile.about || '').slice(0, 250),
    picture: profile.picture || '',
    banner: profile.banner || '',
    lud16: profile.lud16 || '',
  });

  // Build unsigned event
  const eventTemplate = {
    kind: 0,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content,
  };

  // Sign the event
  let signedEvent;
  try {
    signedEvent = await signer.signEvent(eventTemplate);
  } catch (err) {
    return { ok: false, error: 'Failed to sign event: ' + err.message };
  }

  // Publish to relays
  const pool = new SimplePool();
  try {
    await Promise.any(
      pool.publish(PUBLISH_RELAYS, signedEvent)
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Failed to publish to relays' };
  } finally {
    pool.close(PUBLISH_RELAYS);
  }
}

/**
 * Build and publish a kind:1 text note.
 *
 * @param {string} content — the note text
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function publishNote(content) {
  const signer = getSigner();
  const pubkey = getUserPubkey();
  if (!signer || !pubkey) {
    return { ok: false, error: 'Signer not available — please re-login' };
  }

  const eventTemplate = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: content.slice(0, 1000),
  };

  let signedEvent;
  try {
    signedEvent = await signer.signEvent(eventTemplate);
  } catch (err) {
    return { ok: false, error: 'Failed to sign: ' + err.message };
  }

  const pool = new SimplePool();
  try {
    await Promise.any(
      pool.publish(PUBLISH_RELAYS, signedEvent)
    );
    return { ok: true };
  } catch {
    return { ok: false, error: 'Failed to publish to relays' };
  } finally {
    pool.close(PUBLISH_RELAYS);
  }
}

/**
 * Send an encrypted NIP-04 direct message to another Nostr user.
 *
 * @param {string} recipientPubkeyHex — hex pubkey of the recipient
 * @param {string} content — plaintext message
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function publishDM(recipientPubkeyHex, content) {
  const signer = getSigner();
  const pubkey = getUserPubkey();
  if (!signer || !pubkey) {
    return { ok: false, error: 'Signer not available — please re-login' };
  }

  let legacyError = null;
  try {
    if (typeof signer.nip04Encrypt === 'function') {
      return await publishLegacyDM({ signer, recipientPubkeyHex, content });
    }
    legacyError = getLoginMode() === 'nip46'
      ? 'no nip04_encrypt_method'
      : 'legacy_nip04_unavailable';
  } catch (err) {
    legacyError = describeSignerError(
      err,
      getLoginMode() === 'nip46'
        ? 'the connected signer did not complete the NIP-04 encryption request'
        : 'the signer could not encrypt the DM'
    );
  }

  if (!isMissingNip04Capability(legacyError)) {
    return { ok: false, error: `Encryption failed: ${legacyError}` };
  }

  try {
    return await publishGiftWrappedDM({
      signer,
      senderPubkeyHex: pubkey,
      recipientPubkeyHex,
      content,
    });
  } catch (err) {
    const giftWrapError = describeSignerError(err, 'modern DM delivery failed');
    if (getLoginMode() === 'nip46') {
      return {
        ok: false,
        error: `This signer session cannot send encrypted Nostr DMs yet (${giftWrapError}). Reconnect your signer and approve modern DM permissions, or use the invite code tab.`,
      };
    }
    return {
      ok: false,
      error: `Encrypted Nostr DMs are unavailable in this signer session (${giftWrapError}). Use the invite code tab instead.`,
    };
  }
}

/**
 * Upload an image to Nostr.build's Blossom server.
 *
 * @param {File} file — image file
 * @returns {Promise<string>} — URL of the uploaded image
 */
export async function uploadImage(file) {
  const sha256 = bytesToHex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
  const authorization = await signBlossomAuthEvent({
    action: 'media',
    sha256,
    content: 'Upload profile image',
  });

  const res = await fetch(`${BLOSSOM_SERVER}/media`, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'Content-Type': file.type || 'application/octet-stream',
      'X-SHA-256': sha256,
    },
    body: file,
  });

  if (!res.ok) {
    throw new Error(await parseBlossomError(res));
  }

  const descriptor = await res.json().catch(() => null);
  if (descriptor?.url) {
    return descriptor.url;
  }

  throw new Error('Upload returned an unexpected response');
}
