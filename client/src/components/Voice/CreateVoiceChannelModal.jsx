import { useEffect, useRef, useState } from 'react';
import Modal from '../Common/Modal';

export default function CreateVoiceChannelModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      const length = input.value?.length || 0;
      input.setSelectionRange(length, length);
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await onCreate(name.trim());
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Modal onClose={onClose} title="Create Voice Channel">
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          autoFocus
          value={name}
          onChange={e => { setName(e.target.value); setError(''); }}
          placeholder="Channel name"
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-primary)',
            fontSize: 13,
            marginBottom: 8,
            boxSizing: 'border-box',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(64, 255, 64, 0.3)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 12px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            style={{
              padding: '10px 14px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 6,
              color: '#050705',
              fontSize: 13,
              fontWeight: 600,
              cursor: name.trim() ? 'pointer' : 'not-allowed',
              opacity: name.trim() ? 1 : 0.5,
              transition: 'opacity 0.15s',
            }}
          >
            Create Channel
          </button>
        </div>
      </form>
    </Modal>
  );
}
