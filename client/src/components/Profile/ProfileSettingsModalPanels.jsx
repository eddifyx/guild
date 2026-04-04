import React from 'react';
import Avatar from '../Common/Avatar';

export function ProfileSettingsHeader({ onClose, styles }) {
  return (
    <div style={styles.header}>
      <h2 style={styles.title}>Nostr Profile</h2>
      <button onClick={onClose} style={styles.closeBtn}>&times;</button>
    </div>
  );
}

export function ProfileSettingsIntro({ styles }) {
  return (
    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px', padding: '0 20px' }}>
      Your Nostr profile (kind:0) is published to public relays. Changes will be visible in Primal, Damus, and other Nostr clients.
    </p>
  );
}

export function ProfileSettingsStatusMessage({ tone, children, styles }) {
  return <div style={tone === 'error' ? styles.error : styles.success}>{children}</div>;
}

export function ProfileSettingsLoadingState() {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      Loading profile from relays...
    </div>
  );
}

export function ProfileSettingsForm({
  user,
  name,
  setName,
  about,
  setAbout,
  picture,
  setPicture,
  banner,
  setBanner,
  lud16,
  setLud16,
  fileRef,
  uploading,
  saving,
  onClose,
  onImageUpload,
  onPublish,
  styles,
}) {
  return (
    <div style={styles.content}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        {picture ? (
          <img
            src={picture}
            alt="Profile"
            style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
          />
        ) : (
          <Avatar
            username={name || user?.username || '?'}
            color={user?.avatarColor || '#40FF40'}
            size={64}
            profilePicture={null}
          />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={styles.secondaryBtnSmall}
          >
            {uploading ? 'Uploading...' : 'Upload Picture'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onImageUpload} style={{ display: 'none' }} />
          {picture && (
            <button onClick={() => setPicture('')} style={{ ...styles.secondaryBtnSmall, color: 'var(--text-muted)', fontSize: 11 }}>
              Remove
            </button>
          )}
        </div>
      </div>

      <label style={styles.label}>
        Display Name
        <input value={name} onChange={(event) => setName(event.target.value)} style={styles.input} maxLength={50} placeholder="Your name" />
      </label>

      <label style={styles.label}>
        Bio
        <textarea value={about} onChange={(event) => setAbout(event.target.value)} style={{ ...styles.input, minHeight: 60, resize: 'vertical' }} maxLength={250} placeholder="About you..." />
      </label>

      <label style={styles.label}>
        Picture URL
        <input value={picture} onChange={(event) => setPicture(event.target.value)} style={styles.input} placeholder="https://..." />
      </label>

      <label style={styles.label}>
        Banner URL
        <input value={banner} onChange={(event) => setBanner(event.target.value)} style={styles.input} placeholder="https://..." />
      </label>

      <label style={styles.label}>
        Lightning Address (LUD-16)
        <input value={lud16} onChange={(event) => setLud16(event.target.value)} style={styles.input} placeholder="you@wallet.com" />
      </label>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={onClose} style={styles.secondaryBtn}>Cancel</button>
        <button onClick={onPublish} disabled={saving} style={{ ...styles.primaryBtn, opacity: saving ? 0.5 : 1 }}>
          {saving ? 'Publishing...' : 'Publish to Nostr'}
        </button>
      </div>
    </div>
  );
}
