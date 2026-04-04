import React from 'react';
import { styles } from './GuildOnboardingStyles.mjs';

export function GuildOnboardingActions({ onCreateGuild, onJoinGuild }) {
  return (
    <div style={styles.actions}>
      <button
        onClick={onCreateGuild}
        style={styles.formGuildBtn}
        onMouseEnter={(event) => {
          event.currentTarget.style.boxShadow = '0 0 20px rgba(64, 255, 64, 0.3)';
          event.currentTarget.style.background = '#33cc33';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.boxShadow = 'none';
          event.currentTarget.style.background = '#40FF40';
        }}
      >
        + Form Guild
      </button>
      <button
        onClick={onJoinGuild}
        style={styles.joinBtn}
        onMouseEnter={(event) => {
          event.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.3)';
          event.currentTarget.style.background = 'rgba(64, 255, 64, 0.06)';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.borderColor = 'var(--border)';
          event.currentTarget.style.background = 'var(--bg-tertiary)';
        }}
      >
        Join Guild
      </button>
    </div>
  );
}
