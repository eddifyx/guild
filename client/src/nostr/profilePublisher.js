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
import {
  getLoginMode,
  getSigner,
  getUserPubkey,
  reconnect,
  waitForNip46RelayCooldown,
} from '../utils/nostrConnect.js';
import { fetchProfile } from '../utils/nostr.js';
import {
  buildGiftWrapUnavailableMessage,
  buildNoteEventTemplate,
  buildProfileEventTemplate,
  bytesToHex,
  describeSignerError,
  isMissingNip04Capability,
  toBase64Url,
} from '../features/nostr/profilePublisherModel.mjs';
import {
  fetchRelayProfile,
  parseBlossomErrorResponse,
  publishEventToRelays,
  publishSignedEvent,
  signBlossomAuthHeader,
} from '../features/nostr/profilePublisherRuntime.mjs';
import {
  preparePublisherSignerRequest,
  requestPublisherSignature,
  resolvePublisherSignerSession,
} from '../features/nostr/profilePublisherSessionRuntime.mjs';

const PUBLISH_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
];
const BLOSSOM_SERVER = 'https://blossom.nostr.build';

async function refreshPublisherSigner({
  reconnectSignerFn = reconnect,
  getSignerFn = getSigner,
  getUserPubkeyFn = getUserPubkey,
} = {}) {
  const restored = await Promise.resolve(reconnectSignerFn?.()).catch(() => false);
  if (!restored) {
    return { signer: null, pubkey: null };
  }

  return {
    signer: getSignerFn?.() || null,
    pubkey: getUserPubkeyFn?.() || null,
  };
}

async function ensurePublisherSignerReady({
  signer = null,
  loginMode = null,
  reconnectSignerFn = reconnect,
  getSignerFn = getSigner,
  getUserPubkeyFn = getUserPubkey,
  waitForNip46RelayCooldownFn = waitForNip46RelayCooldown,
  preparePublisherSignerRequestFn = preparePublisherSignerRequest,
  pingTimeoutMessage = 'Your signer connected, but it did not answer a profile publish readiness check in time.',
  forceSessionRefresh = false,
} = {}) {
  let activeSigner = signer;
  let activePubkey = getUserPubkeyFn?.() || null;

  if (loginMode === 'nip46' && forceSessionRefresh) {
    const refreshed = await refreshPublisherSigner({
      reconnectSignerFn,
      getSignerFn,
      getUserPubkeyFn,
    });
    if (refreshed.signer && refreshed.pubkey) {
      activeSigner = refreshed.signer;
      activePubkey = refreshed.pubkey;
    }
  }

  const runPrepare = async () => {
    await preparePublisherSignerRequestFn({
      signer: activeSigner,
      loginMode,
      waitForNip46RelayCooldownFn,
      pingTimeoutMessage,
      ignorePingFailure: false,
    });
  };

  try {
    await runPrepare();
    return { signer: activeSigner, pubkey: activePubkey };
  } catch (error) {
    if (loginMode !== 'nip46') {
      throw error;
    }

    const refreshed = await refreshPublisherSigner({
      reconnectSignerFn,
      getSignerFn,
      getUserPubkeyFn,
    });
    activeSigner = refreshed.signer;
    activePubkey = refreshed.pubkey;

    if (!activeSigner || !activePubkey) {
      throw error;
    }

    await runPrepare();
    return { signer: activeSigner, pubkey: activePubkey };
  }
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
    await publishEventToRelays({ pool, relays: PUBLISH_RELAYS, event: signedEvent });
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
    await publishEventToRelays({ pool, relays: PUBLISH_RELAYS, event: recipientWrap });

    if (senderPubkeyHex && senderPubkeyHex !== recipientPubkeyHex) {
      try {
        const sealForSender = await signer.signEvent({
          kind: 13,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: await signer.nip44Encrypt(senderPubkeyHex, JSON.stringify(rumor)),
        });

        await publishEventToRelays({
          pool,
          relays: PUBLISH_RELAYS,
          event: createWrap(sealForSender, senderPubkeyHex),
        });
      } catch {
        // Sender copy is best-effort; recipient delivery is the important part.
      }
    }

    return { ok: true };
  } finally {
    pool.close(PUBLISH_RELAYS);
  }
}

/**
 * Fetch the user's existing kind:0 profile from relays.
 * Returns the full profile content object or null.
 * @param {string} [fallbackPubkey] — hex pubkey to use if signer isn't ready
 */
export async function fetchCurrentProfile(fallbackPubkey) {
  const pubkey = getUserPubkey() || fallbackPubkey;
  return fetchRelayProfile({
    poolCtor: SimplePool,
    relays: PUBLISH_RELAYS,
    pubkey,
  });
}

/**
 * Build and publish a kind:0 metadata event.
 *
 * @param {object} profile — { name, about, picture, banner, lud16 }
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function publishProfile(profile, {
  getSignerFn = getSigner,
  getUserPubkeyFn = getUserPubkey,
  getLoginModeFn = getLoginMode,
  reconnectSignerFn = reconnect,
  waitForNip46RelayCooldownFn = waitForNip46RelayCooldown,
  publishSignedEventFn = publishSignedEvent,
  poolCtor = SimplePool,
  resolvePublisherSignerSessionFn = resolvePublisherSignerSession,
  preparePublisherSignerRequestFn = preparePublisherSignerRequest,
  requestPublisherSignatureFn = requestPublisherSignature,
} = {}) {
  const { signer, pubkey, error: sessionError } = await resolvePublisherSignerSessionFn({
    getSignerFn,
    getUserPubkeyFn,
    reconnectSignerFn,
  });
  if (!signer || !pubkey) {
    return {
      ok: false,
      error: sessionError?.message || 'Signer unavailable — reconnect your signer to continue',
    };
  }
  const loginMode = getLoginModeFn();
  let activeSigner = signer;
  let activePubkey = pubkey;

  try {
    const readySession = await ensurePublisherSignerReady({
      signer: activeSigner,
      loginMode,
      reconnectSignerFn,
      getSignerFn,
      getUserPubkeyFn,
      waitForNip46RelayCooldownFn,
      preparePublisherSignerRequestFn,
      pingTimeoutMessage: 'Your signer connected, but it did not answer a profile publish readiness check in time.',
      forceSessionRefresh: loginMode === 'nip46',
    });
    activeSigner = readySession.signer;
    activePubkey = readySession.pubkey || activePubkey;
  } catch (error) {
    return {
      ok: false,
      error: error?.message || 'Signer unavailable — reconnect your signer to continue',
    };
  }

  const eventTemplate = buildProfileEventTemplate(profile, Date.now(), activePubkey);

  // Sign the event
  let signedEvent;
  try {
    signedEvent = await requestPublisherSignatureFn({
      signer: activeSigner,
      eventTemplate,
      timeoutMessage: 'Your signer connected, but it did not approve the profile publish request in time.',
    });
  } catch (err) {
    if (loginMode !== 'nip46') {
      return { ok: false, error: 'Failed to sign event: ' + err.message };
    }

    const refreshed = await refreshPublisherSigner({
      reconnectSignerFn,
      getSignerFn,
      getUserPubkeyFn,
    });
    if (!refreshed.signer || !refreshed.pubkey) {
      return { ok: false, error: 'Failed to sign event: ' + err.message };
    }

    try {
      const readySession = await ensurePublisherSignerReady({
        signer: refreshed.signer,
        loginMode,
        reconnectSignerFn,
        getSignerFn,
        getUserPubkeyFn,
        waitForNip46RelayCooldownFn,
        preparePublisherSignerRequestFn,
        pingTimeoutMessage: 'Your signer connected, but it did not answer a profile publish readiness check in time.',
        forceSessionRefresh: false,
      });
      signedEvent = await requestPublisherSignatureFn({
        signer: readySession.signer,
        eventTemplate: buildProfileEventTemplate(profile, Date.now(), readySession.pubkey || refreshed.pubkey || activePubkey),
        timeoutMessage: 'Your signer connected, but it did not approve the profile publish request in time.',
      });
    } catch (retryError) {
      return { ok: false, error: 'Failed to sign event: ' + retryError.message };
    }
  }

  // Publish to relays
  try {
    return await publishSignedEventFn({
      poolCtor,
      relays: PUBLISH_RELAYS,
      event: signedEvent,
    });
  } catch (err) {
    return { ok: false, error: 'Failed to publish to relays' };
  }
}

/**
 * Build and publish a kind:1 text note.
 *
 * @param {string} content — the note text
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function publishNote(content, {
  getSignerFn = getSigner,
  getUserPubkeyFn = getUserPubkey,
  getLoginModeFn = getLoginMode,
  reconnectSignerFn = reconnect,
  waitForNip46RelayCooldownFn = waitForNip46RelayCooldown,
  publishSignedEventFn = publishSignedEvent,
  poolCtor = SimplePool,
  resolvePublisherSignerSessionFn = resolvePublisherSignerSession,
  preparePublisherSignerRequestFn = preparePublisherSignerRequest,
  requestPublisherSignatureFn = requestPublisherSignature,
} = {}) {
  const { signer, pubkey, error: sessionError } = await resolvePublisherSignerSessionFn({
    getSignerFn,
    getUserPubkeyFn,
    reconnectSignerFn,
  });
  if (!signer || !pubkey) {
    return {
      ok: false,
      error: sessionError?.message || 'Signer unavailable — reconnect your signer to continue',
    };
  }

  const loginMode = getLoginModeFn();
  let activeSigner = signer;
  let activePubkey = pubkey;

  try {
    const readySession = await ensurePublisherSignerReady({
      signer: activeSigner,
      loginMode,
      reconnectSignerFn,
      getSignerFn,
      getUserPubkeyFn,
      waitForNip46RelayCooldownFn,
      preparePublisherSignerRequestFn,
      pingTimeoutMessage: 'Your signer connected, but it did not answer a note publish readiness check in time.',
    });
    activeSigner = readySession.signer;
    activePubkey = readySession.pubkey || activePubkey;
  } catch (error) {
    return {
      ok: false,
      error: error?.message || 'Signer unavailable — reconnect your signer to continue',
    };
  }

  const eventTemplate = buildNoteEventTemplate(content, Date.now(), activePubkey);

  let signedEvent;
  try {
    signedEvent = await requestPublisherSignatureFn({
      signer: activeSigner,
      eventTemplate,
      timeoutMessage: 'Your signer connected, but it did not approve the note publish request in time.',
    });
  } catch (err) {
    return { ok: false, error: 'Failed to sign: ' + err.message };
  }

  try {
    return await publishSignedEventFn({
      poolCtor,
      relays: PUBLISH_RELAYS,
      event: signedEvent,
    });
  } catch {
    return { ok: false, error: 'Failed to publish to relays' };
  }
}

/**
 * Send an encrypted NIP-04 direct message to another Nostr user.
 *
 * @param {string} recipientPubkeyHex — hex pubkey of the recipient
 * @param {string} content — plaintext message
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function publishDM(recipientPubkeyHex, content, {
  getSignerFn = getSigner,
  getUserPubkeyFn = getUserPubkey,
  reconnectSignerFn = reconnect,
} = {}) {
  const { signer, pubkey } = await resolvePublisherSignerSession({
    getSignerFn,
    getUserPubkeyFn,
    reconnectSignerFn,
  });
  if (!signer || !pubkey) {
    return { ok: false, error: 'Signer unavailable — reconnect your signer to continue' };
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
    return {
      ok: false,
      error: buildGiftWrapUnavailableMessage({
        loginMode: getLoginMode(),
        giftWrapError,
      }),
    };
  }
}

/**
 * Upload an image to Nostr.build's Blossom server.
 *
 * @param {File} file — image file
 * @returns {Promise<string>} — URL of the uploaded image
 */
export async function uploadImage(file, {
  getSignerFn = getSigner,
  getUserPubkeyFn = getUserPubkey,
  getLoginModeFn = getLoginMode,
  reconnectSignerFn = reconnect,
  waitForNip46RelayCooldownFn = waitForNip46RelayCooldown,
  preparePublisherSignerRequestFn = preparePublisherSignerRequest,
} = {}) {
  const { signer, pubkey } = await resolvePublisherSignerSession({
    getSignerFn,
    getUserPubkeyFn,
    reconnectSignerFn,
  });
  if (!signer || !pubkey) {
    throw new Error('Signer unavailable — reconnect your signer to continue');
  }

  const readySession = await ensurePublisherSignerReady({
    signer,
    loginMode: getLoginModeFn(),
    reconnectSignerFn,
    getSignerFn,
    getUserPubkeyFn,
    waitForNip46RelayCooldownFn,
    preparePublisherSignerRequestFn,
    pingTimeoutMessage: 'Your signer connected, but it did not answer a profile image upload readiness check in time.',
  });

  const sha256 = bytesToHex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
  const authorization = await signBlossomAuthHeader({
    signer: readySession.signer,
    pubkey: readySession.pubkey,
    action: 'media',
    sha256,
    content: 'Upload profile image',
    encodeTokenFn: toBase64Url,
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
    throw new Error(await parseBlossomErrorResponse(res));
  }

  const descriptor = await res.json().catch(() => null);
  if (descriptor?.url) {
    return descriptor.url;
  }

  throw new Error('Upload returned an unexpected response');
}
