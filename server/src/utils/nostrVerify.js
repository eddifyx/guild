/**
 * Nostr Event Verification
 *
 * Verifies NIP-01 event structure and Schnorr signatures for
 * challenge-response authentication. Uses @noble/curves and
 * @noble/hashes directly — no nostr-tools dependency on server.
 */

const { schnorr } = require('@noble/curves/secp256k1');
const { sha256 } = require('@noble/hashes/sha256');
const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');
let cachedBech32 = null;
async function getBech32() {
  if (cachedBech32) return cachedBech32;
  const mod = await import('@scure/base');
  cachedBech32 = mod.bech32;
  return cachedBech32;
}

/**
 * Verify a Nostr event's ID and Schnorr signature per NIP-01.
 *
 * @param {object} event — { id, pubkey, created_at, kind, tags, content, sig }
 * @returns {boolean}
 */
function verifyNostrEvent(event) {
  if (!event || typeof event !== 'object') return false;

  // Validate required fields
  if (typeof event.id !== 'string' || event.id.length !== 64) return false;
  if (typeof event.pubkey !== 'string' || event.pubkey.length !== 64) return false;
  if (typeof event.sig !== 'string' || event.sig.length !== 128) return false;
  if (!Number.isInteger(event.created_at)) return false;
  if (!Number.isInteger(event.kind)) return false;
  if (!Array.isArray(event.tags)) return false;
  if (typeof event.content !== 'string') return false;

  try {
    // 1. Compute event ID per NIP-01: sha256(JSON.stringify([0, pubkey, created_at, kind, tags, content]))
    const serialized = JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content,
    ]);
    const hash = sha256(new TextEncoder().encode(serialized));
    const expectedId = bytesToHex(hash);

    if (event.id !== expectedId) return false;

    // 2. Verify Schnorr signature over the event ID
    return schnorr.verify(event.sig, event.id, event.pubkey);
  } catch {
    return false;
  }
}

/**
 * Encode a hex pubkey as a bech32 npub (NIP-19).
 *
 * @param {string} pubkeyHex — 64-char hex public key
 * @returns {string} npub1...
 */
async function pubkeyToNpub(pubkeyHex) {
  const bech32 = await getBech32();
  const data = hexToBytes(pubkeyHex);
  const words = bech32.toWords(data);
  return bech32.encode('npub', words, 90);
}

/**
 * Decode a bech32 npub to a hex pubkey.
 *
 * @param {string} npub — npub1...
 * @returns {string} 64-char hex public key
 */
async function npubToPubkey(npub) {
  const bech32 = await getBech32();
  const { prefix, words } = bech32.decode(npub, 90);
  if (prefix !== 'npub') throw new Error('Invalid npub prefix');
  return bytesToHex(bech32.fromWords(words));
}

module.exports = { verifyNostrEvent, pubkeyToNpub, npubToPubkey };
