import React, { useState, useEffect, useRef } from 'react';
import { useGuild } from '../../contexts/GuildContext';
import { useGuilds } from '../../hooks/useGuilds';
import { fetchProfile, searchProfiles } from '../../utils/nostr';
import { publishDM } from '../../nostr/profilePublisher';
import { nip19 } from 'nostr-tools';
import {
  InviteGuildModalCodePanel,
  InviteGuildModalNostrPanel,
  InviteGuildModalTabs,
} from './InviteGuildModalPanels.jsx';

export default function InviteGuildModal({ onClose }) {
  const { currentGuild, currentGuildData } = useGuild();
  const { getInviteCode, regenerateInvite } = useGuilds();
  const [tab, setTab] = useState('code');

  // Code tab state
  const [inviteCode, setInviteCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(true);
  const [codeError, setCodeError] = useState('');
  const [copied, setCopied] = useState('');

  // Nostr DM tab state
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sendingNpub, setSendingNpub] = useState(null);
  const [dmMsg, setDmMsg] = useState('');
  const searchTimer = useRef(null);

  // Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Fetch invite code on mount
  useEffect(() => {
    if (!currentGuild) return;
    (async () => {
      try {
        const code = await getInviteCode(currentGuild);
        setInviteCode(code);
      } catch (err) {
        setCodeError(err.message || 'Failed to load invite code');
      }
      setCodeLoading(false);
    })();
  }, [currentGuild, getInviteCode]);

  const handleCopyCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied('code');
    setTimeout(() => setCopied(''), 2000);
  };

  const handleCopyMessage = () => {
    if (!inviteCode) return;
    const guildName = currentGuildData?.name || 'my guild';
    const text = `Join my guild "${guildName}" on /guild! Invite code: ${inviteCode}`;
    navigator.clipboard.writeText(text);
    setCopied('message');
    setTimeout(() => setCopied(''), 2000);
  };

  const handleRegenerate = async () => {
    try {
      const code = await regenerateInvite(currentGuild);
      setInviteCode(code);
      setCopied('regen');
      setTimeout(() => setCopied(''), 2000);
    } catch (err) {
      setCodeError(err.message || 'Failed to regenerate');
    }
  };

  // Debounced search for Nostr DM tab
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    if (q.startsWith('npub1')) {
      setSearching(true);
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(async () => {
        try {
          const decoded = nip19.decode(q);
          const prof = await fetchProfile(decoded.data);
          setSearchResults([{
            npub: q,
            name: prof?.name || null,
            picture: prof?.picture || null,
          }]);
        } catch {
          setSearchResults([]);
        }
        setSearching(false);
      }, 200);
      return () => clearTimeout(searchTimer.current);
    }

    setSearching(true);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchProfiles(q);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 400);

    return () => clearTimeout(searchTimer.current);
  }, [query]);

  const handleSendDM = async (npub) => {
    setSendingNpub(npub);
    setDmMsg('');
    try {
      const decoded = nip19.decode(npub);
      const guildName = currentGuildData?.name || 'my guild';
      const result = await publishDM(
        decoded.data,
        `Hey! Join my guild "${guildName}" on /guild — Nostr-native, encrypted, open source. Invite code: ${inviteCode}. Download at https://guild.app`
      );
      if (result.ok) {
        setDmMsg('Invite sent!');
      } else {
        setDmMsg(result.error || 'Failed to send');
      }
    } catch {
      setDmMsg('Failed to send invite');
    }
    setSendingNpub(null);
    setTimeout(() => setDmMsg(''), 4000);
  };

  return (
    <div onClick={onClose} style={styles.overlay}>
      <div onClick={e => e.stopPropagation()} style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>Invite to {currentGuildData?.name || 'Guild'}</h2>
          <button onClick={onClose} style={styles.closeBtn}>&times;</button>
        </div>

        <InviteGuildModalTabs tab={tab} setTab={setTab} styles={styles} />

        <div style={styles.content}>
          {tab === 'code' && (
            <InviteGuildModalCodePanel
              inviteCode={inviteCode}
              codeLoading={codeLoading}
              codeError={codeError}
              copied={copied}
              styles={styles}
              onCopyCode={handleCopyCode}
              onCopyMessage={handleCopyMessage}
              onRegenerate={handleRegenerate}
            />
          )}

          {tab === 'nostr' && (
            <InviteGuildModalNostrPanel
              query={query}
              setQuery={(value) => {
                setQuery(value);
                setDmMsg('');
              }}
              dmMsg={dmMsg}
              inviteCode={inviteCode}
              codeLoading={codeLoading}
              searching={searching}
              searchResults={searchResults}
              styles={styles}
              sendingNpub={sendingNpub}
              onSendDM={handleSendDM}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--bg-secondary)',
    borderRadius: 12, border: '1px solid var(--border)',
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)',
    width: 440, maxWidth: '90vw', maxHeight: '80vh',
    display: 'flex', flexDirection: 'column',
    animation: 'fadeIn 0.2s ease-out',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px 8px',
  },
  title: { fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)',
    fontSize: 22, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
  },
  tabs: {
    display: 'flex', gap: 0, padding: '0 20px',
    borderBottom: '1px solid var(--border)',
  },
  tabBtn: {
    background: 'none', border: 'none',
    padding: '8px 16px', cursor: 'pointer',
    fontSize: 13, fontWeight: 500,
    display: 'flex', alignItems: 'center', gap: 6,
    transition: 'color 0.15s',
  },
  content: {
    flex: 1, overflowY: 'auto',
    padding: '16px 20px 20px',
  },
  codeInput: {
    flex: 1, padding: '8px 12px',
    borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--bg-input)', color: 'var(--text-primary)',
    fontSize: 14, fontFamily: "'Geist Mono', monospace",
    letterSpacing: '1px', outline: 'none',
  },
  searchInput: {
    width: '100%', padding: '8px 12px',
    borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--bg-input)', color: 'var(--text-primary)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  },
  actionBtn: {
    padding: '6px 14px', borderRadius: 6, border: 'none',
    background: 'var(--accent, #40FF40)', color: '#000',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  secondaryBtn: {
    padding: '8px 14px', borderRadius: 6,
    border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--text-secondary)', fontSize: 12,
    cursor: 'pointer', transition: 'border-color 0.15s',
    textAlign: 'center',
  },
  resultRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '8px', borderRadius: 8,
  },
  nameText: {
    fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  npubText: {
    fontSize: 11, color: 'var(--text-muted)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    fontFamily: 'monospace',
  },
  emptyState: {
    padding: 30, textAlign: 'center',
    color: 'var(--text-muted)', fontSize: 13,
  },
};
