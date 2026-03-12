import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { api, apiNoAuth, resetSessionExpiry } from '../api';
import { fetchProfile } from '../utils/nostr';
import {
  connectWithBunkerURI,
  decodeNsec,
  persistNsec,
  activateNsec,
  signWithNsec,
  disconnect as disconnectSigner,
  reconnect,
  getSigner,
} from '../utils/nostrConnect';
import { initializeCryptoIdentity, destroyCryptoState } from '../crypto/sessionManager';

const AuthContext = createContext(null);

function emitE2EInitFailed(error) {
  window.dispatchEvent(new CustomEvent('e2e-init-failed', {
    detail: { error },
  }));
}

/**
 * Shared helper: take a pubkey + signer/secretKey, do challenge-response with server,
 * persist the authenticated session, and return authData.
 */
async function _authenticateWithServer(pubkey, npub, signerOrSecretKey) {
  const profile = await fetchProfile(pubkey);

  const { challenge } = await apiNoAuth('/api/auth/nostr/challenge');

  let signedEvent;
  if (signerOrSecretKey instanceof Uint8Array) {
    signedEvent = signWithNsec(signerOrSecretKey, {
      kind: 22242,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['challenge', challenge]],
      content: '/guild login',
    });
  } else {
    signedEvent = await signerOrSecretKey.signEvent({
      kind: 22242,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['challenge', challenge]],
      content: '/guild login',
    });
  }

  const data = await apiNoAuth('/api/auth/nostr', {
    method: 'POST',
    body: JSON.stringify({
      signedEvent,
      displayName: profile?.name || null,
      lud16: profile?.lud16 || null,
      profilePicture: profile?.picture || null,
    }),
  });

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
  return authData;
}

export function AuthProvider({ children }) {
  const secureStartupAttemptRef = useRef(0);
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('auth');
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem('auth');
      return null;
    }
  });
  const [cryptoStatus, setCryptoStatus] = useState(() => (
    localStorage.getItem('auth') ? 'booting' : 'signed_out'
  ));
  const [cryptoError, setCryptoError] = useState(null);

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

  const retryCryptoInitialization = useCallback(async () => {
    if (!user) return false;
    const result = await initializeSecureSession(user, { reconnectSigner: true });
    return result.ok;
  }, [user, initializeSecureSession]);

  const ensureSecureLogin = useCallback(async (authData) => {
    const result = await initializeSecureSession(authData);
    if (!result.ok) {
      throw new Error(result.error || 'Secure startup failed');
    }
  }, [initializeSecureSession]);

  const nostrLogin = useCallback(async (bunkerInput) => {
    try {
      const { npub, pubkey } = await connectWithBunkerURI(bunkerInput);
      const signer = getSigner();
      if (!signer) throw new Error('Signer not connected');

      const authData = await _authenticateWithServer(pubkey, npub, signer);
      await ensureSecureLogin(authData);
      setUser(authData);
      return authData;
    } catch (err) {
      await clearLocalSession().catch(() => {});
      throw err;
    }
  }, [clearLocalSession, ensureSecureLogin]);

  const nostrConnectLogin = useCallback(async (connectResult) => {
    try {
      const signer = getSigner();
      if (!signer) throw new Error('Signer not connected');

      const authData = await _authenticateWithServer(connectResult.pubkey, connectResult.npub, signer);
      await ensureSecureLogin(authData);
      setUser(authData);
      return authData;
    } catch (err) {
      await clearLocalSession().catch(() => {});
      throw err;
    }
  }, [clearLocalSession, ensureSecureLogin]);

  const nsecLogin = useCallback(async (nsecStr) => {
    const { secretKey, pubkey, npub } = decodeNsec(nsecStr);

    activateNsec(secretKey);

    try {
      const authData = await _authenticateWithServer(pubkey, npub, secretKey);
      await ensureSecureLogin(authData);
      await persistNsec(nsecStr);
      setUser(authData);
      return authData;
    } catch (err) {
      await clearLocalSession().catch(() => {});
      throw err;
    }
  }, [clearLocalSession, ensureSecureLogin]);

  const logout = useCallback(async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    await clearLocalSession();
  }, [clearLocalSession]);

  return (
    <AuthContext.Provider value={{
      user,
      cryptoStatus,
      cryptoError,
      nostrLogin,
      nostrConnectLogin,
      nsecLogin,
      retryCryptoInitialization,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
