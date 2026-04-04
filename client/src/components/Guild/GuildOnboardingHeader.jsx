import React from 'react';
import Avatar from '../Common/Avatar';
import { styles } from './GuildOnboardingStyles.mjs';

export function GuildOnboardingHeader({ user, onOpenProfile, onLogout }) {
  return (
    <div style={styles.header}>
      <div style={styles.headerLeft}>
        <h1 style={styles.brandMark}>/guild</h1>
        <span style={styles.subtitle}>Choose your path</span>
      </div>
      <div style={styles.headerRight}>
        <div onClick={onOpenProfile} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }} title="Edit Nostr profile">
          <Avatar username={user?.username || '?'} color={user?.avatarColor || '#40FF40'} size={28} profilePicture={user?.profilePicture} />
          <span style={styles.username}>{user?.username}</span>
        </div>
        <button onClick={onLogout} style={styles.logoutBtn}>Logout</button>
      </div>
    </div>
  );
}
