import React, { useEffect } from 'react';

export default function Modal({ onClose, title, children }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      data-modal-root="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        WebkitAppRegion: 'no-drag',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: 12,
          padding: 24,
          minWidth: 350,
          maxWidth: 450,
          width: 'min(450px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          border: '1px solid var(--border)',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)',
          animation: 'fadeIn 0.2s ease-out',
          WebkitAppRegion: 'no-drag',
        }}
      >
        <h3 style={{
          marginBottom: 16,
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
