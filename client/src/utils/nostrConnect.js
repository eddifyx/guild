/**
 * /guild — NIP-46 Remote Signing (Nostr Connect)
 *
 * Manages the connection to a remote Nostr signer (bunker) via NIP-46.
 * The user's private key (nsec) NEVER touches this app. Instead, a remote
 * signer (Amber, nsec.app, nsecBunker) holds the key and signs on behalf
 * of the app through encrypted relay messages.
 *
 * Uses nostr-tools BunkerSigner which handles the NIP-46 protocol internally.
 */

import { BunkerSigner, parseBunkerInput, createNostrConnectURI } from 'nostr-tools/nip46';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { encrypt as nip04Encrypt } from 'nostr-tools/nip04';
import { nip19 } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils';

const NOSTRCONNECT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nsec.app',
  'wss://nos.lol',
];

// Module state
let _signer = null;
let _clientSecretKey = null;
let _userPubkey = null;
let _nsecKey = null; // raw secret key bytes for nsec login mode
let _loginMode = null; // 'nip46' | 'nsec'

/**
 * Securely erase a Uint8Array from memory.
 */
function zeroKey(key) {
  if (key && typeof key.fill === 'function') {
    key.fill(0);
  }
}

/**
 * Connect to a remote signer via NIP-46.
 *
 * @param {string} bunkerInput — bunker:// URI or NIP-05 identifier (user@domain.com)
 * @returns {Promise<{ npub: string, pubkey: string }>}
 */
export async function connectWithBunkerURI(bunkerInput) {
  // Disconnect any existing signer
  if (_signer) {
    try { await _signer.close(); } catch {}
    _signer = null;
  }
  zeroKey(_clientSecretKey);
  _clientSecretKey = null;

  // 1. Parse the bunker input (supports bunker:// URIs and NIP-05 identifiers)
  const bunkerPointer = await parseBunkerInput(bunkerInput);
  if (!bunkerPointer) {
    throw new Error('Invalid bunker URI or NIP-05 identifier');
  }

  // 2. Generate ephemeral client secret key for this connection
  _clientSecretKey = generateSecretKey();

  // 3. Create BunkerSigner and connect
  _signer = BunkerSigner.fromBunker(_clientSecretKey, bunkerPointer);
  await _signer.connect();

  // 4. Get the user's public key from the remote signer
  _userPubkey = await _signer.getPublicKey();

  // 5. Persist bunker pointer + client SK for session resumption
  _loginMode = 'nip46';
  await _persistSession(bunkerPointer);

  const npub = nip19.npubEncode(_userPubkey);
  return { npub, pubkey: _userPubkey };
}

/**
 * Attempt to reconnect to a previously connected signer.
 * Called on app startup for Nostr users.
 *
 * @returns {Promise<boolean>} true if reconnected successfully
 */
export async function reconnect() {
  // Try nsec session first (faster — no relay needed)
  const nsecData = await loadNsec();
  if (nsecData) {
    _nsecKey = nsecData.secretKey;
    _userPubkey = nsecData.pubkey;
    _loginMode = 'nsec';
    return true;
  }

  // Try NIP-46 bunker session
  const session = await _loadSession();
  if (!session) return false;

  try {
    _clientSecretKey = session.clientSecretKey;
    _signer = BunkerSigner.fromBunker(_clientSecretKey, session.bunkerPointer);
    await _signer.connect();
    _userPubkey = await _signer.getPublicKey();
    _loginMode = 'nip46';
    return true;
  } catch (err) {
    console.warn('[NIP-46] Reconnect failed:', err.message);
    _signer = null;
    zeroKey(_clientSecretKey);
    _clientSecretKey = null;
    _userPubkey = null;
    return false;
  }
}

/**
 * Get the current signer instance (BunkerSigner or nsec-based).
 * @returns {object|null}
 */
export function getSigner() {
  if (_loginMode === 'nsec' && _nsecKey) {
    return getNsecSigner(_nsecKey);
  }
  return _signer;
}

/**
 * Get the connected user's public key (hex).
 * @returns {string|null}
 */
export function getUserPubkey() {
  return _userPubkey;
}

/**
 * Check if a signer is currently connected.
 * @returns {boolean}
 */
export function isConnected() {
  return _userPubkey !== null && (_signer !== null || _nsecKey !== null);
}

/**
 * Generate a nostrconnect:// URI and wait for a remote signer to connect.
 *
 * @param {AbortSignal} [abortSignal] — signal to cancel waiting
 * @returns {{ uri: string, waitForConnection: () => Promise<{ npub: string, pubkey: string }> }}
 */
export function createNostrConnectSession(abortSignal) {
  // Clean up any existing signer
  if (_signer) {
    try { _signer.close(); } catch {}
    _signer = null;
  }
  zeroKey(_clientSecretKey);

  // Generate ephemeral keypair for this connection
  _clientSecretKey = generateSecretKey();
  const clientPubkey = getPublicKey(_clientSecretKey);
  const secret = bytesToHex(generateSecretKey());

  const uri = createNostrConnectURI({
    clientPubkey,
    relays: NOSTRCONNECT_RELAYS,
    secret,
    name: '/guild',
  });

  const waitForConnection = async () => {
    _signer = await BunkerSigner.fromURI(
      _clientSecretKey,
      uri,
      {},
      abortSignal || 300000, // 5 min timeout
    );
    _userPubkey = await _signer.getPublicKey();
    _loginMode = 'nip46';

    // Persist session for reconnection
    await _persistSession({
      pubkey: _userPubkey,
      relays: NOSTRCONNECT_RELAYS,
      secret,
    });

    const npub = nip19.npubEncode(_userPubkey);
    return { npub, pubkey: _userPubkey };
  };

  return { uri, waitForConnection };
}

/**
 * Sign a Nostr event directly with a local nsec (no NIP-46).
 *
 * @param {Uint8Array} secretKey — raw 32-byte secret key
 * @param {object} eventTemplate — unsigned event fields
 * @returns {object} — signed event with id, sig, pubkey
 */
export function signWithNsec(secretKey, eventTemplate) {
  return finalizeEvent(eventTemplate, secretKey);
}

/**
 * Decode an nsec string and store it encrypted via safeStorage.
 *
 * @param {string} nsecStr — bech32 nsec1... string
 * @returns {{ secretKey: Uint8Array, pubkey: string, npub: string }}
 */
export function decodeNsec(nsecStr) {
  const decoded = nip19.decode(nsecStr);
  if (decoded.type !== 'nsec') {
    throw new Error('Invalid nsec — expected nsec1... format');
  }
  const secretKey = decoded.data;
  const pubkey = getPublicKey(secretKey);
  const npub = nip19.npubEncode(pubkey);
  return { secretKey, pubkey, npub };
}

/**
 * Immediately activate nsec signer in module state.
 * Called during login so the signer is available without waiting for reconnect().
 */
export function activateNsec(secretKey) {
  _nsecKey = secretKey;
  _userPubkey = getPublicKey(secretKey);
  _loginMode = 'nsec';
}

/**
 * Persist nsec encrypted via Electron safeStorage.
 */
export async function persistNsec(nsecStr) {
  if (window.electronCrypto && await window.electronCrypto.isEncryptionAvailable()) {
    const encrypted = await window.electronCrypto.encryptString(nsecStr);
    localStorage.setItem('nostr_nsec_enc', encrypted);
  } else {
    console.warn('[nsec] Electron safeStorage unavailable — nsec will not persist');
  }
}

/**
 * Load and decrypt a stored nsec.
 * @returns {Promise<{ secretKey: Uint8Array, pubkey: string, npub: string } | null>}
 */
export async function loadNsec() {
  try {
    const encrypted = localStorage.getItem('nostr_nsec_enc');
    if (!encrypted || !window.electronCrypto) return null;
    const nsecStr = await window.electronCrypto.decryptString(encrypted);
    if (!nsecStr || !nsecStr.startsWith('nsec1')) return null;
    return decodeNsec(nsecStr);
  } catch (err) {
    console.warn('[nsec] Failed to load stored nsec:', err);
    localStorage.removeItem('nostr_nsec_enc');
    return null;
  }
}

/**
 * Get a fake "signer" that signs with local nsec.
 * Implements the same interface as BunkerSigner for challenge signing.
 */
export function getNsecSigner(secretKey) {
  return {
    signEvent: (template) => Promise.resolve(finalizeEvent(template, secretKey)),
    getPublicKey: () => Promise.resolve(getPublicKey(secretKey)),
    nip04Encrypt: (pubkey, plaintext) => nip04Encrypt(secretKey, pubkey, plaintext),
  };
}

/**
 * Disconnect from the remote signer and clear all session data.
 */
export async function disconnect() {
  if (_signer) {
    try { await _signer.close(); } catch {}
  }
  _signer = null;
  zeroKey(_clientSecretKey);
  _clientSecretKey = null;
  zeroKey(_nsecKey);
  _nsecKey = null;
  _userPubkey = null;
  _loginMode = null;
  _clearSession();
  localStorage.removeItem('nostr_nsec_enc');
}

// ---------------------------------------------------------------------------
// Session persistence (encrypted via Electron safeStorage)
// ---------------------------------------------------------------------------

async function _persistSession(bunkerPointer) {
  const sessionData = JSON.stringify({
    bunkerPointer,
    clientSecretKey: Array.from(_clientSecretKey),
  });

  if (window.electronCrypto && await window.electronCrypto.isEncryptionAvailable()) {
    const encrypted = await window.electronCrypto.encryptString(sessionData);
    localStorage.setItem('nostr_nip46_session_enc', encrypted);
    localStorage.removeItem('nostr_nip46_session');
  } else {
    // No safeStorage — cannot persist session securely. User will need to
    // re-enter bunker URI on next app launch.
    console.warn('[NIP-46] Electron safeStorage unavailable — session will not persist across restarts');
  }
}

async function _loadSession() {
  try {
    // Try encrypted storage
    const encrypted = localStorage.getItem('nostr_nip46_session_enc');
    if (encrypted && window.electronCrypto) {
      const decrypted = await window.electronCrypto.decryptString(encrypted);
      const parsed = JSON.parse(decrypted);

      // Validate session structure
      if (!parsed.bunkerPointer || !parsed.bunkerPointer.pubkey ||
          !Array.isArray(parsed.bunkerPointer.relays) ||
          !Array.isArray(parsed.clientSecretKey) || parsed.clientSecretKey.length !== 32) {
        console.warn('[NIP-46] Stored session has invalid format, discarding');
        _clearSession();
        return null;
      }

      return {
        bunkerPointer: parsed.bunkerPointer,
        clientSecretKey: new Uint8Array(parsed.clientSecretKey),
      };
    }
  } catch (err) {
    console.warn('[NIP-46] Failed to load session:', err);
    _clearSession();
  }
  return null;
}

function _clearSession() {
  localStorage.removeItem('nostr_nip46_session_enc');
  localStorage.removeItem('nostr_nip46_session');
}
