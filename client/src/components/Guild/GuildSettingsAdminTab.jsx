import React, { memo, useMemo } from 'react';

import { buildGuildSettingsAdminState } from '../../features/guild/guildSettingsPanelsModel.mjs';
import { styles } from './GuildSettingsModalStyles.mjs';

function GuildSettingsAdminTab({
  members,
  transferTarget,
  setTransferTarget,
  onTransfer,
  onDisband,
  userId,
}) {
  const { otherMembers } = useMemo(() => buildGuildSettingsAdminState({
    members,
    userId,
  }), [members, userId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={styles.dangerSection}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--warning)', margin: 0 }}>Transfer Leadership</h4>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 12px' }}>
          Pass Guild Master to another member. You will be demoted.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={transferTarget} onChange={(event) => setTransferTarget(event.target.value)} style={{ ...styles.select, flex: 1 }}>
            <option value="">Select member...</option>
            {otherMembers.map((member) => (
              <option key={member.id} value={member.id}>{member.username} ({member.rankName})</option>
            ))}
          </select>
          <button onClick={onTransfer} disabled={!transferTarget} style={styles.dangerBtn}>Transfer</button>
        </div>
      </div>

      <div style={styles.dangerSection}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)', margin: 0 }}>Disband Guild</h4>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 12px' }}>
          Permanently delete this guild and all its rooms, channels, and member data. This cannot be undone.
        </p>
        <button onClick={onDisband} style={styles.dangerBtn}>Disband Guild</button>
      </div>
    </div>
  );
}

export default memo(GuildSettingsAdminTab);
