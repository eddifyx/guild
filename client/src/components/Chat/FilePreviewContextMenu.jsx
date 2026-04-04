import React, { useEffect } from 'react';

export default function FilePreviewContextMenu({
  x,
  y,
  onCopyImage,
  onOpenInBrowser,
  onClose,
}) {
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('click', handler);
    window.addEventListener('contextmenu', handler);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('contextmenu', handler);
    };
  }, [onClose]);

  const menuItem = {
    padding: '6px 24px 6px 12px',
    fontSize: 12,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'none',
    border: 'none',
    width: '100%',
    textAlign: 'left',
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 9999,
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-strong)',
        borderRadius: 6,
        padding: '4px 0',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        minWidth: 160,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        style={menuItem}
        onClick={onCopyImage}
        onMouseEnter={(event) => {
          event.currentTarget.style.background = 'var(--bg-hover)';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = 'none';
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
        Copy Image
      </button>
      <button
        style={menuItem}
        onClick={onOpenInBrowser}
        onMouseEnter={(event) => {
          event.currentTarget.style.background = 'var(--bg-hover)';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = 'none';
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        Open in Browser
      </button>
    </div>
  );
}
