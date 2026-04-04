import React from 'react';
export function AssetDumpEmptyState({ styles }) {
  return (
    <div style={styles.emptyState}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
        <path d="M21 8v13H3V3h12l6 5z" />
        <path d="M14 3v6h6" />
      </svg>
      <span style={{ fontSize: 14, fontWeight: 500 }}>No assets yet</span>
      <span style={{ fontSize: 12 }}>Upload files to share with the group</span>
    </div>
  );
}
