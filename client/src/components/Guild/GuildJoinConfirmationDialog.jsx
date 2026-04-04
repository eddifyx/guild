import React from 'react';
import { buildGuildJoinConfirmationState } from '../../features/guild/guildOnboardingModel.mjs';
import { styles } from './GuildOnboardingStyles.mjs';

export function GuildJoinConfirmationDialog({ guild, onCancel, onConfirm, getFileUrlFn }) {
  if (!guild) {
    return null;
  }

  const confirmationState = buildGuildJoinConfirmationState(guild);

  return (
    <div style={styles.confirmOverlay} onClick={onCancel}>
      <div style={styles.confirmModal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.confirmIcon}>
          {guild.image_url ? (
            <img src={getFileUrlFn(guild.image_url)} alt="" style={styles.cardImage} />
          ) : (
            <span style={styles.confirmInitial}>{confirmationState.initial}</span>
          )}
        </div>
        <h3 style={styles.confirmTitle}>{confirmationState.title}</h3>
        <p style={styles.confirmDesc}>{confirmationState.description}</p>
        <div style={styles.confirmActions}>
          <button
            onClick={onCancel}
            style={styles.confirmCancelBtn}
            onMouseEnter={(event) => {
              event.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.2)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={styles.confirmJoinBtn}
            onMouseEnter={(event) => {
              event.currentTarget.style.boxShadow = '0 0 20px rgba(64, 255, 64, 0.3)';
              event.currentTarget.style.background = '#33cc33';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.boxShadow = 'none';
              event.currentTarget.style.background = '#40FF40';
            }}
          >
            Join Guild
          </button>
        </div>
      </div>
    </div>
  );
}
