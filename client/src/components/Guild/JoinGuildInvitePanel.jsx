import React from 'react';
export function JoinGuildInvitePanel({
  inviteCode,
  joining,
  onJoinByCode,
  onInviteCodeChange,
  styles,
}) {
  return (
    <form onSubmit={onJoinByCode} style={styles.inviteForm}>
      <input
        type="text"
        value={inviteCode}
        onChange={(event) => onInviteCodeChange(event.target.value)}
        placeholder="Paste invite code..."
        style={styles.input}
        autoFocus
      />
      <button type="submit" disabled={!inviteCode.trim() || joining} style={styles.submitBtn}>
        {joining ? 'Joining...' : 'Join'}
      </button>
    </form>
  );
}
