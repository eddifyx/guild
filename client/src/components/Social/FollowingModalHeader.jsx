import React from 'react';
import { styles } from './FollowingModalStyles.mjs';

export function FollowingModalHeader({ onClose }) {
  return (
    <div style={styles.header}>
      <h2 style={styles.title}>Friends</h2>
      <button onClick={onClose} style={styles.closeBtn}>&times;</button>
    </div>
  );
}
