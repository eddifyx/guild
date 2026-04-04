import React from 'react';
import { styles } from './GuildSettingsModalStyles.mjs';

export function GuildSettingsOverviewReadOnlyView({
  guildName,
  guildDesc,
  guildPublic,
  motd,
  canModifyMotd,
  setMotd,
  onSaveMotd,
  imgSrc,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {imgSrc && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ ...styles.imagePreviewBox, borderRadius: 16 }}>
            <img src={imgSrc} alt="Guild" style={styles.uploadedImage} />
          </div>
        </div>
      )}
      <div>
        <div style={styles.infoLabel}>Name</div>
        <div style={styles.infoValue}>{guildName}</div>
      </div>
      {guildDesc && (
        <div>
          <div style={styles.infoLabel}>Description</div>
          <div style={{ ...styles.infoValue, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{guildDesc}</div>
        </div>
      )}
      <div>
        <div style={styles.infoLabel}>Visibility</div>
        <div style={styles.infoValue}>{guildPublic ? 'Public — anyone can discover and join' : 'Private — invite only'}</div>
      </div>
      <div style={styles.divider} />
      {canModifyMotd ? (
        <>
          <label style={styles.label}>
            Message of the Day
            <textarea value={motd} onChange={(event) => setMotd(event.target.value)} style={{ ...styles.input, minHeight: 50, resize: 'vertical' }} maxLength={500} placeholder="Shown to members on login..." />
          </label>
          <button onClick={onSaveMotd} style={styles.secondaryBtn}>Update MotD</button>
        </>
      ) : motd ? (
        <div>
          <div style={styles.infoLabel}>Message of the Day</div>
          <div style={{ ...styles.infoValue, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{motd}</div>
        </div>
      ) : null}
    </div>
  );
}
