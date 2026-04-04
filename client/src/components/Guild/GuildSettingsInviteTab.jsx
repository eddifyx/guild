import React, { memo, useState } from 'react';

import { styles } from './GuildSettingsModalStyles.mjs';

function GuildSettingsInviteTab({ inviteCode, onRegenerate, canInvite }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!inviteCode) {
      return;
    }
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Share this invite code with others to let them join your guild.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input readOnly value={inviteCode || 'No invite code generated'} style={{ ...styles.input, flex: 1, fontFamily: "'Geist Mono', monospace", letterSpacing: '1px' }} />
        <button onClick={handleCopy} style={styles.secondaryBtnSmall}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {canInvite && (
        <button onClick={onRegenerate} style={styles.secondaryBtn}>Regenerate Invite Code</button>
      )}
    </div>
  );
}

export default memo(GuildSettingsInviteTab);
