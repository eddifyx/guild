import { useState, useEffect, useRef, useCallback } from 'react';
import { getContacts, removeContact, sendFriendRequest, getIncomingRequests, getSentRequests, acceptFriendRequest, rejectFriendRequest, checkNpubs } from '../../api';
import { fetchProfile, searchProfiles } from '../../utils/nostr';
import { publishDM } from '../../nostr/profilePublisher';
import { useSocket } from '../../contexts/SocketContext';
import { nip19 } from 'nostr-tools';
import Avatar from '../Common/Avatar';

export default function FollowingModal({ onClose }) {
  const { socket } = useSocket();
  const [tab, setTab] = useState('friends');

  // Friends state
  const [contacts, setContacts] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [selected, setSelected] = useState(null);
  const [copied, setCopied] = useState(false);

  // Requests state
  const [incoming, setIncoming] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [actioningId, setActioningId] = useState(null);

  // Search state
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [guildNpubs, setGuildNpubs] = useState(new Set());
  const [sentNpubs, setSentNpubs] = useState(new Set());
  const [sendingNpub, setSendingNpub] = useState(null);
  const [searchMsg, setSearchMsg] = useState('');
  const [inviteMenuNpub, setInviteMenuNpub] = useState(null);
  const [sendingDM, setSendingDM] = useState(false);
  const searchTimer = useRef(null);

  const friendNpubs = new Set(contacts.map(c => c.contact_npub));

  // Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (selected) setSelected(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, selected]);

  // Load friends
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const list = await getContacts();
        if (cancelled) return;
        setContacts(list);
        setLoadingFriends(false);
        for (const c of list) {
          try {
            const decoded = nip19.decode(c.contact_npub);
            const prof = await fetchProfile(decoded.data);
            if (cancelled) return;
            if (prof) setProfiles(prev => ({ ...prev, [c.contact_npub]: prof }));
          } catch {}
        }
      } catch {
        if (!cancelled) setLoadingFriends(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Load incoming requests
  const loadRequests = useCallback(async () => {
    try {
      const list = await getIncomingRequests();
      setIncoming(list);
    } catch {}
    setLoadingRequests(false);
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  // Load sent requests (for showing "Pending" on search results)
  useEffect(() => {
    getSentRequests().then(list => {
      setSentNpubs(new Set(list.map(r => r.to_npub)));
    }).catch(() => {});
  }, []);

  // Socket: listen for new incoming requests
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      setIncoming(prev => [data, ...prev.filter(r => r.id !== data.id)]);
    };
    const acceptedHandler = () => {
      // Refresh friends list when someone accepts our request
      getContacts().then(setContacts).catch(() => {});
    };
    socket.on('friend:request-received', handler);
    socket.on('friend:request-accepted', acceptedHandler);
    return () => {
      socket.off('friend:request-received', handler);
      socket.off('friend:request-accepted', acceptedHandler);
    };
  }, [socket]);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      setGuildNpubs(new Set());
      return;
    }

    // If npub pasted, look up that specific profile
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
            about: '',
          }]);
        } catch {
          setSearchResults([]);
        }
        // Check if on /guild (separate so failure doesn't wipe results)
        try {
          const { registered } = await checkNpubs([q]);
          setGuildNpubs(new Set(registered));
        } catch {
          setGuildNpubs(new Set());
        }
        setSearching(false);
      }, 200);
      return () => clearTimeout(searchTimer.current);
    }

    // Name search
    setSearching(true);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      let results = [];
      try {
        results = await searchProfiles(q);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
      // Check which are /guild users (separate so failure doesn't wipe results)
      if (results.length > 0) {
        try {
          const npubs = results.map(r => r.npub);
          const { registered } = await checkNpubs(npubs);
          setGuildNpubs(new Set(registered));
        } catch {
          setGuildNpubs(new Set());
        }
      } else {
        setGuildNpubs(new Set());
      }
      setSearching(false);
    }, 400);

    return () => clearTimeout(searchTimer.current);
  }, [query]);

  const handleSendRequest = async (npub) => {
    setSendingNpub(npub);
    setSearchMsg('');
    try {
      await sendFriendRequest(npub);
      setSentNpubs(prev => new Set([...prev, npub]));
      setSearchMsg('Friend request sent!');
      setTimeout(() => setSearchMsg(''), 3000);
    } catch (err) {
      setSearchMsg(err.message || 'Failed to send request');
      setTimeout(() => setSearchMsg(''), 4000);
    }
    setSendingNpub(null);
  };

  const handleAccept = async (id) => {
    setActioningId(id);
    try {
      await acceptFriendRequest(id);
      setIncoming(prev => prev.filter(r => r.id !== id));
      // Refresh friends list
      const list = await getContacts();
      setContacts(list);
    } catch {}
    setActioningId(null);
  };

  const handleReject = async (id) => {
    setActioningId(id);
    try {
      await rejectFriendRequest(id);
      setIncoming(prev => prev.filter(r => r.id !== id));
    } catch {}
    setActioningId(null);
  };

  const handleRemove = async (npub) => {
    try {
      const updated = await removeContact(npub);
      setContacts(updated);
      if (selected?.contact_npub === npub) setSelected(null);
    } catch {}
  };

  const handleCopyNpub = (npub) => {
    navigator.clipboard.writeText(npub).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyInvite = () => {
    const text = `/guild — Nostr-native, end-to-end encrypted, and fully open source. Voice, chat rooms, streaming, and more — all built on your Nostr keys. No accounts, no middlemen. Download at https://guild.app`;
    navigator.clipboard.writeText(text).then(() => {
      setSearchMsg('Invite link copied!');
      setTimeout(() => setSearchMsg(''), 3000);
    });
    setInviteMenuNpub(null);
  };

  const handleSendNostrDM = async (npub) => {
    setSendingDM(true);
    setInviteMenuNpub(null);
    try {
      const decoded = nip19.decode(npub);
      const result = await publishDM(
        decoded.data,
        `Hey! Check out /guild — it's a Nostr-native platform where your keys are your identity. Fully end-to-end encrypted, open source, with voice chat, chat rooms, streaming, and guilds. No accounts needed — just your Nostr key. Download at https://guild.app`
      );
      if (result.ok) {
        setSearchMsg('Invite DM sent via Nostr!');
      } else {
        setSearchMsg(result.error || 'Failed to send DM');
      }
    } catch {
      setSearchMsg('Failed to send DM');
    }
    setSendingDM(false);
    setTimeout(() => setSearchMsg(''), 4000);
  };

  const getButtonForResult = (r) => {
    if (friendNpubs.has(r.npub)) {
      return <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>Friends</span>;
    }
    if (sentNpubs.has(r.npub)) {
      return <span style={{ fontSize: 11, color: 'var(--accent, #40FF40)', flexShrink: 0 }}>Pending</span>;
    }
    if (guildNpubs.has(r.npub)) {
      return (
        <button
          onClick={() => handleSendRequest(r.npub)}
          disabled={sendingNpub === r.npub}
          style={{ ...styles.actionBtn, opacity: sendingNpub === r.npub ? 0.5 : 1 }}
        >
          {sendingNpub === r.npub ? '...' : 'Send Request'}
        </button>
      );
    }
    return (
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setInviteMenuNpub(inviteMenuNpub === r.npub ? null : r.npub)}
          disabled={sendingDM}
          style={{ ...styles.actionBtn, background: 'var(--bg-tertiary, #333)', color: 'var(--text-primary)', opacity: sendingDM ? 0.5 : 1 }}
        >
          {sendingDM ? '...' : 'Invite'}
        </button>
        {inviteMenuNpub === r.npub && (
          <div style={styles.inviteMenu}>
            <button onClick={() => handleSendNostrDM(r.npub)} style={styles.inviteMenuItem}>
              Send via Nostr DM
            </button>
            <button onClick={handleCopyInvite} style={styles.inviteMenuItem}>
              Copy invite link
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div onClick={onClose} style={styles.overlay}>
      <div onClick={e => e.stopPropagation()} style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>Friends</h2>
          <button onClick={onClose} style={styles.closeBtn}>&times;</button>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {[
            { key: 'friends', label: 'Friends', count: contacts.length },
            { key: 'requests', label: 'Requests', count: incoming.length },
            { key: 'search', label: 'Search' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                ...styles.tabBtn,
                borderBottom: tab === t.key ? '2px solid var(--accent, #40FF40)' : '2px solid transparent',
                color: tab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {t.label}
              {t.count > 0 && (
                <span style={{
                  ...styles.badge,
                  background: t.key === 'requests' && tab !== 'requests' ? 'var(--accent, #40FF40)' : 'var(--bg-tertiary, #333)',
                  color: t.key === 'requests' && tab !== 'requests' ? '#000' : 'var(--text-secondary)',
                }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={styles.content}>
          {/* ===== SEARCH TAB ===== */}
          {tab === 'search' && (
            <>
              <div style={{ padding: '0 0 12px' }}>
                <input
                  type="text"
                  placeholder="Search by name or paste npub..."
                  value={query}
                  onChange={e => { setQuery(e.target.value); setSearchMsg(''); }}
                  style={styles.searchInput}
                  autoFocus
                />
                {searchMsg && (
                  <div style={{
                    fontSize: 11,
                    color: searchMsg.includes('!') ? 'var(--success, #40ff40)' : 'var(--error, #ff4040)',
                    marginTop: 4,
                  }}>
                    {searchMsg}
                  </div>
                )}
              </div>

              {searching ? (
                <div style={styles.emptyState}>Searching...</div>
              ) : query.trim().length >= 2 && searchResults.length === 0 ? (
                <div style={styles.emptyState}>No users found</div>
              ) : searchResults.length > 0 ? (
                searchResults.map(r => (
                  <div key={r.npub} style={styles.resultRow}>
                    <Avatar username={r.name || r.npub.slice(0, 8)} size={36} profilePicture={r.picture} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.nameText}>{r.name || r.npub.slice(0, 16) + '...'}</div>
                      {r.about && <div style={styles.aboutText}>{r.about}</div>}
                      <div style={styles.npubText}>{r.npub.slice(0, 20)}...{r.npub.slice(-6)}</div>
                    </div>
                    {getButtonForResult(r)}
                  </div>
                ))
              ) : (
                <div style={styles.emptyState}>Search for Nostr users by name or paste an npub</div>
              )}
            </>
          )}

          {/* ===== REQUESTS TAB ===== */}
          {tab === 'requests' && (
            <>
              {loadingRequests ? (
                <div style={styles.emptyState}>Loading...</div>
              ) : incoming.length === 0 ? (
                <div style={styles.emptyState}>No pending friend requests</div>
              ) : (
                incoming.map(r => (
                  <div key={r.id} style={styles.requestRow}>
                    <Avatar
                      username={r.from_username || r.from_npub?.slice(0, 8) || '?'}
                      size={40}
                      profilePicture={r.from_picture}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.nameText}>{r.from_username || 'Unknown'}</div>
                      {r.from_npub && (
                        <div style={styles.npubText}>{r.from_npub.slice(0, 20)}...{r.from_npub.slice(-6)}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleAccept(r.id)}
                        disabled={actioningId === r.id}
                        style={{ ...styles.actionBtn, opacity: actioningId === r.id ? 0.5 : 1 }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleReject(r.id)}
                        disabled={actioningId === r.id}
                        style={{
                          ...styles.actionBtn,
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          color: 'var(--text-secondary)',
                          opacity: actioningId === r.id ? 0.5 : 1,
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* ===== FRIENDS TAB ===== */}
          {tab === 'friends' && (
            <>
              {loadingFriends ? (
                <div style={styles.emptyState}>Loading friends...</div>
              ) : contacts.length === 0 ? (
                <div style={styles.emptyState}>No friends yet — search for someone in the Search tab</div>
              ) : (
                contacts.map(c => {
                  const prof = profiles[c.contact_npub];
                  const name = prof?.name || c.display_name || null;
                  const picture = prof?.picture || null;
                  const npub = c.contact_npub;

                  return (
                    <div key={npub}>
                      <button
                        onClick={() => { setSelected(selected?.contact_npub === npub ? null : c); setCopied(false); }}
                        style={{
                          ...styles.contactRow,
                          background: selected?.contact_npub === npub ? 'var(--bg-active)' : 'transparent',
                        }}
                        onMouseEnter={e => { if (selected?.contact_npub !== npub) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { if (selected?.contact_npub !== npub) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <Avatar username={name || npub.slice(0, 8)} size={36} profilePicture={picture} />
                        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                          <div style={styles.nameText}>{name || npub.slice(0, 16) + '...'}</div>
                          <div style={styles.npubText}>{npub.slice(0, 20)}...{npub.slice(-6)}</div>
                        </div>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.3, transform: selected?.contact_npub === npub ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>

                      {selected?.contact_npub === npub && (
                        <div style={styles.profileCard}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                            <Avatar username={name || npub.slice(0, 8)} size={52} profilePicture={picture} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                                {name || 'Unknown'}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {npub.slice(0, 24)}...{npub.slice(-6)}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => handleCopyNpub(npub)} style={styles.cardBtn}
                              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
                              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                            >
                              {copied ? (
                                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Copied</>
                              ) : (
                                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>Copy npub</>
                              )}
                            </button>
                            <button
                              onClick={() => window.electronAPI?.openExternal(`https://primal.net/p/${npub}`)}
                              style={styles.cardBtn}
                              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
                              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                              View on Primal
                            </button>
                            <button
                              onClick={() => handleRemove(npub)}
                              style={{ ...styles.cardBtn, color: 'var(--error, #ff4040)' }}
                              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--error, #ff4040)'}
                              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
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
  badge: {
    fontSize: 10, fontWeight: 700,
    padding: '1px 6px', borderRadius: 10,
    minWidth: 18, textAlign: 'center',
  },
  content: {
    flex: 1, overflowY: 'auto',
    padding: '12px 16px 16px',
  },
  searchInput: {
    width: '100%', padding: '8px 12px',
    borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--bg-input)', color: 'var(--text-primary)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  },
  resultRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '8px', borderRadius: 8,
  },
  requestRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 8px', borderRadius: 8,
  },
  contactRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '8px', borderRadius: 8, cursor: 'pointer',
    width: '100%', border: 'none', color: 'inherit',
    fontSize: 'inherit', transition: 'background 0.15s',
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
  aboutText: {
    fontSize: 11, color: 'var(--text-muted)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  actionBtn: {
    padding: '5px 12px', borderRadius: 6, border: 'none',
    background: 'var(--accent, #40FF40)', color: '#000',
    fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  emptyState: {
    padding: 40, textAlign: 'center',
    color: 'var(--text-muted)', fontSize: 13,
  },
  profileCard: {
    margin: '0 8px 8px', padding: 14, borderRadius: 8,
    background: 'var(--bg-primary)', border: '1px solid var(--border)',
  },
  inviteMenu: {
    position: 'absolute', right: 0, top: '100%', marginTop: 4,
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    zIndex: 10, overflow: 'hidden', minWidth: 160,
  },
  inviteMenuItem: {
    display: 'block', width: '100%', padding: '8px 14px',
    background: 'none', border: 'none', color: 'var(--text-primary)',
    fontSize: 12, textAlign: 'left', cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  cardBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 10px', borderRadius: 6,
    border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--text-secondary)', fontSize: 11,
    cursor: 'pointer', transition: 'border-color 0.15s',
  },
};
