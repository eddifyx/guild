import React, { useState } from 'react';
import Modal from '../Common/Modal';

export default function CreateRoomModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onCreate(name.trim());
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <Modal title="Create Board" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Board name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={100}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
            marginBottom: 12,
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(64, 255, 64, 0.3)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
              transition: 'color 0.15s',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--accent)',
              color: '#050705',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              opacity: loading || !name.trim() ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Creating...' : 'Create Board'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
