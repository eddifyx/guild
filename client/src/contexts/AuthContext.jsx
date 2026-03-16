import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { nip19 } from 'nostr-tools';
import { api, resetSessionExpiry, getServerUrl, toServerConnectionError } from '../api';
import { fetchProfile } from '../utils/nostr';
import { publishProfile, uploadImage } from '../nostr/profilePublisher';
import {
  connectWithBunkerURI,
  decodeNsec,
  activateNsec,
  signWithNsec,
  disconnect as disconnectSigner,
  reconnect,
  getSigner,
  getLoginMode,
  waitForNip46RelayCooldown,
} from '../utils/nostrConnect';
import {
  pushNip46Trace,
  redactTraceValue,
  summarizeError,
  summarizeNostrEvent,
} from '../utils/nip46Trace';
import { initializeCryptoIdentity, destroyCryptoState } from '../crypto/sessionManager';

const AuthContext = createContext(null);

function emitE2EInitFailed(error) {
  window.dispatchEvent(new CustomEvent('e2e-init-failed', {
    detail: { error },
  }));
}

const PROFILE_FETCH_TIMEOUT_MS = 2500;
const SIGNER_REQUEST_TIMEOUT_MS = 12000;
const SIGNER_PING_TIMEOUT_MS = 8000;
const SECURE_STARTUP_TIMEOUT_MS = 20000;
const AUTH_EVENT_RELAY_HINT = 'wss://nos.lol/';
const PREFER_NIP42_LOGIN_PROOF = true;
const LOGIN_COMPAT_KIND = 1;
const LOGIN_COMPAT_CONTENT = '/guild login';
const LOGIN_COMPAT_CLIENT = '/guild';
const AUTH_USER_UPDATED_EVENT = 'guild:auth-user-updated';
const INITIAL_AUTH_UNSET = Symbol('initial-auth-unset');

function loadRecoverableStoredAuth() {
  try {
    const stored = localStorage.getItem('auth');
    if (!stored) return null;

    const authData = JSON.parse(stored);
    if (getSigner()) {
      return authData;
    }

    pushNip46Trace('session.restore.expired', {
      reason: 'session_only_signer_missing_after_restart',
      npub: redactTraceValue(authData?.npub),
    }, 'warn');
    localStorage.removeItem('auth');
    return null;
  } catch {
    localStorage.removeItem('auth');
    return null;
  }
}

async function loadProfileForLogin(pubkey) {
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

async function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function buildLoginAuthEvent(challenge, { compatibilityMode = false, pubkey = null } = {}) {
  if (compatibilityMode) {
    return {
      kind: LOGIN_COMPAT_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['challenge', challenge],
        ['client', LOGIN_COMPAT_CLIENT],
        ['relay', AUTH_EVENT_RELAY_HINT],
      ],
      content: LOGIN_COMPAT_CONTENT,
      ...(pubkey ? { pubkey } : {}),
    };
  }

  return {
    kind: 22242,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['relay', AUTH_EVENT_RELAY_HINT],
      ['challenge', challenge],
    ],
    content: '',
    ...(pubkey ? { pubkey } : {}),
  };
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

/**
 * Shared helper: take a pubkey + signer/secretKey, do challenge-response with server,
 * persist the authenticated session, and return authData.
 */
async function _authenticateWithServer(pubkey, npub, signerOrSecretKey) {
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

  const authData = {
    userId: data.userId,
    username: data.username,
    avatarColor: data.avatarColor,
    npub: data.npub,
    profilePicture: data.profilePicture ?? null,
    token: data.token,
  };

  localStorage.setItem('auth', JSON.stringify(authData));
  resetSessionExpiry();
  pushNip46Trace('login.authenticate.success', {
    userId: authData.userId,
    npub: redactTraceValue(authData.npub),
  });
  return authData;
}

export function AuthProvider({ children }) {
  const secureStartupAttemptRef = useRef(0);
  const profileSyncSessionRef = useRef(null);
  const initialUserRef = useRef(INITIAL_AUTH_UNSET);

  if (initialUserRef.current === INITIAL_AUTH_UNSET) {
    initialUserRef.current = loadRecoverableStoredAuth();
  }

  const [user, setUser] = useState(() => {
    return initialUserRef.current;
  });
  const [cryptoStatus, setCryptoStatus] = useState(() => (
    initialUserRef.current ? 'booting' : 'signed_out'
  ));
  const [cryptoError, setCryptoError] = useState(null);

  const mergeUser = useCallback((updates) => {
    setUser((current) => {
      if (!current) return current;
      const patch = typeof updates === 'function' ? updates(current) : updates;
      if (!patch || typeof patch !== 'object') return current;
      const next = { ...current, ...patch };
      localStorage.setItem('auth', JSON.stringify(next));
      return next;
    });
  }, []);

  const syncNostrProfile = useCallback(async (profileOverride = null) => {
    if (!user?.npub || !user?.token) return null;

    let pubkey = null;
    try {
      pubkey = nip19.decode(user.npub).data;
    } catch {
      return null;
    }

    const relayProfile = profileOverride || await loadProfileForLogin(pubkey);
    if (!relayProfile) return null;

    const desiredName = (relayProfile.name || '').trim() || user.username;
    const desiredPicture = (relayProfile.picture || '').trim() || null;
    const desiredLud16 = (relayProfile.lud16 || '').trim() || null;

    const syncedUser = await api('/api/users/me/nostr-profile', {
      method: 'PUT',
      body: JSON.stringify({
        displayName: desiredName,
        profilePicture: desiredPicture,
        lud16: desiredLud16,
      }),
    });

    mergeUser({
      username: syncedUser.username,
      avatarColor: syncedUser.avatarColor,
      npub: syncedUser.npub || user.npub || null,
      profilePicture: syncedUser.profilePicture || null,
    });

    return { profile: relayProfile, syncedUser };
  }, [mergeUser, user?.npub, user?.token, user?.username]);

  const clearLocalSession = useCallback(async () => {
    secureStartupAttemptRef.current += 1;
    await destroyCryptoState().catch(() => {});
    await disconnectSigner().catch(() => {});
    localStorage.removeItem('auth');
    setUser(null);
    setCryptoStatus('signed_out');
    setCryptoError(null);
  }, []);

  const initializeSecureSession = useCallback(async (authData, options = {}) => {
    const { reconnectSigner: shouldReconnect = false } = options;
    const attemptId = ++secureStartupAttemptRef.current;
    const isCurrentAttempt = () => attemptId === secureStartupAttemptRef.current;
    const failSecureStartup = (message) => {
      if (!isCurrentAttempt()) {
        return { ok: false, cancelled: true };
      }
      setCryptoStatus('blocked');
      setCryptoError(message);
      emitE2EInitFailed(message);
      return { ok: false, error: message };
    };

    setCryptoStatus('booting');
    setCryptoError(null);

    if (shouldReconnect) {
      try {
        const ok = await reconnect();
        if (!ok) {
          const message = 'Nostr signer unavailable. Reconnect your signer to restore secure messaging.';
          console.warn('[Auth] Signer unavailable during secure startup');
          return failSecureStartup(message);
        }
      } catch (err) {
        const message = err?.message || 'Failed to reconnect Nostr signer';
        console.warn('[Auth] Signer reconnect failed:', message);
        return failSecureStartup(message);
      }
    }

    try {
      await initializeCryptoIdentity(authData);
      if (!isCurrentAttempt()) {
        return { ok: false, cancelled: true };
      }
      setCryptoStatus('ready');
      setCryptoError(null);
      return { ok: true };
    } catch (err) {
      if (!isCurrentAttempt()) {
        return { ok: false, cancelled: true };
      }
      const message = err?.message || String(err);
      console.warn('[Auth] E2E encryption init failed:', message);
      return failSecureStartup(message);
    }
  }, []);

  useEffect(() => {
    const onExpired = () => {
      clearLocalSession().catch(() => {});
    };
    window.addEventListener('session-expired', onExpired);
    return () => window.removeEventListener('session-expired', onExpired);
  }, [clearLocalSession]);

  useEffect(() => {
    let cancelled = false;
    if (user?.npub && user?.token) {
      (async () => {
        const result = await initializeSecureSession(user, { reconnectSigner: true });
        if (cancelled || result.cancelled) return;
      })();
    }
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user?.userId || !user?.npub || !user?.token) {
      profileSyncSessionRef.current = null;
      return;
    }

    const sessionKey = `${user.userId}:${user.token}`;
    if (profileSyncSessionRef.current === sessionKey) {
      return;
    }
    profileSyncSessionRef.current = sessionKey;

    syncNostrProfile().catch((err) => {
      console.warn('[Auth] Failed to sync Nostr profile:', err?.message || err);
    });
  }, [syncNostrProfile, user?.userId, user?.npub, user?.token]);

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(AUTH_USER_UPDATED_EVENT, {
      detail: user,
    }));
  }, [user?.userId, user?.username, user?.profilePicture, user?.avatarColor, user?.npub]);

  const retryCryptoInitialization = useCallback(async () => {
    if (!user) return false;
    const result = await initializeSecureSession(user, { reconnectSigner: true });
    return result.ok;
  }, [user, initializeSecureSession]);

  const ensureSecureLogin = useCallback(async (authData) => {
    pushNip46Trace('secure_login.start', {
      npub: redactTraceValue(authData?.npub),
    });
    const result = await withTimeout(
      initializeSecureSession(authData),
      SECURE_STARTUP_TIMEOUT_MS,
      'Login succeeded, but secure messaging setup did not finish in time.',
    );
    if (!result.ok) {
      pushNip46Trace('secure_login.error', {
        error: result.error || 'Secure startup failed',
      }, 'error');
      throw new Error(result.error || 'Secure startup failed');
    }
    pushNip46Trace('secure_login.success', {
      npub: redactTraceValue(authData?.npub),
    });
  }, [initializeSecureSession]);

  const nostrLogin = useCallback(async (bunkerInput) => {
    try {
      pushNip46Trace('login.nostr_bunker.start', {});
      const { npub, pubkey } = await connectWithBunkerURI(bunkerInput);
      const signer = getSigner();
      if (!signer) throw new Error('Signer not connected');

      const authData = await _authenticateWithServer(pubkey, npub, signer);
      await ensureSecureLogin(authData);
      setUser(authData);
      return authData;
    } catch (err) {
      pushNip46Trace('login.nostr_bunker.error', {
        error: summarizeError(err),
      }, 'error');
      await clearLocalSession().catch(() => {});
      throw err;
    }
  }, [clearLocalSession, ensureSecureLogin]);

  const nostrConnectLogin = useCallback(async (connectResult) => {
    try {
      pushNip46Trace('login.nostr_connect.start', {
        pubkey: redactTraceValue(connectResult?.pubkey),
        npub: redactTraceValue(connectResult?.npub),
      });
      const signer = getSigner();
      if (!signer) throw new Error('Signer not connected');

      const authData = await _authenticateWithServer(connectResult.pubkey, connectResult.npub, signer);
      await ensureSecureLogin(authData);
      setUser(authData);
      return authData;
    } catch (err) {
      pushNip46Trace('login.nostr_connect.error', {
        error: summarizeError(err),
      }, 'error');
      await clearLocalSession().catch(() => {});
      throw err;
    }
  }, [clearLocalSession, ensureSecureLogin]);

  const nsecLogin = useCallback(async (nsecStr) => {
    const { secretKey, pubkey, npub } = decodeNsec(nsecStr);

    activateNsec(secretKey);

    try {
      pushNip46Trace('login.nsec.start', {
        pubkey: redactTraceValue(pubkey),
        npub: redactTraceValue(npub),
      });
      const authData = await _authenticateWithServer(pubkey, npub, secretKey);
      await ensureSecureLogin(authData);
      setUser(authData);
      return authData;
    } catch (err) {
      pushNip46Trace('login.nsec.error', {
        error: summarizeError(err),
      }, 'error');
      await clearLocalSession().catch(() => {});
      throw err;
    }
  }, [clearLocalSession, ensureSecureLogin]);

  const createAccount = useCallback(async ({ nsec, profile = null, profileImageFile = null } = {}) => {
    const { secretKey, pubkey, npub } = decodeNsec(nsec);

    activateNsec(secretKey);

    try {
      pushNip46Trace('login.nsec_create.start', {
        pubkey: redactTraceValue(pubkey),
        npub: redactTraceValue(npub),
        hasProfile: Boolean(profile),
        hasProfileImageFile: Boolean(profileImageFile),
      });

      const authData = await _authenticateWithServer(pubkey, npub, secretKey);
      await ensureSecureLogin(authData);

      let nextAuthData = authData;
      let profileResult = null;

      const trimmedProfile = profile ? {
        name: (profile.name || '').trim().slice(0, 50),
        about: (profile.about || '').trim().slice(0, 250),
        picture: (profile.picture || '').trim(),
        banner: (profile.banner || '').trim(),
        lud16: (profile.lud16 || '').trim(),
      } : null;

      const shouldPublishProfile = Boolean(
        trimmedProfile && (
          trimmedProfile.name ||
          trimmedProfile.about ||
          trimmedProfile.picture ||
          trimmedProfile.banner ||
          trimmedProfile.lud16 ||
          profileImageFile
        )
      );

      if (trimmedProfile?.picture && !/^https?:\/\//i.test(trimmedProfile.picture)) {
        throw new Error('Profile picture must be an http(s) URL');
      }

      if (shouldPublishProfile) {
        let pictureUrl = trimmedProfile.picture || '';

        if (profileImageFile) {
          pictureUrl = await uploadImage(profileImageFile);
        }

        const nextProfile = {
          ...trimmedProfile,
          picture: pictureUrl,
        };

        const publishResult = await publishProfile(nextProfile);
        if (!publishResult.ok) {
          throw new Error(publishResult.error || 'Failed to publish Nostr profile');
        }

        const syncedUser = await api('/api/users/me/nostr-profile', {
          method: 'PUT',
          body: JSON.stringify({
            displayName: nextProfile.name || authData.username,
            profilePicture: nextProfile.picture || null,
            lud16: nextProfile.lud16 || null,
          }),
        });

        nextAuthData = {
          ...authData,
          username: syncedUser.username,
          avatarColor: syncedUser.avatarColor,
          npub: syncedUser.npub || authData.npub || null,
          profilePicture: syncedUser.profilePicture || nextProfile.picture || null,
        };
        localStorage.setItem('auth', JSON.stringify(nextAuthData));
        profileResult = nextProfile;
      }

      setUser(nextAuthData);
      return { authData: nextAuthData, profile: profileResult };
    } catch (err) {
      pushNip46Trace('login.nsec_create.error', {
        error: summarizeError(err),
      }, 'error');
      await clearLocalSession().catch(() => {});
      throw err;
    }
  }, [clearLocalSession, ensureSecureLogin]);

  const logout = useCallback(async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    await clearLocalSession();
  }, [clearLocalSession]);

  const value = useMemo(() => ({
    user,
    cryptoStatus,
    cryptoError,
    mergeUser,
    syncNostrProfile,
    nostrLogin,
    nostrConnectLogin,
    nsecLogin,
    createAccount,
    retryCryptoInitialization,
    logout,
  }), [
    user,
    cryptoStatus,
    cryptoError,
    mergeUser,
    syncNostrProfile,
    nostrLogin,
    nostrConnectLogin,
    nsecLogin,
    createAccount,
    retryCryptoInitialization,
    logout,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
