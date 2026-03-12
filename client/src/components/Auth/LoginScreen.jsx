import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../contexts/AuthContext';
import { createNostrConnectSession } from '../../utils/nostrConnect';
import { setServerUrl, getServerUrl, isInsecureConnection } from '../../api';

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
  const { nostrLogin, nostrConnectLogin, nsecLogin } = useAuth();
  const abortRef = useRef(null);

  const [view, setView] = useState('main'); // 'main' | 'qr' | 'nsec' | 'bunker'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [server, setServer] = useState(getServerUrl());
  const [showServer, setShowServer] = useState(false);

  // QR view state
  const [connectURI, setConnectURI] = useState('');

  // nsec view state
  const [nsecInput, setNsecInput] = useState('');


  // Generate nostrconnect:// URI only when QR view is active
  useEffect(() => {
    if (view !== 'qr') return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const { uri, waitForConnection } = createNostrConnectSession(controller.signal);
    setConnectURI(uri);
    setError('');

    waitForConnection()
      .then(async (result) => {
        if (controller.signal.aborted) return;
        setLoading(true);
        try {
          await nostrConnectLogin(result);
          if (onLoginSuccess) onLoginSuccess();
        } catch (err) {
          setError(err.message || 'Login failed');
        }
        setLoading(false);
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        // Timeout or closed — just stay on QR view
      });

    return () => controller.abort();
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNsecSubmit = async (e) => {
    e.preventDefault();
    const trimmed = nsecInput.trim();
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


  const switchView = (v) => {
    setError('');
    setLoading(false);
    setView(v);
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 40%, rgba(64, 255, 64, 0.03) 0%, #050705 70%)',
      position: 'relative', overflow: 'hidden',
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
        padding: '48px 40px',
        borderRadius: 16,
        width: 400,
        border: '1px solid rgba(64, 255, 64, 0.07)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 80px rgba(64, 255, 64, 0.03)',
        WebkitAppRegion: 'no-drag',
        animation: 'fadeIn 0.4s ease-out',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* ============ MAIN VIEW ============ */}
        {view === 'main' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{
                fontSize: 28,
                fontWeight: 700,
                fontFamily: "'Geist', sans-serif",
                letterSpacing: '-1px',
                color: '#40FF40',
                textShadow: '0 0 12px rgba(64, 255, 64, 0.4)',
              }}>
                /guild
              </div>
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

            {/* Bottom links */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <button
                type="button"
                onClick={() => window.electronAPI?.openExternal('https://primal.net')}
                style={{
                  background: 'none', border: 'none',
                  color: 'rgba(64, 255, 64, 0.35)',
                  fontSize: 12, cursor: 'pointer',
                  padding: '4px 0', transition: 'color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(64, 255, 64, 0.7)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(64, 255, 64, 0.35)'}
              >
                New to Nostr?
              </button>

            </div>

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
              {loading ? 'Connecting...' : 'Open Amber or your Nostr signer and scan this code'}
            </p>

            {error && (
              <p style={{ color: '#ff4757', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>{error}</p>
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
                Your key is encrypted and stored securely on this device. It never leaves your machine.
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
