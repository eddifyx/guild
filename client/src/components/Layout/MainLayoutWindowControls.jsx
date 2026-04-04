import React from 'react';
export function MainLayoutWindowControls({
  updateButtonState = null,
  onUpdateButtonClick = () => {},
  onWindowMinimize = () => {},
  onWindowMaximize = () => {},
  onWindowClose = () => {},
} = {}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, height: '100%', WebkitAppRegion: 'no-drag' }}>
      <button
        onClick={onUpdateButtonClick}
        title={updateButtonState?.title || 'Check for updates'}
        style={{
          background: updateButtonState?.highlighted ? 'rgba(0, 214, 143, 0.15)' : 'none',
          border: 'none',
          color: updateButtonState?.highlighted ? 'var(--success)' : 'var(--text-muted)',
          cursor: 'pointer',
          padding: '0 12px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          transition: 'color 0.15s, background 0.15s',
          animation: updateButtonState?.highlighted ? 'pulse-glow-green 2s ease-in-out infinite' : 'none',
          fontSize: 10,
        }}
        onMouseEnter={(event) => {
          if (updateButtonState?.highlighted) {
            event.currentTarget.style.background = 'rgba(0, 214, 143, 0.25)';
          } else {
            event.currentTarget.style.color = 'var(--text-secondary)';
            event.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          }
        }}
        onMouseLeave={(event) => {
          if (updateButtonState?.highlighted) {
            event.currentTarget.style.background = 'rgba(0, 214, 143, 0.15)';
          } else {
            event.currentTarget.style.color = 'var(--text-muted)';
            event.currentTarget.style.background = 'none';
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7,10 12,15 17,10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
      <button
        onClick={onWindowMinimize}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '0 14px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(event) => { event.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
        onMouseLeave={(event) => { event.currentTarget.style.background = 'none'; }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <button
        onClick={onWindowMaximize}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '0 14px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(event) => { event.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
        onMouseLeave={(event) => { event.currentTarget.style.background = 'none'; }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="1.5" y="1.5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
      </button>
      <button
        onClick={onWindowClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '0 14px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.background = '#e81123';
          event.currentTarget.style.color = '#fff';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = 'none';
          event.currentTarget.style.color = 'var(--text-muted)';
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1" />
          <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  );
}
