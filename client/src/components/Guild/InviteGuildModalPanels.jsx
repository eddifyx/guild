import React from 'react';
import Avatar from '../Common/Avatar';

function InviteGuildSearchResultRow({
  result,
  inviteCode,
  sendingNpub,
  styles,
  onSendDM,
}) {
  return (
    <div key={result.npub} style={styles.resultRow}>
      <Avatar username={result.name || result.npub.slice(0, 8)} size={36} profilePicture={result.picture} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.nameText}>{result.name || result.npub.slice(0, 16) + '...'}</div>
        <div style={styles.npubText}>{result.npub.slice(0, 20)}...{result.npub.slice(-6)}</div>
      </div>
      <button
        onClick={() => onSendDM(result.npub)}
        disabled={sendingNpub === result.npub || !inviteCode}
        style={{
          ...styles.actionBtn,
          opacity: (sendingNpub === result.npub || !inviteCode) ? 0.5 : 1,
        }}
      >
        {sendingNpub === result.npub ? '...' : 'Send Invite'}
      </button>
    </div>
  );
}

export function InviteGuildModalTabs({
  tab,
  setTab,
  styles,
}) {
  return (
    <div style={styles.tabs}>
      {[
        { key: 'code', label: 'Invite Code' },
        { key: 'nostr', label: 'Nostr DM' },
      ].map((item) => (
        <button
          key={item.key}
          onClick={() => setTab(item.key)}
          style={{
            ...styles.tabBtn,
            borderBottom: tab === item.key ? '2px solid var(--accent, #40FF40)' : '2px solid transparent',
            color: tab === item.key ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function InviteGuildModalCodePanel({
  inviteCode,
  codeLoading,
  codeError,
  copied,
  styles,
  onCopyCode,
  onCopyMessage,
  onRegenerate,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Share this invite code to let others join your guild.
      </div>

      {codeLoading ? (
        <div style={styles.emptyState}>Loading...</div>
      ) : codeError ? (
        <div style={{ fontSize: 12, color: 'var(--error, #ff4040)' }}>{codeError}</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              readOnly
              value={inviteCode || 'No invite code'}
              style={styles.codeInput}
            />
            <button onClick={onCopyCode} style={styles.actionBtn}>
              {copied === 'code' ? 'Copied!' : 'Copy Code'}
            </button>
          </div>

          <button onClick={onCopyMessage} style={styles.secondaryBtn}>
            {copied === 'message' ? 'Copied!' : 'Copy Invite Message'}
          </button>

          <button onClick={onRegenerate} style={{ ...styles.secondaryBtn, color: 'var(--text-muted)' }}>
            {copied === 'regen' ? 'Regenerated!' : 'Regenerate Code'}
          </button>
        </>
      )}
    </div>
  );
}

export function InviteGuildModalNostrPanel({
  query,
  setQuery,
  dmMsg,
  inviteCode,
  codeLoading,
  searching,
  searchResults,
  styles,
  sendingNpub,
  onSendDM,
}) {
  return (
    <>
      <div style={{ paddingBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
          Send a guild invite via encrypted Nostr DM.
        </div>
        <input
          type="text"
          placeholder="Search by name or paste npub..."
          value={query}
          onChange={(event) => { setQuery(event.target.value); }}
          style={styles.searchInput}
          autoFocus
        />
        {dmMsg && (
          <div style={{
            fontSize: 11,
            color: dmMsg.includes('!') ? 'var(--success, #40ff40)' : 'var(--error, #ff4040)',
            marginTop: 4,
          }}>
            {dmMsg}
          </div>
        )}
      </div>

      {!inviteCode && !codeLoading && (
        <div style={{ fontSize: 12, color: 'var(--error, #ff4040)', marginBottom: 8 }}>
          No invite code available. Generate one in the Code tab first.
        </div>
      )}

      {searching ? (
        <div style={styles.emptyState}>Searching...</div>
      ) : query.trim().length >= 2 && searchResults.length === 0 ? (
        <div style={styles.emptyState}>No users found</div>
      ) : searchResults.length > 0 ? (
        searchResults.map((result) => (
          <InviteGuildSearchResultRow
            key={result.npub}
            result={result}
            inviteCode={inviteCode}
            sendingNpub={sendingNpub}
            styles={styles}
            onSendDM={onSendDM}
          />
        ))
      ) : (
        <div style={styles.emptyState}>Search for Nostr users to send them a guild invite</div>
      )}
    </>
  );
}
