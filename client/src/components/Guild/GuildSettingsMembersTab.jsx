import React, { memo, useMemo, useState } from 'react';

import { stripUniversalGuildChatPermissions } from '../../features/guild/capabilities';
import {
  GUILD_SETTINGS_PERMISSION_GROUPS,
  GUILD_SETTINGS_PERMISSION_LABELS,
} from '../../features/guild/guildSettingsModel.mjs';
import {
  applyGuildSettingsOverrideToggle,
  buildGuildSettingsMemberCountLabel,
  buildGuildSettingsMemberRowState,
  buildGuildSettingsRankOptionsByCurrentRankId,
  createGuildSettingsOverrideEditState,
} from '../../features/guild/guildSettingsPanelsModel.mjs';
import { styles } from './GuildSettingsModalStyles.mjs';

function GuildSettingsMembersTab({
  members,
  ranks,
  myRankOrder,
  onChangeRank,
  onKick,
  userId,
  showControls,
  isGuildMaster,
  guildId,
  onUpdatePermissions,
  onRefreshMembers,
  flash,
}) {
  const [expandedMember, setExpandedMember] = useState(null);
  const [overrideEdits, setOverrideEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const rankOptionsByCurrentRankId = useMemo(() => buildGuildSettingsRankOptionsByCurrentRankId({
    ranks,
    myRankOrder,
  }), [ranks, myRankOrder]);

  const startEditOverrides = (member) => {
    if (expandedMember === member.id) {
      setExpandedMember(null);
      return;
    }

    setExpandedMember(member.id);
    setOverrideEdits(createGuildSettingsOverrideEditState(member));
  };

  const handleSaveOverrides = async (memberId) => {
    setSaving(true);
    try {
      await onUpdatePermissions(guildId, memberId, overrideEdits);
      await onRefreshMembers();
      flash('Permissions updated', false);
    } catch (runtimeError) {
      flash(runtimeError.message, true);
    }
    setSaving(false);
  };

  const handleClearOverrides = async (memberId) => {
    setSaving(true);
    try {
      await onUpdatePermissions(guildId, memberId, {});
      setOverrideEdits({});
      await onRefreshMembers();
      flash('Overrides cleared', false);
    } catch (runtimeError) {
      flash(runtimeError.message, true);
    }
    setSaving(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
        {buildGuildSettingsMemberCountLabel(members.length)}
      </div>
      {members.map((member) => {
        const {
          canModify,
          canEditOverrides,
          rankOptions,
          hasOverrides,
          isExpanded,
          rankPermissions,
          avatarLetter,
        } = buildGuildSettingsMemberRowState({
          member,
          rankOptionsByCurrentRankId,
          myRankOrder,
          showControls,
          isGuildMaster,
          userId,
          expandedMemberId: expandedMember,
        });

        return (
          <div key={member.id}>
            <div
              style={{
                ...styles.memberRow,
                cursor: canEditOverrides ? 'pointer' : 'default',
                background: isExpanded ? 'rgba(255,255,255,0.03)' : undefined,
              }}
              onClick={() => {
                if (canEditOverrides) {
                  startEditOverrides(member);
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                {member.profilePicture ? (
                  <img
                    src={member.profilePicture}
                    alt=""
                    style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
                    onError={(event) => {
                      event.target.style.display = 'none';
                      event.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: member.avatarColor || 'var(--accent)',
                    display: member.profilePicture ? 'none' : 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#fff',
                  }}
                >
                  {avatarLetter}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {member.username}
                    </span>
                    {hasOverrides && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" title="Has permission overrides">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {member.rankName}
                  </div>
                </div>
              </div>
              {canModify && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }} onClick={(event) => event.stopPropagation()}>
                  <select value={member.rankId} onChange={(event) => onChangeRank(member.id, event.target.value)} style={styles.select}>
                    {rankOptions.map((rank) => (
                      <option key={rank.id} value={rank.id}>{rank.name}</option>
                    ))}
                  </select>
                  <button onClick={() => onKick(member.id, member.username)} style={styles.dangerSmall} title="Kick">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            {isExpanded && (
              <div style={{ padding: '12px 12px 12px 44px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Permission Overrides
                </div>
                {Object.entries(GUILD_SETTINGS_PERMISSION_GROUPS).map(([group, permissions]) => (
                  <div key={group} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{group}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}>
                      {permissions.map((permission) => {
                        const rankDefault = !!rankPermissions[permission];
                        const hasOverride = overrideEdits[permission] !== undefined;
                        const effectiveValue = hasOverride ? !!overrideEdits[permission] : rankDefault;
                        return (
                          <label
                            key={permission}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              color: hasOverride ? 'var(--text-primary)' : 'var(--text-muted)',
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={effectiveValue}
                              onChange={(event) => {
                                setOverrideEdits((previousEdits) => applyGuildSettingsOverrideToggle({
                                  previousEdits,
                                  permission,
                                  nextValue: event.target.checked,
                                  rankDefault,
                                }));
                              }}
                            />
                            <span>{GUILD_SETTINGS_PERMISSION_LABELS[permission]}</span>
                            {!hasOverride && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>(rank)</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => handleSaveOverrides(member.id)} disabled={saving} style={styles.primaryBtnSmall}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => handleClearOverrides(member.id)} disabled={saving} style={styles.secondaryBtnSmall}>
                    Clear Overrides
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default memo(GuildSettingsMembersTab);
