import React from 'react';
import { styles } from './LoginCreateStyles.mjs';

export function LoginCreateHeader() {
  return (
    <div style={styles.header}>
      <div style={styles.brand}>/guild</div>
      <p style={styles.introText}>
        This works differently than a normal email and password login. You create keys that you control, then set the profile people will see.
      </p>
    </div>
  );
}
