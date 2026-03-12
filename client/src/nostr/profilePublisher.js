/**
 * /guild — Nostr Profile Publisher
 *
 * Build, sign, and publish kind:0 (metadata) events to public Nostr relays.
 * This allows users to set their Nostr identity (name, bio, picture) from
 * within /guild, visible in any Nostr client (Primal, Damus, etc.).
 */

import { SimplePool } from 'nostr-tools/pool';
import { getSigner, getUserPubkey } from '../utils/nostrConnect';
import { fetchProfile } from '../utils/nostr';

const PUBLISH_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
];

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

  let encrypted;
  try {
    encrypted = await signer.nip04Encrypt(recipientPubkeyHex, content);
  } catch (err) {
    return { ok: false, error: 'Encryption failed: ' + err.message };
  }

  const eventTemplate = {
    kind: 4,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['p', recipientPubkeyHex]],
    content: encrypted,
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
 * Upload an image to nostr.build.
 *
 * @param {File} file — image file
 * @returns {Promise<string>} — URL of the uploaded image
 */
export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('https://nostr.build/api/v2/upload/files', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) throw new Error('Upload failed');

  const data = await res.json();
  // nostr.build returns { status: 'success', data: [{ url: '...' }] }
  if (data.status === 'success' && data.data?.[0]?.url) {
    return data.data[0].url;
  }
  throw new Error('Upload returned unexpected response');
}
