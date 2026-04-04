import React from 'react';
export function AssetDownloadNotice({ downloadNotice, styles }) {
  if (!downloadNotice) return null;

  return (
    <div style={styles.notice}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span style={styles.noticeText}>
        Downloading <strong>{downloadNotice}</strong> to your Downloads folder
      </span>
    </div>
  );
}
