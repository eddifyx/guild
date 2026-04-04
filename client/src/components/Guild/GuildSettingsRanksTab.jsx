import React, { memo, useState } from 'react';

import { stripUniversalGuildChatPermissions } from '../../features/guild/capabilities';
import {
  GUILD_SETTINGS_PERMISSION_GROUPS,
  GUILD_SETTINGS_PERMISSION_LABELS,
} from '../../features/guild/guildSettingsModel.mjs';
import { buildGuildSettingsRankRowState } from '../../features/guild/guildSettingsPanelsModel.mjs';
import { styles } from './GuildSettingsModalStyles.mjs';

function GuildSettingsRanksTab({
  ranks,
  myRankOrder,
  editingRank,
  setEditingRank,
  newRankName,
  setNewRankName,
  onCreateRank,
  onUpdateRank,
  onDeleteRank,
  canSetPerms,
}) {
  const [editName, setEditName] = useState('');
  const [editPerms, setEditPerms] = useState({});

  const startEdit = (rank) => {
    setEditingRank(rank.id);
    setEditName(rank.name);
    setEditPerms(stripUniversalGuildChatPermissions(rank.permissions));
  };

  const saveEdit = () => {
    onUpdateRank(editingRank, { name: editName, permissions: editPerms });
    setEditingRank(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {ranks.map((rank) => {
        const { isEditing, canEdit } = buildGuildSettingsRankRowState({
          rank,
          editingRank,
          myRankOrder,
          canSetPerms,
        });

        if (isEditing) {
          return (
            <div key={rank.id} style={styles.rankCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <input value={editName} onChange={(event) => setEditName(event.target.value)} style={{ ...styles.input, flex: 1 }} maxLength={30} />
                <button onClick={saveEdit} style={styles.primaryBtnSmall}>Save</button>
                <button onClick={() => setEditingRank(null)} style={styles.secondaryBtnSmall}>Cancel</button>
              </div>
              {Object.entries(GUILD_SETTINGS_PERMISSION_GROUPS).map(([group, permissions]) => (
                <div key={group} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{group}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                    {permissions.map((permission) => (
                      <label key={permission} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!editPerms[permission]} onChange={(event) => setEditPerms((previousPerms) => ({ ...previousPerms, [permission]: event.target.checked }))} />
                        {GUILD_SETTINGS_PERMISSION_LABELS[permission]}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        return (
          <div key={rank.id} style={styles.rankCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{rank.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>Order: {rank.rank_order}</span>
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => startEdit(rank)} style={styles.secondaryBtnSmall}>Edit</button>
                  {rank.rank_order !== 0 && (
                    <button onClick={() => onDeleteRank(rank.id, rank.name)} style={styles.dangerBtnSmall}>Delete</button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {canSetPerms && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            value={newRankName}
            onChange={(event) => setNewRankName(event.target.value)}
            placeholder="New rank name..."
            style={{ ...styles.input, flex: 1 }}
            maxLength={30}
            onKeyDown={(event) => event.key === 'Enter' && onCreateRank()}
          />
          <button onClick={onCreateRank} disabled={!newRankName.trim()} style={styles.primaryBtnSmall}>Add Rank</button>
        </div>
      )}
    </div>
  );
}

export default memo(GuildSettingsRanksTab);
