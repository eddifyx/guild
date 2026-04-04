import React from 'react';
import { buildGuildDiscoverCardState } from '../../features/guild/guildOnboardingModel.mjs';
import { styles } from './GuildOnboardingStyles.mjs';

export function GuildOnboardingDiscoverSection({
  publicGuilds,
  joining,
  onDiscoverClick,
  getFileUrlFn,
}) {
  if (!publicGuilds.length) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyText}>No guilds yet. Form your own or join one!</p>
      </div>
    );
  }

  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>Discover</h2>
      <div style={styles.grid}>
        {publicGuilds.map((guild) => {
          const cardState = buildGuildDiscoverCardState(guild);
          return (
            <button
              key={guild.id}
              onClick={() => onDiscoverClick(guild)}
              disabled={joining === guild.id}
              style={styles.card}
              onMouseEnter={(event) => {
                event.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.35)';
                event.currentTarget.style.boxShadow = '0 0 24px rgba(64, 255, 64, 0.12), inset 0 1px 0 rgba(64, 255, 64, 0.06)';
                event.currentTarget.style.transform = 'translateY(-2px)';
                event.currentTarget.style.background = 'linear-gradient(135deg, rgba(14, 17, 14, 0.95), rgba(21, 26, 21, 0.95))';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.borderColor = 'var(--border)';
                event.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
                event.currentTarget.style.transform = 'translateY(0)';
                event.currentTarget.style.background = 'linear-gradient(135deg, rgba(14, 17, 14, 0.8), rgba(21, 26, 21, 0.6))';
              }}
            >
              <div style={styles.cardIcon}>
                {guild.image_url ? (
                  <img src={getFileUrlFn(guild.image_url)} alt="" style={styles.cardImage} />
                ) : (
                  <span style={styles.cardInitial}>{cardState.initial}</span>
                )}
              </div>
              <div style={styles.cardInfo}>
                <span style={styles.cardName}>{guild.name}</span>
                <span style={styles.cardMeta}>{cardState.memberLabel}</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.5 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          );
        })}
      </div>
    </section>
  );
}
