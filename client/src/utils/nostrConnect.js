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
import { SimplePool } from 'nostr-tools/pool';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { encrypt as nip04Encrypt } from 'nostr-tools/nip04';
import { encrypt as nip44Encrypt, getConversationKey as getNip44ConversationKey } from 'nostr-tools/nip44';
import { nip19 } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils';
import {
  pushNip46Trace,
  redactTraceValue,
  summarizeError,
  summarizeNostrEvent,
} from './nip46Trace';

const NOSTRCONNECT_RELAYS = [
  'wss://nos.lol',
];

const NOSTRCONNECT_PERMS = [
  'get_public_key',
  'ping',
  'sign_event:22242',
  'sign_event:27235',
  'sign_event:1',
  'sign_event:13',
  'nip04_encrypt',
  'nip44_encrypt',
];

const SIGNER_PUBLIC_KEY_TIMEOUT_MS = 15000;
const NIP46_RELAY_COOLDOWN_MS = 500;
const AUTH_CHALLENGE_EVENT = 'nostr-connect-auth-challenge';

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

function emitAuthChallenge(url) {
  if (!url || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_CHALLENGE_EVENT, {
    detail: { url },
  }));
}

function buildSignerParams() {
  return {
    onauth: (url) => {
      pushNip46Trace('signer.onauth', { url }, 'warn');
      console.warn('[NIP-46] Signer requested auth challenge:', url);
      emitAuthChallenge(url);
    },
  };
}

export function getAuthChallengeEventName() {
  return AUTH_CHALLENGE_EVENT;
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForNip46RelayCooldown(stage, delayMs = NIP46_RELAY_COOLDOWN_MS) {
  if (!delayMs || delayMs <= 0) return;
  pushNip46Trace('relay.request.cooldown', {
    stage,
    delayMs,
  });
  await sleep(delayMs);
}

async function resolveSignerPublicKey(signer, {
  source,
  knownPubkey = null,
  timeoutMessage,
}) {
  if (knownPubkey) {
    pushNip46Trace('signer.getPublicKey.skipped', {
      source,
      reason: 'using_known_bunker_pubkey',
      pubkey: redactTraceValue(knownPubkey),
    });
    return knownPubkey;
  }

  return withTimeout(
    signer.getPublicKey(),
    SIGNER_PUBLIC_KEY_TIMEOUT_MS,
    timeoutMessage,
  );
}

function summarizeSignerArgs(methodName, args) {
  switch (methodName) {
    case 'ping':
      return {};
    case 'sendRequest':
      return {
        requestMethod: args[0],
        params: args[1],
      };
    case 'signEvent':
      return { event: summarizeNostrEvent(args[0]) };
    case 'nip04Encrypt':
    case 'nip44Encrypt':
      return {
        peerPubkey: redactTraceValue(args[0]),
        plaintextPreview: redactTraceValue(args[1]),
      };
    default:
      return {};
  }
}

function summarizeSignerResult(methodName, result) {
  switch (methodName) {
    case 'ping':
      return { result };
    case 'sendRequest':
      return {
        result,
      };
    case 'getPublicKey':
      return { pubkey: redactTraceValue(result) };
    case 'signEvent':
      return { signedEvent: summarizeNostrEvent(result) };
    case 'nip04Encrypt':
    case 'nip44Encrypt':
      return {
        ciphertextPreview: typeof result === 'string' ? result : null,
      };
    default:
      return {};
  }
}

function buildTracingPool(source) {
  const pool = new SimplePool({
    onRelayConnectionSuccess: (url) => {
      pushNip46Trace('relay.connection.success', { source, url });
    },
    onRelayConnectionFailure: (url) => {
      pushNip46Trace('relay.connection.failure', { source, url }, 'warn');
    },
    onnotice: (url, message) => {
      pushNip46Trace('relay.notice', {
        source,
        url,
        message,
      }, 'warn');
    },
  });

  const originalSubscribe = pool.subscribe.bind(pool);
  pool.subscribe = (relays, filter, params = {}, ...rest) => {
    const tracedFilter = {
      kinds: filter?.kinds || [],
      authors: filter?.authors || [],
      p: filter?.['#p'] || [],
    };

    return originalSubscribe(
      relays,
      filter,
      {
        ...params,
        onevent: (event) => {
          pushNip46Trace('relay.subscription.event', {
            source,
            relays,
            filter: tracedFilter,
            event: {
              kind: event?.kind,
              created_at: event?.created_at,
              pubkey: redactTraceValue(event?.pubkey),
              tags: Array.isArray(event?.tags) ? event.tags : [],
              contentLength: typeof event?.content === 'string' ? event.content.length : null,
            },
          });

          if (typeof params.onevent === 'function') {
            try {
              return params.onevent(event);
            } catch (error) {
              pushNip46Trace('relay.subscription.event_handler_error', {
                source,
                relays,
                filter: tracedFilter,
                error: summarizeError(error),
              }, 'error');
              throw error;
            }
          }

          return undefined;
        },
        onclose: (reason) => {
          pushNip46Trace('relay.subscription.closed', {
            source,
            relays,
            filter: tracedFilter,
            reason: reason || null,
          }, 'warn');

          if (typeof params.onclose === 'function') {
            return params.onclose(reason);
          }

          return undefined;
        },
      },
      ...rest,
    );
  };

  return pool;
}

function instrumentSigner(signer, source) {
  if (!signer || signer.__guildTraceWrapped) return signer;

  Object.defineProperty(signer, '__guildTraceWrapped', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  const wrapMethod = (methodName) => {
    if (typeof signer[methodName] !== 'function') return;

    const original = signer[methodName].bind(signer);
    signer[methodName] = async (...args) => {
      const startedAt = Date.now();
      pushNip46Trace(`signer.${methodName}.request`, {
        source,
        ...summarizeSignerArgs(methodName, args),
      });

      try {
        const result = await original(...args);
        pushNip46Trace(`signer.${methodName}.response`, {
          source,
          durationMs: Date.now() - startedAt,
          ...summarizeSignerResult(methodName, result),
        });
        return result;
      } catch (error) {
        pushNip46Trace(`signer.${methodName}.error`, {
          source,
          durationMs: Date.now() - startedAt,
          error: summarizeError(error),
        }, 'error');
        throw error;
      }
    };
  };

  wrapMethod('connect');
  wrapMethod('close');
  wrapMethod('sendRequest');
  wrapMethod('getPublicKey');
  wrapMethod('ping');
  wrapMethod('signEvent');
  wrapMethod('nip04Encrypt');
  wrapMethod('nip44Encrypt');

  return signer;
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
    pushNip46Trace('bunker.connect.invalid_input', {});
    throw new Error('Invalid bunker URI or NIP-05 identifier');
  }
  pushNip46Trace('bunker.connect.start', {
    pubkey: redactTraceValue(bunkerPointer.pubkey),
    relays: bunkerPointer.relays,
  });

  // 2. Generate ephemeral client secret key for this connection
  _clientSecretKey = generateSecretKey();

  // 3. Create BunkerSigner and connect
  _signer = instrumentSigner(BunkerSigner.fromBunker(_clientSecretKey, bunkerPointer, {
    ...buildSignerParams(),
    pool: buildTracingPool('bunker_uri'),
  }), 'bunker_uri');
  await _signer.connect();
  await waitForNip46RelayCooldown('after_bunker_connect');

  // 4. Get the user's public key from the remote signer
  _userPubkey = await resolveSignerPublicKey(_signer, {
    source: 'bunker_uri',
    knownPubkey: bunkerPointer.pubkey,
    timeoutMessage: 'Timed out waiting for the signer to share its public key.',
  });

  // 5. Persist bunker pointer + client SK for session resumption
  _loginMode = 'nip46';
  await _persistSession(bunkerPointer, _clientSecretKey);
  pushNip46Trace('bunker.connect.success', {
    userPubkey: redactTraceValue(_userPubkey),
  });

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
    pushNip46Trace('session.reconnect.nsec', {
      userPubkey: redactTraceValue(_userPubkey),
    });
    return true;
  }

  // Try NIP-46 bunker session
  const session = await _loadSession();
  if (!session) return false;

  try {
    _clientSecretKey = session.clientSecretKey;
    pushNip46Trace('session.reconnect.nip46.start', {
      bunkerPubkey: redactTraceValue(session.bunkerPointer?.pubkey),
      relays: session.bunkerPointer?.relays || [],
    });
    _signer = instrumentSigner(
      BunkerSigner.fromBunker(_clientSecretKey, session.bunkerPointer, {
        ...buildSignerParams(),
        pool: buildTracingPool('session_reconnect'),
      }),
      'session_reconnect',
    );
    _userPubkey = await resolveSignerPublicKey(_signer, {
      source: 'session_reconnect',
      knownPubkey: session.bunkerPointer?.pubkey || null,
      timeoutMessage: 'Timed out waiting for the signer to restore its public key.',
    });
    _loginMode = 'nip46';
    pushNip46Trace('session.reconnect.nip46.success', {
      userPubkey: redactTraceValue(_userPubkey),
    });
    return true;
  } catch (err) {
    pushNip46Trace('session.reconnect.nip46.error', {
      error: summarizeError(err),
    }, 'warn');
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

export function getLoginMode() {
  return _loginMode;
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
export function createNostrConnectSession({ abortSignal, onConnected } = {}) {
  // Clean up any existing signer
  if (_signer) {
    try { _signer.close(); } catch {}
    _signer = null;
  }
  zeroKey(_clientSecretKey);
  _userPubkey = null;
  _loginMode = null;

  // Generate ephemeral keypair for this connection
  const clientSecretKey = generateSecretKey();
  const clientPubkey = getPublicKey(clientSecretKey);
  const secret = bytesToHex(generateSecretKey());
  const relays = [...NOSTRCONNECT_RELAYS];

  const uri = createNostrConnectURI({
    clientPubkey,
    relays,
    secret,
    perms: NOSTRCONNECT_PERMS,
    name: '/guild',
  });
  pushNip46Trace('qr.session.created', {
    clientPubkey: redactTraceValue(clientPubkey),
    relays,
    perms: NOSTRCONNECT_PERMS,
    hasAbortSignal: Boolean(abortSignal),
  });

  const waitForConnection = async () => {
    pushNip46Trace('qr.wait_for_connection.start', {});
    let signer;
    try {
      signer = await BunkerSigner.fromURI(
        clientSecretKey,
        uri,
        {
          ...buildSignerParams(),
          pool: buildTracingPool('qr_session'),
        },
        abortSignal || 300000, // 5 min timeout
      );
      signer = instrumentSigner(signer, 'qr_session');
      pushNip46Trace('qr.wait_for_connection.connected', {});
      onConnected?.();
    } catch (error) {
      pushNip46Trace('qr.wait_for_connection.error', {
        error: summarizeError(error),
      }, 'error');
      throw error;
    }

    if (abortSignal?.aborted) {
      try { await signer.close(); } catch {}
      pushNip46Trace('qr.wait_for_connection.aborted', {});
      throw new Error('QR login was cancelled');
    }

    try {
      pushNip46Trace('qr.finalize_connection.start', {
        mode: 'from_uri_connected',
      });

      const userPubkey = await resolveSignerPublicKey(signer, {
        source: 'qr_session',
        knownPubkey: signer.bp?.pubkey || null,
        timeoutMessage: 'Your signer connected, but it did not share its public key in time.',
      });
      _signer = signer;
      _clientSecretKey = clientSecretKey;
      _userPubkey = userPubkey;
      _loginMode = 'nip46';

      // Persist session for reconnection
      await _persistSession(signer.bp, clientSecretKey);
      pushNip46Trace('qr.finalize_connection.success', {});
      pushNip46Trace('qr.wait_for_connection.ready', {
        userPubkey: redactTraceValue(userPubkey),
        bunkerPubkey: redactTraceValue(signer.bp?.pubkey),
        relays: signer.bp?.relays || [],
      });

      const npub = nip19.npubEncode(userPubkey);
      return { npub, pubkey: userPubkey };
    } catch (error) {
      pushNip46Trace('qr.wait_for_connection.finalize_error', {
        error: summarizeError(error),
      }, 'error');
      try { await signer.close(); } catch {}
      throw error;
    }
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
 * Decode an nsec string.
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
 * Runtime builds intentionally do not persist raw nsec keys across restarts.
 */
export async function persistNsec(_nsecStr) {
  localStorage.removeItem('nostr_nsec_enc');
}

/**
 * Raw nsec keys are never restored from disk on startup.
 * @returns {Promise<{ secretKey: Uint8Array, pubkey: string, npub: string } | null>}
 */
export async function loadNsec() {
  localStorage.removeItem('nostr_nsec_enc');
  return null;
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
    nip44Encrypt: (pubkey, plaintext) => nip44Encrypt(plaintext, getNip44ConversationKey(secretKey, pubkey)),
  };
}

/**
 * Disconnect from the remote signer and clear all session data.
 */
export async function disconnect() {
  if (_signer) {
    try { await _signer.close(); } catch {}
  }
  pushNip46Trace('session.disconnect', {
    loginMode: _loginMode,
    userPubkey: redactTraceValue(_userPubkey),
  });
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
// Session persistence is intentionally disabled in runtime builds.
// ---------------------------------------------------------------------------

async function _persistSession(bunkerPointer) {
  _clearSession();
  pushNip46Trace('session.persist_skipped', {
    reason: 'disabled_in_build',
    bunkerPubkey: redactTraceValue(bunkerPointer?.pubkey),
    relays: bunkerPointer?.relays || [],
  }, 'warn');
}

async function _loadSession() {
  _clearSession();
  return null;
}

function _clearSession() {
  localStorage.removeItem('nostr_nip46_session_enc');
  localStorage.removeItem('nostr_nip46_session');
}
