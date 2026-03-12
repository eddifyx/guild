const spinnerStyle = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: '2px solid rgba(64, 255, 64, 0.12)',
  borderTopColor: '#40FF40',
  animation: 'secure-boot-spin 0.8s linear infinite',
};

const buttonStyle = {
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid rgba(64, 255, 64, 0.18)',
  background: 'transparent',
  color: '#d7e6d7',
  fontSize: 13,
  cursor: 'pointer',
  transition: 'background 0.15s, border-color 0.15s, color 0.15s',
};

export default function SecureBlockedView({ mode, error, onRetry, onLogout }) {
  const booting = mode === 'booting';

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 30%, rgba(64, 255, 64, 0.03) 0%, #050705 72%)',
      padding: 24,
      WebkitAppRegion: 'drag',
    }}>
      <style>{`
        @keyframes secure-boot-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{
        width: 460,
        maxWidth: '100%',
        background: '#080a08',
        border: '1px solid rgba(64, 255, 64, 0.08)',
        borderRadius: 16,
        padding: '32px 28px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        color: '#e0e8e0',
        WebkitAppRegion: 'no-drag',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 18,
        }}>
          {booting ? (
            <div style={spinnerStyle} />
          ) : (
            <div style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.14)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
            }}>
              !
            </div>
          )}

          <div>
            <div style={{
              fontSize: 18,
              fontWeight: 700,
              color: booting ? '#40FF40' : '#ff8f8f',
              marginBottom: 4,
            }}>
              {booting ? 'Restoring Secure Session' : 'Secure Startup Blocked'}
            </div>
            <div style={{
              fontSize: 12,
              color: 'rgba(224, 232, 224, 0.6)',
              lineHeight: 1.5,
            }}>
              {booting
                ? 'Messages, files, voice, and screen share stay locked until end-to-end encryption is ready.'
                : 'The app will stay locked until secure startup succeeds. No messaging or media features are available in this state.'}
            </div>
          </div>
        </div>

        {!booting && (
          <div style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.18)',
            color: '#ffb0b0',
            fontSize: 12,
            lineHeight: 1.5,
            marginBottom: 18,
            wordBreak: 'break-word',
          }}>
            {error || 'E2E initialization failed for an unknown reason.'}
          </div>
        )}

        <div style={{
          fontSize: 12,
          color: 'rgba(224, 232, 224, 0.72)',
          lineHeight: 1.6,
          marginBottom: 20,
        }}>
          {booting
            ? 'If this does not complete, the signer may be unavailable or the local crypto state may need to be reopened.'
            : 'Retry secure startup after reconnecting your signer or fixing the local or server crypto issue. If you cannot restore the secure session, log out instead of using the app in a degraded state.'}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {!booting && (
            <button
              onClick={onRetry}
              style={{
                ...buttonStyle,
                background: 'rgba(64, 255, 64, 0.12)',
                borderColor: 'rgba(64, 255, 64, 0.28)',
                color: '#40FF40',
                fontWeight: 600,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64, 255, 64, 0.18)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(64, 255, 64, 0.12)'; }}
            >
              Retry Secure Startup
            </button>
          )}
          <button
            onClick={onLogout}
            style={buttonStyle}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.28)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.18)';
            }}
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
