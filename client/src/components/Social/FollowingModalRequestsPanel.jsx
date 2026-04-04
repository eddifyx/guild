import React from 'react';
import Avatar from '../Common/Avatar';
import { styles } from './FollowingModalStyles.mjs';

export function FollowingModalRequestsPanel({
  loadingRequests,
  incomingRows,
  actioningId,
  onAcceptRequest,
  onRejectRequest,
}) {
  if (loadingRequests) {
    return <div style={styles.emptyState}>Loading...</div>;
  }

  if (incomingRows.length === 0) {
    return <div style={styles.emptyState}>No pending friend requests</div>;
  }

  return incomingRows.map((request) => (
    <div key={request.id} style={styles.requestRow}>
      <Avatar
        username={request.avatarName}
        size={40}
        profilePicture={request.from_picture}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.nameText}>{request.displayName}</div>
        {request.npub ? <div style={styles.npubText}>{request.npubLabel}</div> : null}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => onAcceptRequest(request.id)}
          disabled={actioningId === request.id}
          style={{ ...styles.actionBtn, opacity: actioningId === request.id ? 0.5 : 1 }}
        >
          Accept
        </button>
        <button
          onClick={() => onRejectRequest(request.id)}
          disabled={actioningId === request.id}
          style={{
            ...styles.actionBtn,
            ...styles.secondaryActionBtn,
            opacity: actioningId === request.id ? 0.5 : 1,
          }}
        >
          Decline
        </button>
      </div>
    </div>
  ));
}
