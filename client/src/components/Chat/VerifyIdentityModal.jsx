import React, { useState, useEffect } from 'react';
import { getSafetyNumberForUser } from '../../crypto/fingerprint';
import { loadRemoteIdentityVerification, markIdentityVerified } from '../../crypto/signalClient';
import { isE2EInitialized } from '../../crypto/sessionManager';

export default function VerifyIdentityModal({ userId, username, onClose, onVerified }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [safetyNumber, setSafetyNumber] = useState(null);
  const [trustStatus, setTrustStatus] = useState(null); // 'new' | 'trusted' | 'key_changed'
  const [verified, setVerified] = useState(false);
  const [identityKey, setIdentityKey] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isE2EInitialized()) {
        setError('E2E encryption is not initialized');
        setLoading(false);
        return;
      }
      try {
        const { identityKey: keyBase64, trustState } = await loadRemoteIdentityVerification(userId);
        if (cancelled) return;
        setIdentityKey(keyBase64);
        setTrustStatus(trustState?.status || 'new');
        setVerified(!!trustState?.verified);

        const number = await getSafetyNumberForUser(userId, keyBase64);
        if (cancelled) return;
        setSafetyNumber(number);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load identity');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const handleVerify = async () => {
    if (!identityKey) return;
    try {
      const { identityKey: currentIdentityKey } = await loadRemoteIdentityVerification(userId);
      await markIdentityVerified(userId, currentIdentityKey);
      setIdentityKey(currentIdentityKey);
      setVerified(true);
      setTrustStatus('trusted');
      window.dispatchEvent(new CustomEvent('identity-verified', {
        detail: { userId, identityKey: currentIdentityKey },
      }));
      onVerified?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const displayName = username || 'this contact';
  const statusColor = trustStatus === 'key_changed' ? '#ef4444'
    : trustStatus === 'trusted' && verified ? '#40FF40'
    : '#f59e0b';

  const statusLabel = trustStatus === 'key_changed' ? 'KEY CHANGED'
    : verified ? 'Verified'
    : trustStatus === 'trusted' ? 'Trusted (Unverified)'
    : 'New Identity';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-secondary)', borderRadius: 12,
        border: '1px solid var(--border)', width: 420, maxWidth: '90vw',
        padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={statusColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              Verify Identity
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: 18, padding: 4,
          }}>&times;</button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Verify <strong style={{ color: 'var(--text-primary)' }}>{displayName}</strong>'s identity by comparing safety numbers in person or over a trusted channel.
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>
            Loading identity...
          </div>
        )}

        {error && (
          <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#ef4444', fontSize: 12, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
              padding: '8px 12px', borderRadius: 8,
              background: trustStatus === 'key_changed' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${trustStatus === 'key_changed' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: statusColor, flexShrink: 0,
                boxShadow: `0 0 6px ${statusColor}40`,
              }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>
                {statusLabel}
              </span>
            </div>

            {trustStatus === 'key_changed' && (
              <div style={{
                padding: 12, marginBottom: 16, borderRadius: 8,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                fontSize: 11, color: '#ef4444', lineHeight: 1.5,
              }}>
                This user's identity key has changed since you last communicated. This could mean they reinstalled the app, or someone may be intercepting your messages. Verify their identity before continuing.
              </div>
            )}

            {safetyNumber && (
              <div style={{
                padding: 16, borderRadius: 8, background: 'var(--bg-primary)',
                border: '1px solid var(--border)', marginBottom: 16,
              }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Safety Number
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '6px 12px', fontFamily: 'monospace', fontSize: 15,
                  fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center',
                }}>
                  {safetyNumber.split(' ').map((group, i) => (
                    <span key={i}>{group}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {!verified && (
                <button onClick={handleVerify} style={{
                  flex: 1, padding: '10px 16px', borderRadius: 8,
                  background: 'rgba(64, 255, 64, 0.15)', border: '1px solid rgba(64, 255, 64, 0.3)',
                  color: '#40FF40', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(64, 255, 64, 0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(64, 255, 64, 0.15)'}
                >
                  Mark as Verified
                </button>
              )}
              <button onClick={onClose} style={{
                flex: verified ? 1 : 0, padding: '10px 16px', borderRadius: 8,
                background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
              >
                {verified ? 'Done' : 'Close'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
