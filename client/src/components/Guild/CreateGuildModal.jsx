import { useState } from 'react';
import { useGuilds } from '../../hooks/useGuilds';
import { useGuild } from '../../contexts/GuildContext';

export default function CreateGuildModal({ onClose, onCreated }) {
  const { createGuild } = useGuilds();
  const { myGuild } = useGuild();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setError('');
    try {
      const guild = await createGuild({
        name: name.trim(),
        description: description.trim(),
        is_public: isPublic,
      });
      onCreated(guild);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 style={styles.title}>Form Guild</h2>
        <p style={styles.subtitle}>Create your own community</p>

        {myGuild && (
          <div style={styles.warning}>
            Forming a new guild will leave <strong style={{ color: 'var(--accent)' }}>{myGuild.name}</strong>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Guild Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter guild name..."
              maxLength={100}
              style={styles.input}
              autoFocus
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this guild about?"
              maxLength={500}
              rows={3}
              style={{ ...styles.input, resize: 'vertical', minHeight: 80 }}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.toggleRow}>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={e => setIsPublic(e.target.checked)}
                style={styles.checkbox}
              />
              <span>Public guild</span>
              <span style={styles.toggleHint}>
                {isPublic ? 'Anyone can discover and join' : 'Invite-only — share your invite code'}
              </span>
            </label>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>Cancel</button>
            <button type="submit" disabled={!name.trim() || creating} style={styles.submitBtn}>
              {creating ? 'Creating...' : 'Form Guild'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 32,
    width: 440,
    maxWidth: '90vw',
    fontFamily: "'Geist', sans-serif",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text-muted)',
    marginBottom: 24,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 14,
    fontFamily: "'Geist', sans-serif",
    outline: 'none',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 14,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    flexWrap: 'wrap',
  },
  checkbox: {
    width: 18,
    height: 18,
    accentColor: 'var(--accent)',
  },
  toggleHint: {
    width: '100%',
    fontSize: 12,
    color: 'var(--text-muted)',
    marginLeft: 28,
  },
  warning: {
    padding: '12px 16px',
    borderRadius: 8,
    background: 'rgba(64, 255, 64, 0.04)',
    border: '1px solid rgba(64, 255, 64, 0.15)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 1.4,
    backdropFilter: 'blur(6px)',
  },
  error: {
    color: 'var(--danger)',
    fontSize: 13,
    marginBottom: 16,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    padding: '8px 20px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: "'Geist', sans-serif",
  },
  submitBtn: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    padding: '8px 24px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Geist', sans-serif",
  },
};
