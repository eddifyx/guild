import { useState, useEffect, useMemo } from 'react';
import { lookupUserByNpub } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useGuild } from '../../contexts/GuildContext';
import { trustUserNpub } from '../../crypto/identityDirectory.js';
import Modal from '../Common/Modal';
import Avatar from '../Common/Avatar';

function normalizeGuildMember(member) {
  return {
    id: member.id,
    username: member.username,
    npub: member.npub || null,
    avatar_color: member.avatar_color || member.avatarColor || null,
    avatarColor: member.avatarColor || member.avatar_color || null,
    profile_picture: member.profile_picture || member.profilePicture || null,
    profilePicture: member.profilePicture || member.profile_picture || null,
  };
}

export default function NewDMModal({ onClose, onSelect, onlineIds }) {
  const { user } = useAuth();
  const { currentGuildData, loading: guildLoading } = useGuild();
  const [search, setSearch] = useState('');
  const [manualResult, setManualResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [error, setError] = useState('');

  const guildMembers = useMemo(
    () => (currentGuildData?.members || [])
      .filter((member) => member.id !== user?.userId)
      .map(normalizeGuildMember),
    [currentGuildData, user?.userId]
  );

  const guildMemberIds = useMemo(
    () => new Set(guildMembers.map((member) => member.id)),
    [guildMembers]
  );

  useEffect(() => {
    let cancelled = false;
    const query = search.trim();
    setManualResult(null);

    if (!query.startsWith('npub1')) {
      setLookupLoading(false);
      return () => { cancelled = true; };
    }

    setLookupLoading(true);
    setError('');
    lookupUserByNpub(query)
      .then((result) => {
        if (cancelled) return;
        if (result?.id && result.id !== user?.userId && guildMemberIds.has(result.id)) {
          setManualResult({
            ...result,
            avatar_color: result.avatar_color || result.avatarColor || null,
            profile_picture: result.profile_picture || result.profilePicture || null,
          });
        } else if (result?.id && result.id !== user?.userId) {
          setManualResult(null);
          setError('Direct messages are only available with members of your current guild.');
        } else {
          setManualResult(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setManualResult(null);
          setError(err?.message || 'Unable to look up that npub');
        }
      })
      .finally(() => {
        if (!cancelled) setLookupLoading(false);
      });

    return () => { cancelled = true; };
  }, [guildMemberIds, search, user?.userId]);

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return guildMembers;
    return guildMembers.filter((contact) =>
      contact.username?.toLowerCase().includes(query) ||
      contact.npub?.toLowerCase().includes(query)
    );
  }, [guildMembers, search]);

  const handleTrustAndSelect = (selectedUser) => {
    if (selectedUser?.npub) {
      trustUserNpub(selectedUser.id, selectedUser.npub);
    }
    onSelect({ ...selectedUser, trustedBootstrap: true });
    onClose();
  };

  const handleOpenConversation = (selectedUser) => {
    onSelect({ ...selectedUser, trustedBootstrap: false });
    onClose();
  };

  const hasManualLookup = search.trim().startsWith('npub1');

  return (
    <Modal title="New Secure DM" onClose={onClose}>
      <input
        type="text"
        placeholder="Search guild members or paste npub..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); if (error) setError(''); }}
        autoFocus
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg-input)',
          color: 'var(--text-primary)',
          fontSize: 13,
          outline: 'none',
          marginBottom: 10,
          transition: 'border-color 0.2s',
        }}
        onFocus={e => e.target.style.borderColor = 'rgba(64, 255, 64, 0.3)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />

      <div style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.5, marginBottom: 12 }}>
        Secure DMs are only available with members of your current guild.
      </div>

      {error && (
        <div style={{
          marginBottom: 10,
          padding: '8px 10px',
          borderRadius: 8,
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: '#ef4444',
          fontSize: 11,
        }}>
          {error}
        </div>
      )}

      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {guildLoading && (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, padding: 8 }}>
            Loading guild members...
          </p>
        )}

        {!guildLoading && hasManualLookup && lookupLoading && (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, padding: 8 }}>
            Looking up npub...
          </p>
        )}

        {!guildLoading && hasManualLookup && !lookupLoading && manualResult && (
          <button
            onClick={() => handleTrustAndSelect(manualResult)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '8px 12px',
              border: '1px solid rgba(64,255,64,0.2)',
              borderRadius: 8,
              background: 'rgba(64,255,64,0.06)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 13,
              marginBottom: 8,
            }}
          >
            <Avatar username={manualResult.username} color={manualResult.avatar_color} size={28} profilePicture={manualResult.profile_picture} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500 }}>{manualResult.username}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {manualResult.npub.slice(0, 24)}...{manualResult.npub.slice(-6)}
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#40FF40' }}>
              Trust & Message
            </span>
          </button>
        )}

        {!guildLoading && !hasManualLookup && filteredContacts.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, padding: 8 }}>
            {guildMembers.length === 0
              ? 'No guild members available for DMs right now.'
              : 'No guild members found.'}
          </p>
        )}

        {!guildLoading && !hasManualLookup && filteredContacts.map((contact) => (
          <button
            key={contact.id}
            onClick={() => handleOpenConversation(contact)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              borderRadius: 6,
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 13,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <Avatar username={contact.username} color={contact.avatar_color} size={28} profilePicture={contact.profile_picture} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>{contact.username}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Start secure DM
              </div>
            </div>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: onlineIds.has(contact.id) ? 'var(--success)' : 'var(--text-muted)',
              boxShadow: onlineIds.has(contact.id) ? '0 0 4px rgba(0, 214, 143, 0.4)' : 'none',
            }} />
          </button>
        ))}
      </div>
    </Modal>
  );
}
