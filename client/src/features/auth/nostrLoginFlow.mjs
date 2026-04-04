import { getServerUrl, toServerConnectionError } from '../../api';
import { fetchProfile } from '../../utils/nostr';
import {
  getLoginMode,
  signWithNsec,
  waitForNip46RelayCooldown,
} from '../../utils/nostrConnect';
import {
  pushNip46Trace,
  redactTraceValue,
  summarizeError,
  summarizeNostrEvent,
} from '../../utils/nip46Trace';
import { buildAuthenticatedSessionUser } from './sessionUserState.mjs';
import {
  buildLoginAuthEvent,
  LOGIN_COMPAT_KIND,
  PREFER_NIP42_LOGIN_PROOF,
} from './nostrLoginContract.mjs';

const PROFILE_FETCH_TIMEOUT_MS = 2500;
const SIGNER_REQUEST_TIMEOUT_MS = 12000;
const SIGNER_PING_TIMEOUT_MS = 8000;

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

export async function loadProfileForLogin(pubkey) {
  pushNip46Trace('profile.lookup.start', {
    pubkey: redactTraceValue(pubkey),
  });
  try {
    const profile = await Promise.race([
      fetchProfile(pubkey),
      new Promise((resolve) => setTimeout(() => resolve(null), PROFILE_FETCH_TIMEOUT_MS)),
    ]);
    pushNip46Trace('profile.lookup.response', {
      found: Boolean(profile),
      hasName: Boolean(profile?.name),
      hasLud16: Boolean(profile?.lud16),
      hasPicture: Boolean(profile?.picture),
    });
    return profile;
  } catch {
    pushNip46Trace('profile.lookup.error', {
      pubkey: redactTraceValue(pubkey),
    }, 'warn');
    return null;
  }
}

async function fetchLoginChallenge() {
  const url = `${getServerUrl()}/api/auth/nostr/challenge`;
  pushNip46Trace('server.challenge.request', { url });

  let response;
  try {
    response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    pushNip46Trace('server.challenge.network_error', {
      error: summarizeError(error),
    }, 'error');
    throw toServerConnectionError(error, getServerUrl());
  }

  const payload = await response.json().catch(() => ({}));
  pushNip46Trace('server.challenge.response', {
    status: response.status,
    ok: response.ok,
    challenge: redactTraceValue(payload?.challenge),
    authPubkey: redactTraceValue(payload?.authPubkey),
    error: payload?.error || null,
  }, response.ok ? 'info' : 'error');

  if (!response.ok) {
    throw new Error(payload?.error || response.statusText || 'Request failed');
  }

  if (typeof payload?.challenge !== 'string' || !payload.challenge.trim()) {
    pushNip46Trace('server.challenge.invalid_payload', {
      status: response.status,
      hasChallenge: Boolean(payload?.challenge),
      payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
    }, 'error');
    throw new Error(`The server at ${getServerUrl()} is not serving a valid /guild auth challenge.`);
  }

  return payload;
}

async function submitLoginProof(authBody, profile) {
  const url = `${getServerUrl()}/api/auth/nostr`;
  const payload = {
    ...authBody,
    displayName: profile?.name || null,
    lud16: profile?.lud16 || null,
    profilePicture: profile?.picture || null,
  };

  pushNip46Trace('server.login.request', {
    url,
    authMethod: payload.signedEvent ? 'signed_event' : 'nip04_ciphertext',
    signedEvent: payload.signedEvent ? summarizeNostrEvent(payload.signedEvent) : null,
    pubkey: redactTraceValue(payload.pubkey),
    challenge: redactTraceValue(payload.challenge),
    nip04Ciphertext: payload.nip04Ciphertext,
    profile: {
      hasName: Boolean(payload.displayName),
      hasLud16: Boolean(payload.lud16),
      hasPicture: Boolean(payload.profilePicture),
    },
  });

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    pushNip46Trace('server.login.network_error', {
      error: summarizeError(error),
    }, 'error');
    throw toServerConnectionError(error, getServerUrl());
  }

  const responsePayload = await response.json().catch(() => ({}));
  pushNip46Trace('server.login.response', {
    status: response.status,
    ok: response.ok,
    userId: responsePayload?.userId || null,
    npub: redactTraceValue(responsePayload?.npub),
    error: responsePayload?.error || null,
  }, response.ok ? 'info' : 'error');

  if (!response.ok) {
    throw new Error(responsePayload?.error || response.statusText || 'Request failed');
  }

  return responsePayload;
}

async function requestRemoteLoginSignature(signer, eventTemplate, label) {
  pushNip46Trace('login.sign_event.prepare', {
    loginMode: getLoginMode(),
    attempt: label,
    compatibilityMode: eventTemplate.kind === LOGIN_COMPAT_KIND,
    event: summarizeNostrEvent(eventTemplate),
  });

  try {
    const signedEvent = await withTimeout(
      signer.signEvent(eventTemplate),
      SIGNER_REQUEST_TIMEOUT_MS,
      'Your signer connected, but it did not approve the /guild login request in time.',
    );
    pushNip46Trace('login.sign_event.success', {
      attempt: label,
      signedEvent: summarizeNostrEvent(signedEvent),
    });
    return signedEvent;
  } catch (error) {
    pushNip46Trace('login.sign_event.error', {
      attempt: label,
      error: summarizeError(error),
    }, 'error');
    throw error;
  }
}

async function signRemoteLoginEvent(signer, challenge, pubkey) {
  const primaryEvent = PREFER_NIP42_LOGIN_PROOF
    ? buildLoginAuthEvent(challenge, { pubkey })
    : buildLoginAuthEvent(challenge, { compatibilityMode: true, pubkey });
  const primaryAttempt = PREFER_NIP42_LOGIN_PROOF ? 'nip42' : 'compat_kind_1';
  const fallbackEvent = PREFER_NIP42_LOGIN_PROOF
    ? buildLoginAuthEvent(challenge, { compatibilityMode: true, pubkey })
    : buildLoginAuthEvent(challenge, { pubkey });
  const fallbackAttempt = PREFER_NIP42_LOGIN_PROOF ? 'compat_kind_1' : 'nip42';
  const fallbackTraceStep = PREFER_NIP42_LOGIN_PROOF
    ? 'login.sign_event.compat_fallback'
    : 'login.sign_event.nip42_fallback';
  const fallbackCooldownStage = PREFER_NIP42_LOGIN_PROOF
    ? 'before_compat_sign_event'
    : 'before_nip42_sign_event';

  try {
    return await requestRemoteLoginSignature(signer, primaryEvent, primaryAttempt);
  } catch (primaryError) {
    pushNip46Trace(fallbackTraceStep, {
      error: summarizeError(primaryError),
    }, 'warn');
    await waitForNip46RelayCooldown(fallbackCooldownStage);
    return requestRemoteLoginSignature(signer, fallbackEvent, fallbackAttempt);
  }
}

async function encryptRemoteLoginChallenge(signer, authPubkey, challenge) {
  pushNip46Trace('login.nip04_encrypt.prepare', {
    authPubkey: redactTraceValue(authPubkey),
    challenge: redactTraceValue(challenge),
  });

  try {
    const ciphertext = await withTimeout(
      signer.nip04Encrypt(authPubkey, challenge),
      SIGNER_REQUEST_TIMEOUT_MS,
      'Your signer connected, but it did not approve the /guild login encryption challenge in time.',
    );
    pushNip46Trace('login.nip04_encrypt.success', {
      authPubkey: redactTraceValue(authPubkey),
      ciphertext,
    });
    return ciphertext;
  } catch (error) {
    pushNip46Trace('login.nip04_encrypt.error', {
      error: summarizeError(error),
    }, 'error');
    throw error;
  }
}

async function pingRemoteSigner(signer) {
  if (typeof signer?.ping !== 'function') {
    pushNip46Trace('login.ping.skipped', {
      reason: 'signer_has_no_ping_method',
    }, 'warn');
    return false;
  }

  pushNip46Trace('login.ping.prepare', {
    loginMode: getLoginMode(),
  });

  try {
    const result = await withTimeout(
      signer.ping(),
      SIGNER_PING_TIMEOUT_MS,
      'Your signer connected, but it did not answer a basic NIP-46 ping in time.',
    );
    pushNip46Trace('login.ping.success', { result });
    return true;
  } catch (error) {
    pushNip46Trace('login.ping.error', {
      error: summarizeError(error),
    }, 'warn');
    return false;
  }
}

export async function authenticateWithServer(pubkey, npub, signerOrSecretKey) {
  pushNip46Trace('login.authenticate.start', {
    loginMode: signerOrSecretKey instanceof Uint8Array ? 'nsec' : getLoginMode(),
    pubkey: redactTraceValue(pubkey),
    npub: redactTraceValue(npub),
  });

  if (!(signerOrSecretKey instanceof Uint8Array) && getLoginMode() === 'nip46') {
    await waitForNip46RelayCooldown('before_remote_ping');
    await pingRemoteSigner(signerOrSecretKey);
  }

  const [{ challenge, authPubkey }, profile] = await Promise.all([
    fetchLoginChallenge(),
    loadProfileForLogin(pubkey),
  ]);

  let authBody;
  if (signerOrSecretKey instanceof Uint8Array) {
    pushNip46Trace('login.local_sign.prepare', {
      challenge: redactTraceValue(challenge),
    });
    authBody = {
      signedEvent: signWithNsec(signerOrSecretKey, buildLoginAuthEvent(challenge)),
    };
    pushNip46Trace('login.local_sign.success', {
      signedEvent: summarizeNostrEvent(authBody.signedEvent),
    });
  } else {
    try {
      await waitForNip46RelayCooldown('before_remote_login_signature');
      authBody = {
        signedEvent: await signRemoteLoginEvent(signerOrSecretKey, challenge, pubkey),
      };
    } catch (err) {
      pushNip46Trace('login.sign_event.fallback_check', {
        error: summarizeError(err),
        loginMode: getLoginMode(),
        hasNip04Encrypt: Boolean(signerOrSecretKey?.nip04Encrypt),
        hasAuthPubkey: Boolean(authPubkey),
      }, 'warn');
      if (getLoginMode() !== 'nip46' || !signerOrSecretKey?.nip04Encrypt || !authPubkey) {
        throw err;
      }

      pushNip46Trace('login.sign_event.fallback_nip04', {
        authPubkey: redactTraceValue(authPubkey),
      }, 'warn');
      await waitForNip46RelayCooldown('before_nip04_fallback');
      authBody = {
        pubkey,
        challenge,
        nip04Ciphertext: await encryptRemoteLoginChallenge(signerOrSecretKey, authPubkey, challenge),
      };
    }
  }

  const data = await submitLoginProof(authBody, profile);
  const authData = buildAuthenticatedSessionUser(data);

  pushNip46Trace('login.authenticate.success', {
    userId: authData.userId,
    npub: redactTraceValue(authData.npub),
  });
  return authData;
}
