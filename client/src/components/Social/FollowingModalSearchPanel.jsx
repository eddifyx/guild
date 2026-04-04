import React from 'react';
import Avatar from '../Common/Avatar';
import { styles } from './FollowingModalStyles.mjs';

function FollowingModalSearchAction({
  actionState,
  npub,
  onSendRequest,
  onToggleInviteMenu,
  onSendNostrDM,
  onCopyInvite,
}) {
  if (actionState.kind === 'friends') {
    return <span style={styles.mutedLabel}>Friends</span>;
  }

  if (actionState.kind === 'pending') {
    return <span style={styles.accentLabel}>Pending</span>;
  }

  if (actionState.kind === 'request') {
    return (
      <button
        onClick={() => onSendRequest(npub)}
        disabled={actionState.busy}
        style={{ ...styles.actionBtn, opacity: actionState.busy ? 0.5 : 1 }}
      >
        {actionState.busy ? '...' : 'Send Request'}
      </button>
    );
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => onToggleInviteMenu(npub)}
        disabled={actionState.busy}
        style={{
          ...styles.actionBtn,
          ...styles.inviteActionBtn,
          opacity: actionState.busy ? 0.5 : 1,
        }}
      >
        {actionState.busy ? '...' : 'Invite'}
      </button>
      {actionState.open && (
        <div style={styles.inviteMenu}>
          <button onClick={() => onSendNostrDM(npub)} style={styles.inviteMenuItem}>
            Send via Nostr DM
          </button>
          <button onClick={onCopyInvite} style={styles.inviteMenuItem}>
            Copy invite link
          </button>
        </div>
      )}
    </div>
  );
}

export function FollowingModalSearchPanel({
  query,
  searchMsg,
  searchMessageTone,
  searchRows,
  searchViewState,
  getResultActionState,
  onSearchChange,
  onSendRequest,
  onToggleInviteMenu,
  onSendNostrDM,
  onCopyInvite,
}) {
  return (
    <>
      <div style={{ padding: '0 0 12px' }}>
        <input
          type="text"
          placeholder="Search by name or paste npub..."
          value={query}
          onChange={(event) => onSearchChange(event.target.value)}
          style={styles.searchInput}
          autoFocus
        />
        {searchMsg && (
          <div
            style={{
              ...styles.searchMsg,
              color: searchMessageTone === 'success'
                ? 'var(--success, #40ff40)'
                : 'var(--error, #ff4040)',
            }}
          >
            {searchMsg}
          </div>
        )}
      </div>

      {searchViewState.mode === 'results' ? (
        searchRows.map((result) => (
          <div key={result.npub} style={styles.resultRow}>
            <Avatar username={result.name || result.npub.slice(0, 8)} size={36} profilePicture={result.picture} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.nameText}>{result.displayName}</div>
              {result.about ? <div style={styles.aboutText}>{result.about}</div> : null}
              <div style={styles.npubText}>{result.npubLabel}</div>
            </div>
            <FollowingModalSearchAction
              actionState={getResultActionState(result.npub)}
              npub={result.npub}
              onSendRequest={onSendRequest}
              onToggleInviteMenu={onToggleInviteMenu}
              onSendNostrDM={onSendNostrDM}
              onCopyInvite={onCopyInvite}
            />
          </div>
        ))
      ) : (
        <div style={styles.emptyState}>{searchViewState.message}</div>
      )}
    </>
  );
}
