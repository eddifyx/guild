import { useState, useEffect, useRef } from 'react';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../contexts/AuthContext';
import { createNostrConnectSession, getAuthChallengeEventName } from '../../utils/nostrConnect';
import { clearNip46Trace } from '../../utils/nip46Trace';
import { setServerUrl, getServerUrl } from '../../api';
import Avatar from '../Common/Avatar';

const QR_CONNECTION_TIMEOUT_MS = 45000;
const AMBER_SIGNER_URL = 'https://f-droid.org/packages/com.greenart7c3.nostrsigner/';
const AEGIS_SIGNER_URL = 'https://testflight.apple.com/join/DUzVMDMK';

function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute', top: 16, left: 16,
        background: 'none', border: 'none',
        color: 'rgba(64, 255, 64, 0.4)',
        cursor: 'pointer', padding: 8, borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'color 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.color = 'rgba(64, 255, 64, 0.8)'}
      onMouseLeave={e => e.currentTarget.style.color = 'rgba(64, 255, 64, 0.4)'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}

const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 8,
  border: '1px solid rgba(64, 255, 64, 0.07)',
  background: '#0b0d0b',
  color: '#e0e8e0',
  fontSize: 14,
  outline: 'none',
  marginBottom: 12,
  transition: 'border-color 0.2s',
};

export default function LoginScreen({ onLoginSuccess }) {
  const { nostrLogin, nostrConnectLogin, nsecLogin, createAccount } = useAuth();
  const abortRef = useRef(null);
  const createImageInputRef = useRef(null);

  const [view, setView] = useState('welcome'); // 'welcome' | 'main' | 'qr' | 'nsec' | 'create'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [server, setServer] = useState(getServerUrl());
  const [showServer, setShowServer] = useState(false);
  const [qrSessionNonce, setQrSessionNonce] = useState(0);
  const [authChallengeUrl, setAuthChallengeUrl] = useState('');
  const [qrPhase, setQrPhase] = useState('idle');
  const [qrUriCopyState, setQrUriCopyState] = useState('');
  const [showQrAdvanced, setShowQrAdvanced] = useState(false);
  const [showBunkerInput, setShowBunkerInput] = useState(false);
  const [bunkerInput, setBunkerInput] = useState('');

  // QR view state
  const [connectURI, setConnectURI] = useState('');

  // nsec view state
  const [nsecInput, setNsecInput] = useState('');
  const [generatedAccount, setGeneratedAccount] = useState(null);
  const [createCopyState, setCreateCopyState] = useState('');
  const [showGeneratedNsec, setShowGeneratedNsec] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createAbout, setCreateAbout] = useState('');
  const [createPicture, setCreatePicture] = useState('');
  const [createImageFile, setCreateImageFile] = useState(null);
  const [createImagePreview, setCreateImagePreview] = useState('');
  const [showKeyPrimer, setShowKeyPrimer] = useState(false);


  // Generate nostrconnect:// URI only when QR view is active
  useEffect(() => {
    if (view !== 'qr') return;

    if (server !== getServerUrl()) {
      setServerUrl(server);
    }
    clearNip46Trace('qr_view_started');
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    let waitingForConnection = true;
    const timeoutId = setTimeout(() => {
      if (!waitingForConnection) return;
      timedOut = true;
      controller.abort();
    }, QR_CONNECTION_TIMEOUT_MS);

    setLoading(false);
    setConnectURI('');
    setError('');
    setAuthChallengeUrl('');
    setQrPhase('waiting_connection');
    setQrUriCopyState('');
    setShowQrAdvanced(false);
    setShowBunkerInput(false);

    const { uri, waitForConnection } = createNostrConnectSession({
      abortSignal: controller.signal,
      onConnected: () => {
        if (controller.signal.aborted) return;
        waitingForConnection = false;
        clearTimeout(timeoutId);
        setLoading(true);
        setQrPhase('finishing_login');
      },
    });
    setConnectURI(uri);

    waitForConnection()
      .then(async (result) => {
        waitingForConnection = false;
        clearTimeout(timeoutId);
        if (controller.signal.aborted) return;
        setLoading(true);
        try {
          await nostrConnectLogin(result);
          if (onLoginSuccess) onLoginSuccess();
        } catch (err) {
          setError(err.message || 'Login failed');
          setQrPhase('idle');
        }
        setLoading(false);
      })
      .catch(err => {
        waitingForConnection = false;
        clearTimeout(timeoutId);
        if (controller.signal.aborted && !timedOut) return;
        const message = err?.message || 'QR connection failed. Refresh the code and try again.';
        if (timedOut) {
          setError('Signer did not connect to this QR code in time. Refresh the QR and scan again.');
        } else if (/subscription closed before connection was established/i.test(message)) {
          setError('QR session expired before the signer connected. Refresh the code and scan again.');
        } else if (!/cancelled/i.test(message)) {
          setError(message);
        }
        setQrPhase('idle');
        setLoading(false);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    };
  }, [view, qrSessionNonce, server, nostrConnectLogin, onLoginSuccess]);

  useEffect(() => {
    const eventName = getAuthChallengeEventName();
    const handleAuthChallenge = (event) => {
      const url = event?.detail?.url;
      if (!url) return;
      setAuthChallengeUrl(url);
      setError('Your signer requires an additional approval step before it can sign in.');
    };

    window.addEventListener(eventName, handleAuthChallenge);
    return () => window.removeEventListener(eventName, handleAuthChallenge);
  }, []);

  useEffect(() => {
    if (!createImageFile) {
      setCreateImagePreview('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(createImageFile);
    setCreateImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [createImageFile]);

  const loginWithNsec = async (value) => {
    const trimmed = value.trim();
    if (!trimmed.startsWith('nsec1')) return;

    setLoading(true);
    setError('');
    try {
      if (server !== getServerUrl()) setServerUrl(server);
      await nsecLogin(trimmed);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      // Sanitize error messages — never expose the raw nsec in the UI
      let msg = err.message || 'Failed to connect';
      if (msg.includes('checksum') || msg.includes('Invalid') && msg.includes('nsec')) {
        msg = 'Invalid key — please check for typos and try again.';
      }
      setError(msg);
    }
    setLoading(false);
  };

  const handleNsecSubmit = async (e) => {
    e.preventDefault();
    await loginWithNsec(nsecInput);
  };


  const switchView = (v) => {
    setError('');
    setLoading(false);
    setCreateCopyState('');
    setQrPhase('idle');
    setQrUriCopyState('');
    setShowQrAdvanced(false);
    setShowBunkerInput(false);
    if (v === 'qr') {
      setBunkerInput('');
    }
    setView(v);
  };

  const copyQrUri = async () => {
    if (!connectURI) return;
    try {
      await navigator.clipboard.writeText(connectURI);
      setQrUriCopyState('QR URI copied');
    } catch {
      setQrUriCopyState('QR URI copy failed');
    }
  };

  const stopQrSession = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setQrPhase('idle');
  };

  const handleBunkerSubmit = async (e) => {
    e?.preventDefault?.();
    const trimmed = bunkerInput.trim();
    if (!trimmed) return;

    stopQrSession();
    setLoading(true);
    setError('');
    setAuthChallengeUrl('');

    try {
      if (server !== getServerUrl()) setServerUrl(server);
      await nostrLogin(trimmed);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      setError(err?.message || 'Bunker connection failed');
    }

    setLoading(false);
  };

  const generateAccount = () => {
    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);
    const nsec = nip19.nsecEncode(secretKey);
    const npub = nip19.npubEncode(pubkey);

    setGeneratedAccount({ nsec, npub });
    setNsecInput(nsec);
    setShowGeneratedNsec(false);
    setCreateCopyState('');
    setError('');
  };

  const handleCreateImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Profile image must be under 10MB');
      e.target.value = '';
      return;
    }
    setError('');
    setCreateImageFile(file);
  };

  const handleCreateAccountSubmit = async () => {
    if (!generatedAccount?.nsec) return;

    setLoading(true);
    setError('');
    try {
      if (server !== getServerUrl()) setServerUrl(server);
      await createAccount({
        nsec: generatedAccount.nsec,
        profile: {
          name: createName,
          about: createAbout,
          picture: createPicture,
        },
        profileImageFile: createImageFile,
      });
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      let msg = err.message || 'Failed to create key';
      if (/profile picture must be an http\(s\) url/i.test(msg)) {
        msg = 'Profile picture URL must start with http:// or https://';
      }
      setError(msg);
    }
    setLoading(false);
  };

  const copyGeneratedValue = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      setCreateCopyState(label);
    } catch {
      setCreateCopyState('Copy failed');
    }
  };

  const qrBusy = loading || qrPhase === 'waiting_connection' || qrPhase === 'finishing_login';
  const openExternalLink = (url) => window.electronAPI?.openExternal?.(url);
  const openPrimal = () => openExternalLink('https://primal.net');
  const maskedGeneratedNsec = generatedAccount
    ? `${generatedAccount.nsec.slice(0, 12)}${'*'.repeat(24)}${generatedAccount.nsec.slice(-8)}`
    : '';
  const createAvatarPreview = createImagePreview || createPicture;
  const isCreateView = view === 'create';

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: isCreateView ? 'flex-start' : 'center',
      background: 'radial-gradient(circle at 50% 40%, rgba(64, 255, 64, 0.03) 0%, #050705 70%)',
      position: 'relative',
      overflowX: 'hidden',
      overflowY: 'auto',
      padding: isCreateView ? '28px 24px 40px' : '24px',
      boxSizing: 'border-box',
      WebkitAppRegion: 'drag',
    }}>
      {/* Close button */}
      <button
        onClick={() => window.electronAPI?.windowClose?.()}
        style={{
          position: 'absolute', top: 8, right: 8,
          background: 'none', border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer', padding: 8, borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10, WebkitAppRegion: 'no-drag',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#e81123'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        <svg width="14" height="14" viewBox="0 0 12 12">
          <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      <style>{`
        .login-input::placeholder {
          color: rgba(255, 255, 255, 0.3) !important;
        }
@keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        background: '#080a08',
        padding: isCreateView ? '52px 40px 36px' : '48px 40px',
        borderRadius: 16,
        width: 'min(100%, 540px)',
        border: '1px solid rgba(64, 255, 64, 0.07)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 80px rgba(64, 255, 64, 0.03)',
        WebkitAppRegion: 'no-drag',
        animation: 'fadeIn 0.4s ease-out',
        position: 'relative',
        zIndex: 1,
        margin: isCreateView ? '18px 0' : '0',
        maxHeight: isCreateView ? 'calc(100vh - 68px)' : 'none',
        overflowY: isCreateView ? 'auto' : 'visible',
        boxSizing: 'border-box',
      }}>

        {/* ============ WELCOME VIEW ============ */}
        {view === 'welcome' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{
                fontSize: 28,
                fontWeight: 700,
                fontFamily: "'Geist', sans-serif",
                letterSpacing: '-1px',
                color: '#40FF40',
                textShadow: '0 0 12px rgba(64, 255, 64, 0.4)',
                marginBottom: 12,
              }}>
                /guild
              </div>
              <p style={{
                color: 'rgba(255, 255, 255, 0.55)',
                fontSize: 13,
                lineHeight: 1.5,
                margin: 0,
              }}>
                Bring an existing account, or generate a fresh Nostr keypair here.
              </p>
            </div>

            <button
              type="button"
              onClick={() => switchView('main')}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 8,
                border: 'none',
                background: '#40FF40',
                color: '#050705',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: '0 0 16px rgba(64, 255, 64, 0.15)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#33cc33'}
              onMouseLeave={e => e.currentTarget.style.background = '#40FF40'}
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => switchView('create')}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 8,
                border: '1px solid rgba(64, 255, 64, 0.15)',
                background: 'transparent',
                color: '#e0e8e0',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(64, 255, 64, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.15)';
              }}
            >
              Create Key
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </button>

              <p style={{
                color: 'rgba(255, 255, 255, 0.28)',
                fontSize: 11,
                lineHeight: 1.5,
                margin: 0,
                textAlign: 'center',
              }}>
              Create Key sets up your key-based identity here in /guild.
            </p>
          </div>
        )}

        {/* ============ CREATE ACCOUNT VIEW ============ */}
        {view === 'create' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <BackButton onClick={() => switchView('welcome')} />

            <div style={{ textAlign: 'center', marginBottom: 24, paddingTop: 8 }}>
              <div style={{
                fontSize: 28,
                fontWeight: 700,
                fontFamily: "'Geist', sans-serif",
                letterSpacing: '-1px',
                color: '#40FF40',
                textShadow: '0 0 12px rgba(64, 255, 64, 0.4)',
                marginBottom: 12,
              }}>
                /guild
              </div>
              <p style={{
                color: 'rgba(255, 255, 255, 0.55)',
                fontSize: 13,
                lineHeight: 1.5,
                margin: 0,
              }}>
                This works differently than a normal email and password login. You create keys that you control, then set the profile people will see.
              </p>
            </div>

            <div style={{
              padding: '14px 16px',
              marginBottom: 16,
              borderRadius: 12,
              border: '1px solid rgba(64, 255, 64, 0.12)',
              background: 'rgba(64, 255, 64, 0.05)',
            }}>
              <p style={{
                color: '#dfe8df',
                fontSize: 12,
                lineHeight: 1.6,
                margin: 0,
              }}>
                Instead of recovering an account with email, you keep control by saving your private key yourself.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowKeyPrimer((value) => !value)}
              style={{
                width: '100%',
                background: 'none',
                border: '1px solid rgba(64, 255, 64, 0.15)',
                borderRadius: 8,
                color: 'rgba(255, 255, 255, 0.78)',
                cursor: 'pointer',
                fontSize: 12,
                padding: '10px 12px',
                textAlign: 'left',
                marginBottom: showKeyPrimer ? 10 : 16,
              }}
            >
              {showKeyPrimer ? 'Hide account explainer' : 'How does this account work?'}
            </button>

            {showKeyPrimer && (
              <div style={{
                padding: '14px 16px',
                marginBottom: 16,
                borderRadius: 12,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(255, 255, 255, 0.03)',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 10,
                }}>
                  <p style={{
                    color: '#dfe8df',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.6px',
                    textTransform: 'uppercase',
                    margin: 0,
                  }}>
                    How This Account Works
                  </p>
                </div>
                <p style={{
                  color: '#dfe8df',
                  fontSize: 12,
                  lineHeight: 1.6,
                  margin: '0 0 10px',
                }}>
                  This is different from a normal email-and-password account. Nostr uses keys instead, so you stay in control of the account.
                </p>
                <p style={{
                  color: 'rgba(255, 255, 255, 0.75)',
                  fontSize: 12,
                  lineHeight: 1.6,
                  margin: '0 0 8px',
                }}>
                  <strong style={{ color: '#40FF40' }}>Public key (`npub`)</strong>: this is like your shareable account address. People can use it to find you. Sharing it does not let anyone log in as you.
                </p>
                <p style={{
                  color: 'rgba(255, 255, 255, 0.75)',
                  fontSize: 12,
                  lineHeight: 1.6,
                  margin: '0 0 8px',
                }}>
                  <strong style={{ color: '#ff9b9b' }}>Private key (`nsec`)</strong>: this is the secret key to the account. It proves the account is yours. Anyone who gets it can take over the account.
                </p>
                <p style={{
                  color: 'rgba(255, 255, 255, 0.55)',
                  fontSize: 12,
                  lineHeight: 1.6,
                  margin: '0 0 8px',
                }}>
                  Why do it this way? Because you stay in control. There is no company holding your password, no platform that can reset the account for you, and no one in the middle deciding whether you can access it.
                </p>
                <p style={{
                  color: 'rgba(255, 255, 255, 0.55)',
                  fontSize: 12,
                  lineHeight: 1.6,
                  margin: 0,
                }}>
                  The tradeoff is responsibility. There is no central password reset. If you lose your <code style={{ color: '#ff9b9b' }}>nsec</code>, you lose the account. Save it somewhere safe before continuing.
                </p>
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: 12,
                }}>
                  <button
                    type="button"
                    onClick={() => setShowKeyPrimer(false)}
                    style={{
                      background: 'rgba(64, 255, 64, 0.08)',
                      border: '1px solid rgba(64, 255, 64, 0.16)',
                      borderRadius: 8,
                      color: '#dfe8df',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '8px 12px',
                    }}
                  >
                    Got it
                  </button>
                </div>
              </div>
            )}

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 16,
            }}>
              <Avatar
                username={createName || 'Nostr'}
                color="#40FF40"
                size={64}
                profilePicture={createAvatarPreview || null}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <button
                  type="button"
                  onClick={() => createImageInputRef.current?.click()}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(64, 255, 64, 0.15)',
                    background: 'transparent',
                    color: 'rgba(255, 255, 255, 0.78)',
                    cursor: 'pointer',
                    fontSize: 12,
                    textAlign: 'left',
                  }}
                >
                  {createImageFile ? 'Change profile image' : 'Choose profile image'}
                </button>
                <input
                  ref={createImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCreateImageChange}
                  style={{ display: 'none' }}
                />
                {createImageFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setCreateImageFile(null);
                      if (createImageInputRef.current) createImageInputRef.current.value = '';
                    }}
                    style={{
                      padding: '0',
                      border: 'none',
                      background: 'none',
                      color: 'rgba(255, 255, 255, 0.45)',
                      cursor: 'pointer',
                      fontSize: 11,
                      textAlign: 'left',
                    }}
                  >
                    Remove selected file
                  </button>
                )}
                <p style={{
                  color: 'rgba(255, 255, 255, 0.28)',
                  fontSize: 11,
                  lineHeight: 1.5,
                  margin: 0,
                }}>
                  If you pick a file, /guild uploads it after your new account signs in.
                </p>
              </div>
            </div>

            <label style={{
              display: 'block',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: 11,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}>
              Display name
            </label>
            <input
              type="text"
              placeholder="How you want to appear"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="login-input"
              style={{ ...inputStyle, fontSize: 13 }}
              maxLength={50}
              onFocus={e => e.target.style.borderColor = 'rgba(64, 255, 64, 0.3)'}
              onBlur={e => e.target.style.borderColor = 'rgba(64, 255, 64, 0.07)'}
            />

            <label style={{
              display: 'block',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: 11,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}>
              Bio
            </label>
            <textarea
              placeholder="Tell people who you are"
              value={createAbout}
              onChange={(e) => setCreateAbout(e.target.value)}
              className="login-input"
              style={{
                ...inputStyle,
                fontSize: 13,
                minHeight: 72,
                resize: 'vertical',
              }}
              maxLength={250}
              onFocus={e => e.target.style.borderColor = 'rgba(64, 255, 64, 0.3)'}
              onBlur={e => e.target.style.borderColor = 'rgba(64, 255, 64, 0.07)'}
            />

            <label style={{
              display: 'block',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: 11,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}>
              Profile picture URL
            </label>
            <input
              type="text"
              placeholder="https://..."
              value={createPicture}
              onChange={(e) => setCreatePicture(e.target.value)}
              className="login-input"
              style={{ ...inputStyle, fontSize: 13 }}
              onFocus={e => e.target.style.borderColor = 'rgba(64, 255, 64, 0.3)'}
              onBlur={e => e.target.style.borderColor = 'rgba(64, 255, 64, 0.07)'}
            />

            <button
              type="button"
              onClick={generateAccount}
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 8,
                border: 'none',
                background: loading ? '#151a15' : '#40FF40',
                color: loading ? '#506050' : '#050705',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                transition: 'all 0.2s',
                marginBottom: generatedAccount ? 16 : 18,
                boxShadow: loading ? 'none' : '0 0 16px rgba(64, 255, 64, 0.15)',
              }}
              onMouseEnter={e => {
                if (!loading) e.currentTarget.style.background = '#33cc33';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = loading ? '#151a15' : '#40FF40';
              }}
            >
              {generatedAccount ? 'Generate New Keys' : 'Generate Nostr Keys'}
            </button>

            {generatedAccount && (
              <>
                <div style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  padding: '14px 16px',
                  marginBottom: 16,
                  borderRadius: 12,
                  border: '1px solid rgba(255, 99, 99, 0.2)',
                  background: 'rgba(255, 99, 99, 0.1)',
                }}>
                  <div style={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff8f8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3l-8.47-14.14a2 2 0 0 0-3.42 0Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <div>
                    <p style={{
                      color: '#ff9b9b',
                      fontSize: 13,
                      fontWeight: 700,
                      margin: '0 0 6px',
                    }}>
                      Save this nsec now.
                    </p>
                    <p style={{
                      color: 'rgba(255, 225, 225, 0.82)',
                      fontSize: 12,
                      lineHeight: 1.55,
                      margin: 0,
                    }}>
                      Anyone with this secret key can control the account. Copy it somewhere safe before you continue.
                    </p>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}>
                    <p style={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: 11,
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      margin: 0,
                    }}>
                      Public key (npub)
                    </p>
                    <button
                      type="button"
                      onClick={() => copyGeneratedValue(generatedAccount.npub, 'npub copied')}
                      style={{
                        background: 'none',
                        border: '1px solid rgba(64, 255, 64, 0.15)',
                        borderRadius: 8,
                        color: 'rgba(255, 255, 255, 0.7)',
                        cursor: 'pointer',
                        fontSize: 11,
                        padding: '5px 8px',
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  <div style={{
                    ...inputStyle,
                    marginBottom: 0,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    lineHeight: 1.5,
                    wordBreak: 'break-all',
                  }}>
                    {generatedAccount.npub}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}>
                    <p style={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: 11,
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      margin: 0,
                    }}>
                      Secret key (nsec)
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setShowGeneratedNsec((value) => !value)}
                        style={{
                          background: 'none',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: 8,
                          color: 'rgba(255, 255, 255, 0.7)',
                          cursor: 'pointer',
                          fontSize: 11,
                          padding: '5px 8px',
                        }}
                      >
                        {showGeneratedNsec ? 'Hide' : 'Show'}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyGeneratedValue(generatedAccount.nsec, 'nsec copied')}
                        style={{
                          background: 'none',
                          border: '1px solid rgba(64, 255, 64, 0.15)',
                          borderRadius: 8,
                          color: 'rgba(255, 255, 255, 0.7)',
                          cursor: 'pointer',
                          fontSize: 11,
                          padding: '5px 8px',
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <div style={{
                    ...inputStyle,
                    marginBottom: 0,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    lineHeight: 1.5,
                    wordBreak: 'break-all',
                    color: showGeneratedNsec ? '#ffe4e4' : 'rgba(255, 255, 255, 0.45)',
                  }}>
                    {showGeneratedNsec ? generatedAccount.nsec : maskedGeneratedNsec}
                  </div>
                </div>

                {createCopyState && (
                  <p style={{
                    color: createCopyState === 'Copy failed' ? '#ff4757' : 'rgba(64, 255, 64, 0.7)',
                    fontSize: 11,
                    marginTop: 0,
                    marginBottom: 12,
                    textAlign: 'center',
                  }}>
                    {createCopyState}
                  </p>
                )}
              </>
            )}

            {error && (
              <p style={{ color: '#ff4757', fontSize: 12, marginBottom: 12, wordBreak: 'break-word' }}>{error}</p>
            )}

            <button
              type="button"
              onClick={handleCreateAccountSubmit}
              disabled={loading || !generatedAccount}
              style={{
                width: '100%',
                padding: '12px 0',
                borderRadius: 8,
                border: 'none',
                background: loading || !generatedAccount ? '#151a15' : '#40FF40',
                color: loading || !generatedAccount ? '#506050' : '#050705',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'wait' : generatedAccount ? 'pointer' : 'default',
                transition: 'all 0.2s',
                marginBottom: 10,
              }}
            >
              {loading ? 'Signing in...' : 'Use This Account in /guild'}
            </button>

            <button
              type="button"
              onClick={openPrimal}
              style={{
                width: '100%',
                background: 'none',
                border: '1px solid rgba(64, 255, 64, 0.15)',
                borderRadius: 8,
                color: 'rgba(255, 255, 255, 0.7)',
                cursor: 'pointer',
                fontSize: 12,
                padding: '10px 12px',
              }}
            >
              Prefer browser signup? Open Primal
            </button>
          </div>
        )}

        {/* ============ MAIN VIEW ============ */}
        {view === 'main' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <BackButton onClick={() => switchView('welcome')} />

            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{
                fontSize: 28,
                fontWeight: 700,
                fontFamily: "'Geist', sans-serif",
                letterSpacing: '-1px',
                color: '#40FF40',
                textShadow: '0 0 12px rgba(64, 255, 64, 0.4)',
                marginBottom: 12,
              }}>
                /guild
              </div>
              <p style={{
                color: 'rgba(255, 255, 255, 0.55)',
                fontSize: 13,
                lineHeight: 1.5,
                margin: 0,
              }}>
                Use QR if you can. Pasting a private key stays available, but it is the riskier path.
              </p>
            </div>

            {/* Sign in with QR */}
            <button
              type="button"
              onClick={() => switchView('qr')}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 8,
                border: 'none',
                background: '#40FF40',
                color: '#050705',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: '0 0 16px rgba(64, 255, 64, 0.15)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#33cc33'}
              onMouseLeave={e => e.currentTarget.style.background = '#40FF40'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="3" height="3" />
                <line x1="21" y1="14" x2="21" y2="14.01" />
                <line x1="21" y1="21" x2="21" y2="21.01" />
              </svg>
              Sign in with QR
            </button>

            {/* Sign in with key */}
            <button
              type="button"
              onClick={() => switchView('nsec')}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 8,
                border: '1px solid rgba(64, 255, 64, 0.15)',
                background: 'transparent',
                color: '#e0e8e0',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(64, 255, 64, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.15)';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Sign in with key
            </button>

            {/* Server settings */}
            <button
              type="button"
              onClick={() => setShowServer(!showServer)}
              style={{
                width: '100%', marginTop: 12,
                background: 'none', border: 'none',
                color: 'rgba(64, 255, 64, 0.25)',
                fontSize: 11, cursor: 'pointer',
                letterSpacing: '0.3px', transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.target.style.color = 'rgba(64, 255, 64, 0.5)'}
              onMouseLeave={e => e.target.style.color = 'rgba(64, 255, 64, 0.25)'}
            >
              {showServer ? 'Hide server settings' : 'Server settings'}
            </button>

            {showServer && (
              <>
                <input
                  type="text"
                  placeholder="Server URL"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  className="login-input"
                  style={{ ...inputStyle, fontSize: 13, marginTop: 8 }}
                  onFocus={e => e.target.style.borderColor = 'rgba(64, 255, 64, 0.3)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(64, 255, 64, 0.07)'}
                />
                {server.startsWith('http://') && !/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d|10\.\d)/i.test(server) && (
                  <div style={{
                    marginTop: 8, padding: '8px 12px', borderRadius: 6,
                    background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                    fontSize: 11, color: '#ef4444', lineHeight: 1.4,
                  }}>
                    Insecure connection — this server uses unencrypted HTTP. Auth tokens and messages may be intercepted. Use HTTPS for production servers.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ============ QR CODE VIEW ============ */}
        {view === 'qr' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <BackButton onClick={() => switchView('main')} />

            <div style={{ textAlign: 'center', marginBottom: 16, paddingTop: 8 }}>
              <p style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: 12, fontWeight: 400,
                letterSpacing: '2px', textTransform: 'uppercase',
              }}>
                Scan with signer
              </p>
            </div>

            {connectURI && (
              <div style={{
                display: 'flex', justifyContent: 'center',
                marginBottom: 16,
              }}>
                <div style={{
                  background: '#ffffff',
                  padding: 12, borderRadius: 12,
                  display: 'inline-block',
                }}>
                  <QRCodeSVG
                    value={connectURI}
                    size={200}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>
              </div>
            )}

            <p style={{
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: 11, marginBottom: 8,
              letterSpacing: '0.3px',
            }}>
              {qrPhase === 'waiting_connection'
                ? 'Waiting for signer to connect...'
                : loading || qrPhase === 'finishing_login'
                  ? 'Finishing sign-in...'
                  : 'Open a signer app and scan this code'}
            </p>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}>
              <p style={{
                color: 'rgba(255, 255, 255, 0.48)',
                fontSize: 11,
                lineHeight: 1.5,
                margin: 0,
                textAlign: 'center',
              }}>
                Need a signer app first? Install one below, then come back and scan the QR code.
              </p>

              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}>
                <button
                  type="button"
                  onClick={() => openExternalLink(AMBER_SIGNER_URL)}
                  style={{
                    background: 'rgba(64, 255, 64, 0.05)',
                    border: '1px solid rgba(64, 255, 64, 0.16)',
                    borderRadius: 999,
                    color: 'rgba(255, 255, 255, 0.8)',
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: '8px 12px',
                  }}
                >
                  Amber - Android
                </button>

                <button
                  type="button"
                  onClick={() => openExternalLink(AEGIS_SIGNER_URL)}
                  style={{
                    background: 'rgba(64, 255, 64, 0.05)',
                    border: '1px solid rgba(64, 255, 64, 0.16)',
                    borderRadius: 999,
                    color: 'rgba(255, 255, 255, 0.8)',
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: '8px 12px',
                  }}
                >
                  Aegis - iOS
                </button>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              padding: '10px 12px',
              marginBottom: 12,
              borderRadius: 12,
              border: '1px solid rgba(255, 196, 64, 0.16)',
              background: 'rgba(255, 196, 64, 0.06)',
            }}>
              <div style={{
                flexShrink: 0,
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255, 214, 102, 0.92)',
                fontSize: 13,
                fontWeight: 700,
              }}>
                i
              </div>

              <p style={{
                color: 'rgba(255, 240, 204, 0.82)',
                fontSize: 11,
                lineHeight: 1.55,
                margin: 0,
                textAlign: 'left',
              }}>
                Amber may need notifications and unrestricted background activity enabled so it can receive and approve the follow-up login requests after the QR connects.
              </p>
            </div>

            {error && (
              <p style={{ color: '#ff4757', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>{error}</p>
            )}

            {authChallengeUrl && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => openExternalLink(authChallengeUrl)}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(64, 255, 64, 0.25)',
                    borderRadius: 8,
                    color: 'rgba(64, 255, 64, 0.85)',
                    cursor: 'pointer',
                    fontSize: 12,
                    padding: '8px 12px',
                  }}
                >
                  Open approval link
                </button>
              </div>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <button
                type="button"
                onClick={() => setQrSessionNonce((value) => value + 1)}
                disabled={qrBusy}
                style={{
                  background: 'none',
                  border: 'none',
                  color: qrBusy ? 'rgba(64, 255, 64, 0.2)' : 'rgba(64, 255, 64, 0.55)',
                  cursor: qrBusy ? 'default' : 'pointer',
                  fontSize: 12,
                  padding: 6,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => {
                  if (!qrBusy) e.currentTarget.style.color = 'rgba(64, 255, 64, 0.9)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = qrBusy ? 'rgba(64, 255, 64, 0.2)' : 'rgba(64, 255, 64, 0.55)';
                }}
              >
                Refresh QR
              </button>

              <button
                type="button"
                onClick={() => setShowQrAdvanced((value) => !value)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.45)',
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: 6,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.45)';
                }}
              >
                {showQrAdvanced ? 'Hide advanced' : 'Advanced'}
              </button>
            </div>

            {showQrAdvanced && (
              <div style={{
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(255, 255, 255, 0.02)',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 10,
                }}>
                  <button
                    type="button"
                    onClick={copyQrUri}
                    disabled={!connectURI}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: connectURI ? 'rgba(255, 255, 255, 0.58)' : 'rgba(255, 255, 255, 0.22)',
                      cursor: connectURI ? 'pointer' : 'default',
                      fontSize: 11,
                      padding: 6,
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => {
                      if (connectURI) e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = connectURI ? 'rgba(255, 255, 255, 0.58)' : 'rgba(255, 255, 255, 0.22)';
                    }}
                  >
                    Copy QR URI
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBunkerInput((value) => !value)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.58)',
                      cursor: 'pointer',
                      fontSize: 11,
                      padding: 6,
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.58)';
                    }}
                  >
                    {showBunkerInput ? 'Hide bunker URI' : 'Use bunker URI'}
                  </button>
                </div>

                {showBunkerInput && (
                  <form onSubmit={handleBunkerSubmit}>
                    <p style={{
                      color: 'rgba(255, 255, 255, 0.5)',
                      fontSize: 11,
                      lineHeight: 1.5,
                      marginTop: 0,
                      marginBottom: 8,
                      textAlign: 'center',
                    }}>
                      Paste a `bunker://` URI or NIP-05 bunker identifier to connect directly without using this QR session.
                    </p>

                    <input
                      type="text"
                      placeholder="bunker://... or user@domain.com"
                      value={bunkerInput}
                      onChange={(e) => setBunkerInput(e.target.value)}
                      className="login-input"
                      style={{ ...inputStyle, marginBottom: 10, fontSize: 12, fontFamily: 'monospace' }}
                      onFocus={e => e.target.style.borderColor = 'rgba(64, 255, 64, 0.3)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(64, 255, 64, 0.07)'}
                    />

                    <button
                      type="submit"
                      disabled={loading || !bunkerInput.trim()}
                      style={{
                        width: '100%',
                        padding: '11px 0',
                        borderRadius: 8,
                        border: 'none',
                        background: loading || !bunkerInput.trim() ? '#151a15' : '#40FF40',
                        color: loading || !bunkerInput.trim() ? '#506050' : '#050705',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: loading || !bunkerInput.trim() ? 'default' : 'pointer',
                      }}
                    >
                      {loading ? 'Connecting...' : 'Connect with bunker URI'}
                    </button>
                  </form>
                )}

                {qrUriCopyState && (
                  <p style={{
                    color: 'rgba(255, 255, 255, 0.45)',
                    fontSize: 11,
                    marginTop: 4,
                    marginBottom: 0,
                    textAlign: 'center',
                  }}>
                    {qrUriCopyState}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============ NSEC VIEW ============ */}
        {view === 'nsec' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <BackButton onClick={() => switchView('main')} />

            <div style={{ textAlign: 'center', marginBottom: 28, paddingTop: 8 }}>
              <div style={{
                margin: '0 auto 16px',
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(64, 255, 64, 0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(64, 255, 64, 0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <p style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: 12, fontWeight: 400,
                letterSpacing: '2px', textTransform: 'uppercase',
              }}>
                Sign in with key
              </p>
            </div>

            <form onSubmit={handleNsecSubmit}>
              <div style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                padding: '14px 16px',
                marginBottom: 16,
                borderRadius: 12,
                border: '1px solid rgba(255, 99, 99, 0.2)',
                background: 'rgba(255, 99, 99, 0.1)',
              }}>
                <div style={{
                  flexShrink: 0,
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff8f8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3l-8.47-14.14a2 2 0 0 0-3.42 0Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div>
                  <p style={{
                    color: '#ff9b9b',
                    fontSize: 13,
                    fontWeight: 700,
                    margin: '0 0 6px',
                  }}>
                    Warning: Private-key login is less secure.
                  </p>
                  <p style={{
                    color: 'rgba(255, 225, 225, 0.82)',
                    fontSize: 12,
                    lineHeight: 1.55,
                    margin: 0,
                  }}>
                    Use QR with Amber or another remote signer whenever possible. Only paste an `nsec` on a device you trust.
                  </p>
                </div>
              </div>

              <input
                type="password"
                placeholder="Paste your nsec here"
                value={nsecInput}
                onChange={(e) => setNsecInput(e.target.value)}
                autoFocus
                className="login-input"
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13 }}
                onFocus={e => e.target.style.borderColor = 'rgba(64, 255, 64, 0.3)'}
                onBlur={e => e.target.style.borderColor = 'rgba(64, 255, 64, 0.07)'}
              />

              <p style={{
                color: 'rgba(255, 255, 255, 0.3)',
                fontSize: 11, marginBottom: 16, lineHeight: 1.5,
              }}>
                /guild never sends your raw key off this machine. Private-key logins stay in memory only for this session and are cleared when the app closes. Use QR with Amber or another remote signer whenever possible.
              </p>

              {error && (
                <p style={{ color: '#ff4757', fontSize: 12, marginBottom: 12, wordBreak: 'break-word' }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !nsecInput.trim().startsWith('nsec1')}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 8,
                  border: 'none',
                  background: loading || !nsecInput.trim().startsWith('nsec1') ? '#151a15' : '#40FF40',
                  color: loading || !nsecInput.trim().startsWith('nsec1') ? '#506050' : '#050705',
                  fontSize: 14, fontWeight: 600,
                  cursor: loading ? 'wait' : 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {loading ? 'Connecting...' : 'Connect'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
