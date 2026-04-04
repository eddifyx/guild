import React from 'react';
import { styles } from './GuildSettingsModalStyles.mjs';

export function GuildSettingsOverviewEditView({
  guildName,
  setGuildName,
  guildDesc,
  setGuildDesc,
  guildPublic,
  setGuildPublic,
  guildImage,
  imgSrc,
  onImageSelect,
  onRemoveImage,
  uploadingImage,
  motd,
  setMotd,
  onSaveOverview,
  onSaveMotd,
  canManageTheme,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <label style={styles.label}>
        Guild Name
        <input value={guildName} onChange={(event) => setGuildName(event.target.value)} style={styles.input} maxLength={50} />
      </label>
      <label style={styles.label}>
        Description
        <textarea value={guildDesc} onChange={(event) => setGuildDesc(event.target.value)} style={{ ...styles.input, minHeight: 60, resize: 'vertical' }} maxLength={500} />
      </label>
      <label style={{ ...styles.label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={guildPublic} onChange={(event) => setGuildPublic(event.target.checked)} />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Public (discoverable)</span>
      </label>
      {canManageTheme && (
        <div style={styles.label}>
          <span>Guild Image</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
            <div style={styles.imagePreviewBox}>
              {imgSrc ? (
                <img src={imgSrc} alt="Guild" style={styles.uploadedImage} />
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={styles.uploadBtn}>
                {uploadingImage ? 'Uploading...' : 'Choose Image'}
                <input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={onImageSelect} disabled={uploadingImage} style={{ display: 'none' }} />
              </label>
              {guildImage && (
                <button type="button" onClick={onRemoveImage} disabled={uploadingImage} style={styles.removeBtn}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <button onClick={onSaveOverview} style={styles.primaryBtn}>Save Changes</button>

      <div style={styles.divider} />

      <label style={styles.label}>
        Message of the Day
        <textarea value={motd} onChange={(event) => setMotd(event.target.value)} style={{ ...styles.input, minHeight: 50, resize: 'vertical' }} maxLength={500} placeholder="Shown to members on login..." />
      </label>
      <button onClick={onSaveMotd} style={styles.secondaryBtn}>Update MotD</button>
    </div>
  );
}
