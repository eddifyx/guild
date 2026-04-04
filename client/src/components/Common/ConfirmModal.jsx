import React from 'react';
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.header}>
          <div style={danger ? styles.dangerIcon : styles.icon}>
            {danger ? '!' : '?'}
          </div>
          <div>
            <h3 style={styles.title}>{title}</h3>
            <p style={styles.message}>{message}</p>
          </div>
        </div>
        <div style={styles.actions}>
          <button onClick={onCancel} style={styles.cancelButton}>
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={danger ? styles.dangerButton : styles.confirmButton}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(3, 5, 3, 0.72)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    padding: 24,
  },
  modal: {
    width: 420,
    maxWidth: '100%',
    borderRadius: 18,
    padding: '26px 26px 22px',
    background: 'linear-gradient(180deg, rgba(10, 14, 10, 0.98), rgba(6, 9, 6, 0.98))',
    border: '1px solid rgba(64, 255, 64, 0.14)',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.58), inset 0 1px 0 rgba(255,255,255,0.03)',
    color: 'var(--text-primary)',
  },
  header: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(64, 255, 64, 0.1)',
    border: '1px solid rgba(64, 255, 64, 0.16)',
    color: '#40FF40',
    fontSize: 20,
    fontWeight: 700,
  },
  dangerIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#ff8f8f',
    fontSize: 20,
    fontWeight: 700,
  },
  title: {
    margin: '0 0 8px',
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  message: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
  },
  actions: {
    marginTop: 22,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    padding: '10px 18px',
    borderRadius: 10,
    border: '1px solid rgba(64, 255, 64, 0.16)',
    background: 'rgba(255,255,255,0.02)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: 14,
  },
  confirmButton: {
    padding: '10px 20px',
    borderRadius: 10,
    border: '1px solid rgba(64, 255, 64, 0.28)',
    background: '#40FF40',
    color: '#041004',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    boxShadow: '0 10px 30px rgba(64, 255, 64, 0.18)',
  },
  dangerButton: {
    padding: '10px 20px',
    borderRadius: 10,
    border: '1px solid rgba(239, 68, 68, 0.28)',
    background: 'rgba(239, 68, 68, 0.14)',
    color: '#ffb0b0',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
  },
};
