import React from 'react';
export default function OnlineBadge({ online, size = 10 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: online ? 'var(--success)' : 'var(--text-muted)',
        border: '2px solid var(--bg-secondary)',
        position: 'absolute',
        bottom: 0,
        right: 0,
      }}
    />
  );
}
