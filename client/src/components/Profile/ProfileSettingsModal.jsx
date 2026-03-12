import { useState, useEffect, useRef } from 'react';
import { fetchCurrentProfile, publishProfile, uploadImage } from '../../nostr/profilePublisher';
import { useAuth } from '../../contexts/AuthContext';
import { nip19 } from 'nostr-tools';
import Avatar from '../Common/Avatar';

export default function ProfileSettingsModal({ onClose }) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.username || '');
  const [about, setAbout] = useState('');
  const [picture, setPicture] = useState(user?.profilePicture || '');
  const [banner, setBanner] = useState('');
  const [lud16, setLud16] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef();

  // Fetch existing profile on mount
  useEffect(() => {
    let fallbackPk = null;
    try { if (user?.npub) fallbackPk = nip19.decode(user.npub).data; } catch {}
    fetchCurrentProfile(fallbackPk).then(profile => {
      if (profile) {
        setName(profile.name || '');
        setAbout(profile.about || '');
        setPicture(profile.picture || '');
        setBanner(profile.banner || '');
        setLud16(profile.lud16 || '');
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const url = await uploadImage(file);
      setPicture(url);
    } catch (err) {
      setError('Image upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    const result = await publishProfile({ name, about, picture, banner, lud16 });
    if (result.ok) {
      setSuccess('Profile published to Nostr relays');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(result.error || 'Publish failed');
    }
    setSaving(false);
  };

  return (
    <div onClick={onClose} style={styles.overlay}>
      <div onClick={e => e.stopPropagation()} style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>Nostr Profile</h2>
          <button onClick={onClose} style={styles.closeBtn}>&times;</button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px', padding: '0 20px' }}>
          Your Nostr profile (kind:0) is published to public relays. Changes will be visible in Primal, Damus, and other Nostr clients.
        </p>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading profile from relays...
          </div>
        ) : (
          <div style={styles.content}>
            {/* Profile picture */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              {picture ? (
                <img src={picture} alt="Profile" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
              ) : (
                <Avatar username={user?.username || '?'} color={user?.avatarColor || '#40FF40'} size={64} profilePicture={user?.profilePicture} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  style={styles.secondaryBtnSmall}
                >
                  {uploading ? 'Uploading...' : 'Upload Picture'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                {picture && (
                  <button onClick={() => setPicture('')} style={{ ...styles.secondaryBtnSmall, color: 'var(--text-muted)', fontSize: 11 }}>
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Fields */}
            <label style={styles.label}>
              Display Name
              <input value={name} onChange={e => setName(e.target.value)} style={styles.input} maxLength={50} placeholder="Your name" />
            </label>

            <label style={styles.label}>
              Bio
              <textarea value={about} onChange={e => setAbout(e.target.value)} style={{ ...styles.input, minHeight: 60, resize: 'vertical' }} maxLength={250} placeholder="About you..." />
            </label>

            <label style={styles.label}>
              Picture URL
              <input value={picture} onChange={e => setPicture(e.target.value)} style={styles.input} placeholder="https://..." />
            </label>

            <label style={styles.label}>
              Banner URL
              <input value={banner} onChange={e => setBanner(e.target.value)} style={styles.input} placeholder="https://..." />
            </label>

            <label style={styles.label}>
              Lightning Address (LUD-16)
              <input value={lud16} onChange={e => setLud16(e.target.value)} style={styles.input} placeholder="you@wallet.com" />
            </label>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={onClose} style={styles.secondaryBtn}>Cancel</button>
              <button onClick={handlePublish} disabled={saving} style={{ ...styles.primaryBtn, opacity: saving ? 0.5 : 1 }}>
                {saving ? 'Publishing...' : 'Publish to Nostr'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--bg-secondary)',
    borderRadius: 12,
    border: '1px solid var(--border)',
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)',
    width: 440,
    maxWidth: '90vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    animation: 'fadeIn 0.2s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px 8px',
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 22,
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 20px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-muted)',
  },
  input: {
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  primaryBtn: {
    padding: '10px 16px',
    borderRadius: 6,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '10px 16px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 13,
    cursor: 'pointer',
  },
  secondaryBtnSmall: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 12,
    cursor: 'pointer',
  },
  error: {
    margin: '0 20px 8px',
    padding: '8px 12px',
    borderRadius: 6,
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid var(--danger)',
    color: 'var(--danger)',
    fontSize: 12,
  },
  success: {
    margin: '0 20px 8px',
    padding: '8px 12px',
    borderRadius: 6,
    background: 'rgba(0, 214, 143, 0.1)',
    border: '1px solid var(--success)',
    color: 'var(--success)',
    fontSize: 12,
  },
};
