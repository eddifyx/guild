import { memo, useState, useEffect, useCallback, useMemo, useRef, useTransition } from 'react';
import { useGuild } from '../../contexts/GuildContext';
import { useGuilds } from '../../hooks/useGuilds';
import { useAuth } from '../../contexts/AuthContext';
import { uploadFile, getFileUrl } from '../../api';
import { endPerfTraceAfterNextPaint, startPerfTrace } from '../../utils/devPerf';


const PERMISSION_LABELS = {
  invite_member: 'Invite Member',
  remove_member: 'Remove Member',
  promote_demote: 'Promote / Demote',
  manage_applications: 'Manage Applications',
  guild_chat_speak: 'Chat — Speak',
  guild_chat_listen: 'Chat — Listen',
  officer_chat: 'Officer Chat',
  modify_motd: 'Modify MotD',
  create_delete_events: 'Create / Delete Events',
  edit_public_note: 'Edit Public Note',
  edit_officer_note: 'Edit Officer Note',
  view_officer_note: 'View Officer Note',
  view_asset_dump: 'View Asset Dump',
  upload_files: 'Upload Files',
  download_files: 'Download Files',
  delete_files: 'Delete Files',
  manage_storage: 'Manage Storage',
  modify_rank_names: 'Modify Rank Names',
  set_permissions: 'Set Permissions',
  manage_rooms: 'Manage Rooms',
  manage_theme: 'Manage Theme',
  disband_guild: 'Disband Guild',
  transfer_leadership: 'Transfer Leadership',
};

const PERMISSION_GROUPS = {
  Membership: ['invite_member', 'remove_member', 'promote_demote', 'manage_applications'],
  Communication: ['guild_chat_speak', 'guild_chat_listen', 'officer_chat', 'modify_motd'],
  'Events & Content': ['create_delete_events', 'edit_public_note', 'edit_officer_note', 'view_officer_note'],
  'Asset Dump': ['view_asset_dump', 'upload_files', 'download_files', 'delete_files', 'manage_storage'],
  Administration: ['modify_rank_names', 'set_permissions', 'manage_rooms', 'manage_theme', 'disband_guild', 'transfer_leadership'],
};

function GuildSettingsModal({ onClose, openTraceId = null }) {
  const { user } = useAuth();
  const { currentGuild, currentGuildData, fetchGuildDetails, clearGuild } = useGuild();
  const {
    updateGuild, disbandGuild, transferLeadership, getInviteCode, regenerateInvite,
    fetchMembers, changeMemberRank, kickMember, updateNote,
    fetchRanks, createRank, updateRank, deleteRank, getMotd, updateMotd,
    updateMemberPermissions, leaveGuild,
  } = useGuilds();

  const [tab, setTab] = useState('Overview');
  const [members, setMembers] = useState(() => currentGuildData?.members || []);
  const [membersLoaded, setMembersLoaded] = useState(() => Array.isArray(currentGuildData?.members));
  const [ranks, setRanks] = useState([]);
  const [ranksLoaded, setRanksLoaded] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLoaded, setInviteLoaded] = useState(false);
  const [motd, setMotd] = useState('');
  const [motdLoaded, setMotdLoaded] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [isTabPending, startTabTransition] = useTransition();

  // Overview form state
  const [guildName, setGuildName] = useState(() => currentGuildData?.name || '');
  const [guildDesc, setGuildDesc] = useState(() => currentGuildData?.description || '');
  const [guildPublic, setGuildPublic] = useState(() => currentGuildData?.is_public !== 0);
  const [guildImage, setGuildImage] = useState(() => currentGuildData?.image_url || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const loadingRef = useRef({ members: false, ranks: false, invite: false, motd: false });
  const completedOpenTraceIdsRef = useRef(new Set());

  // My rank info
  const myMember = useMemo(
    () => members.find((m) => m.id === user?.userId),
    [members, user?.userId]
  );
  const myRankOrder = myMember?.rankOrder ?? 999;
  const isGuildMaster = myRankOrder === 0;

  const loadMembers = useCallback(async ({ force = false } = {}) => {
    if (!currentGuild) return [];
    if (!force && (membersLoaded || loadingRef.current.members)) return [];
    loadingRef.current.members = true;
    try {
      const nextMembers = await fetchMembers(currentGuild);
      setMembers(nextMembers);
      setMembersLoaded(true);
      return nextMembers;
    } finally {
      loadingRef.current.members = false;
    }
  }, [currentGuild, fetchMembers, membersLoaded]);

  const loadRanks = useCallback(async ({ force = false } = {}) => {
    if (!currentGuild) return [];
    if (!force && (ranksLoaded || loadingRef.current.ranks)) return [];
    loadingRef.current.ranks = true;
    try {
      const nextRanks = await fetchRanks(currentGuild);
      setRanks(nextRanks);
      setRanksLoaded(true);
      return nextRanks;
    } finally {
      loadingRef.current.ranks = false;
    }
  }, [currentGuild, fetchRanks, ranksLoaded]);

  const loadMotd = useCallback(async ({ force = false } = {}) => {
    if (!currentGuild) return '';
    if (!force && (motdLoaded || loadingRef.current.motd)) return '';
    loadingRef.current.motd = true;
    try {
      const nextMotd = await getMotd(currentGuild);
      setMotd(nextMotd || '');
      setMotdLoaded(true);
      return nextMotd || '';
    } finally {
      loadingRef.current.motd = false;
    }
  }, [currentGuild, getMotd, motdLoaded]);

  const loadInviteCode = useCallback(async ({ force = false } = {}) => {
    if (!currentGuild) return '';
    if (!force && (inviteLoaded || loadingRef.current.invite)) return '';
    loadingRef.current.invite = true;
    try {
      const nextInviteCode = await getInviteCode(currentGuild);
      setInviteCode(nextInviteCode || '');
      setInviteLoaded(true);
      return nextInviteCode || '';
    } finally {
      loadingRef.current.invite = false;
    }
  }, [currentGuild, getInviteCode, inviteLoaded]);

  useEffect(() => {
    setRanks([]);
    setRanksLoaded(false);
    setInviteCode('');
    setInviteLoaded(false);
    setMotd('');
    setMotdLoaded(false);
    loadingRef.current = { members: false, ranks: false, invite: false, motd: false };

    if (currentGuildData?.id !== currentGuild || !Array.isArray(currentGuildData?.members)) {
      setMembers([]);
      setMembersLoaded(false);
    }
  }, [currentGuild]);

  useEffect(() => {
    setGuildName(currentGuildData?.name || '');
    setGuildDesc(currentGuildData?.description || '');
    setGuildPublic(currentGuildData?.is_public !== 0);
    setGuildImage(currentGuildData?.image_url || '');
    setImagePreview(null);

    if (currentGuildData?.id === currentGuild && Array.isArray(currentGuildData?.members)) {
      setMembers(currentGuildData.members);
      setMembersLoaded(true);
    }
  }, [currentGuildData, currentGuild]);

  useEffect(() => {
    if (!currentGuild) return;
    if (!membersLoaded) loadMembers().catch(console.error);
    if (!motdLoaded) loadMotd().catch(() => {});

    const rankWarmTimer = window.setTimeout(() => {
      if (!ranksLoaded) loadRanks().catch(console.error);
    }, 120);

    return () => window.clearTimeout(rankWarmTimer);
  }, [currentGuild, membersLoaded, motdLoaded, ranksLoaded, loadMembers, loadMotd, loadRanks]);

  useEffect(() => {
    if (!currentGuild) return;
    if ((tab === 'Members' || tab === 'Admin') && !membersLoaded) {
      loadMembers().catch(console.error);
    }
    if (tab === 'Ranks' && !ranksLoaded) {
      loadRanks().catch(console.error);
    }
    if (tab === 'Invite' && !inviteLoaded) {
      loadInviteCode().catch(() => {});
    }
    if (tab === 'Overview' && !motdLoaded) {
      loadMotd().catch(() => {});
    }
  }, [tab, currentGuild, membersLoaded, ranksLoaded, inviteLoaded, motdLoaded, loadMembers, loadRanks, loadInviteCode, loadMotd]);

  const flash = useCallback((msg, isError) => {
    if (isError) { setError(msg); setSuccess(''); }
    else { setSuccess(msg); setError(''); }
    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  }, []);

  const handleSelectTab = useCallback((nextTab) => {
    if (nextTab === tab) {
      return;
    }
    const traceId = startPerfTrace('guild-settings-tab-switch', {
      fromTab: tab,
      toTab: nextTab,
      surface: 'guild-settings',
    });
    startTabTransition(() => {
      setTab(nextTab);
    });
    endPerfTraceAfterNextPaint(traceId, {
      status: 'ready',
      surface: 'guild-settings',
      tab: nextTab,
    });
  }, [tab]);

  // --- Overview handlers ---
  const handleSaveOverview = async () => {
    try {
      await updateGuild(currentGuild, {
        name: guildName, description: guildDesc, is_public: guildPublic,
        image_url: guildImage,
      });
      await fetchGuildDetails(currentGuild);
      flash('Guild updated', false);
    } catch (err) { flash(err.message, true); }
  };

  const handleSaveMotd = async () => {
    try {
      await updateMotd(currentGuild, motd);
      setMotdLoaded(true);
      flash('MotD updated', false);
    } catch (err) { flash(err.message, true); }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'image/jpeg') { flash('Only JPEG images are supported', true); return; }
    if (file.size > 5 * 1024 * 1024) { flash('Image must be less than 5MB', true); return; }
    try {
      setUploadingImage(true);
      const { fileUrl } = await uploadFile(file);
      setGuildImage(fileUrl);
      setImagePreview(URL.createObjectURL(file));
    } catch (err) { flash(err.message, true); }
    finally { setUploadingImage(false); }
  };

  const handleRemoveImage = () => {
    setGuildImage('');
    setImagePreview(null);
  };

  // --- Member handlers ---
  const handleChangeRank = async (userId, rankId) => {
    try {
      await changeMemberRank(currentGuild, userId, rankId);
      await loadMembers({ force: true });
      flash('Rank updated', false);
    } catch (err) { flash(err.message, true); }
  };

  const handleKick = (userId, username) => {
    setConfirmDialog({
      title: 'Kick Member',
      message: `Remove ${username} from the guild?`,
      danger: true,
      confirmLabel: 'Kick',
      onConfirm: async () => {
        try {
          await kickMember(currentGuild, userId);
          setMembers(prev => prev.filter(m => m.id !== userId));
          flash('Member removed', false);
        } catch (err) { flash(err.message, true); }
      },
    });
  };

  // --- Rank handlers ---
  const [editingRank, setEditingRank] = useState(null);
  const [newRankName, setNewRankName] = useState('');

  const handleCreateRank = async () => {
    if (!newRankName.trim()) return;
    try {
      await createRank(currentGuild, { name: newRankName.trim(), permissions: {} });
      await loadRanks({ force: true });
      setNewRankName('');
      flash('Rank created', false);
    } catch (err) { flash(err.message, true); }
  };

  const handleUpdateRank = async (rankId, updates) => {
    try {
      await updateRank(currentGuild, rankId, updates);
      await loadRanks({ force: true });
      flash('Rank updated', false);
    } catch (err) { flash(err.message, true); }
  };

  const handleDeleteRank = (rankId, rankName) => {
    setConfirmDialog({
      title: 'Delete Rank',
      message: `Delete rank "${rankName}"? Members with this rank will be reassigned.`,
      danger: true,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await deleteRank(currentGuild, rankId);
          await Promise.all([
            loadRanks({ force: true }),
            loadMembers({ force: true }),
          ]);
          flash('Rank deleted', false);
        } catch (err) { flash(err.message, true); }
      },
    });
  };

  // --- Invite handlers ---
  const handleRegenInvite = async () => {
    try {
      const code = await regenerateInvite(currentGuild);
      setInviteCode(code);
      setInviteLoaded(true);
      flash('Invite code regenerated', false);
    } catch (err) { flash(err.message, true); }
  };

  // --- Danger handlers ---
  const [transferTarget, setTransferTarget] = useState('');

  const handleTransfer = () => {
    if (!transferTarget) return;
    const targetMember = members.find(m => m.id === transferTarget);
    setConfirmDialog({
      title: 'Transfer Leadership',
      message: `Transfer Guild Master to ${targetMember?.username || 'this member'}? This cannot be undone.`,
      danger: true,
      confirmLabel: 'Transfer',
      onConfirm: async () => {
        try {
          await transferLeadership(currentGuild, transferTarget);
          await fetchGuildDetails(currentGuild);
          await loadMembers({ force: true });
          flash('Leadership transferred', false);
        } catch (err) { flash(err.message, true); }
      },
    });
  };

  const handleDisband = () => {
    setConfirmDialog({
      title: 'Disband Guild',
      message: 'PERMANENTLY delete this guild? All rooms, channels, and members will be lost.',
      danger: true,
      confirmLabel: 'Disband',
      onConfirm: () => {
        setConfirmDialog({
          title: 'Final Confirmation',
          message: 'Are you absolutely sure? This cannot be undone.',
          danger: true,
          confirmLabel: 'Yes, Disband',
          onConfirm: async () => {
            try {
              await disbandGuild(currentGuild);
              clearGuild();
              onClose();
            } catch (err) { flash(err.message, true); }
          },
        });
      },
    });
  };

  const handleLeaveGuild = () => {
    setConfirmDialog({
      title: 'Leave Guild',
      message: `Leave ${currentGuildData?.name || 'this guild'}? You'll need to join or create a new guild.`,
      danger: false,
      confirmLabel: 'Leave',
      onConfirm: async () => {
        try {
          await leaveGuild(currentGuild);
          clearGuild();
          onClose();
        } catch (err) { flash(err.message, true); }
      },
    });
  };

  // --- Escape to close ---
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!openTraceId || completedOpenTraceIdsRef.current.has(openTraceId)) {
      return;
    }

    completedOpenTraceIdsRef.current.add(openTraceId);
    endPerfTraceAfterNextPaint(openTraceId, {
      status: 'ready',
      surface: 'guild-settings',
    });
  }, [openTraceId]);

  const permissionsReady = membersLoaded;
  const parsePerms = useCallback((raw) => { try { return JSON.parse(raw || '{}'); } catch { return {}; } }, []);
  const myPerms = useMemo(
    () => (myMember ? parsePerms(myMember.permissions) : {}),
    [myMember, parsePerms]
  );
  const myOverrides = useMemo(
    () => (myMember ? parsePerms(myMember.permissionOverrides) : {}),
    [myMember, parsePerms]
  );
  // Per-member overrides take precedence over rank defaults
  const hasPerm = (key) => {
    if (isGuildMaster) return true;
    if (myOverrides[key] !== undefined) return !!myOverrides[key];
    return !!myPerms[key];
  };
  const canManageTheme = hasPerm('manage_theme');
  const canSetPerms = hasPerm('set_permissions');
  const canInvite = hasPerm('invite_member');
  const canRemoveMember = hasPerm('remove_member');
  const canPromoteDemote = hasPerm('promote_demote');
  const canEditGuild = isGuildMaster || canManageTheme;
  const canModifyMotd = hasPerm('modify_motd');
  const readOnly = !canEditGuild && !canModifyMotd;
  const showMemberControls = canRemoveMember || canPromoteDemote;

  // Only show tabs relevant to the user's permissions
  const visibleTabs = useMemo(() => {
    const nextTabs = ['Overview', 'Members'];
    if (canSetPerms) nextTabs.push('Ranks');
    if (canInvite) nextTabs.push('Invite');
    if (isGuildMaster) nextTabs.push('Admin');
    return nextTabs;
  }, [canInvite, canSetPerms, isGuildMaster]);

  return (
    <div onClick={onClose} style={styles.overlay}>
      <div onClick={e => e.stopPropagation()} style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>{!permissionsReady ? 'Loading...' : readOnly ? 'Guild Info' : 'Guild Settings'}</h2>
          <button onClick={onClose} style={styles.closeBtn}>&times;</button>
        </div>

        {/* Status messages */}
        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {!permissionsReady ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading...
          </div>
        ) : (<>
        {/* Tabs */}
        <div style={styles.tabs}>
          {visibleTabs.map(t => (
            <button
              key={t}
              onClick={() => handleSelectTab(t)}
              style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ ...styles.content, opacity: isTabPending ? 0.8 : 1 }}>
          {tab === 'Overview' && (
            <OverviewTab
              guildName={guildName} setGuildName={setGuildName}
              guildDesc={guildDesc} setGuildDesc={setGuildDesc}
              guildPublic={guildPublic} setGuildPublic={setGuildPublic}
              guildImage={guildImage} imagePreview={imagePreview}
              onImageSelect={handleImageSelect} onRemoveImage={handleRemoveImage}
              uploadingImage={uploadingImage}
              motd={motd} setMotd={setMotd}
              onSaveOverview={handleSaveOverview} onSaveMotd={handleSaveMotd}
              canManageTheme={canManageTheme}
              canModifyMotd={canModifyMotd}
              readOnly={readOnly}
            />
          )}
          {tab === 'Members' && (
            <MembersTab
              members={members} ranks={ranks} myRankOrder={myRankOrder}
              onChangeRank={handleChangeRank} onKick={handleKick}
              userId={user?.userId}
              showControls={showMemberControls}
              isGuildMaster={isGuildMaster}
              guildId={currentGuild}
              onUpdatePermissions={updateMemberPermissions}
              onRefreshMembers={() => loadMembers({ force: true })}
              flash={flash}
            />
          )}
          {tab === 'Ranks' && (
            <RanksTab
              ranks={ranks} myRankOrder={myRankOrder}
              editingRank={editingRank} setEditingRank={setEditingRank}
              newRankName={newRankName} setNewRankName={setNewRankName}
              onCreateRank={handleCreateRank} onUpdateRank={handleUpdateRank}
              onDeleteRank={handleDeleteRank} canSetPerms={canSetPerms}
            />
          )}
          {tab === 'Invite' && (
            <InviteTab
              inviteCode={inviteCode} onRegenerate={handleRegenInvite} canInvite={canInvite}
            />
          )}
          {tab === 'Admin' && (
            <AdminTab
              members={members}
              transferTarget={transferTarget} setTransferTarget={setTransferTarget}
              onTransfer={handleTransfer} onDisband={handleDisband}
              userId={user?.userId}
            />
          )}
        </div>

        {/* Leave Guild — always visible for non-GMs */}
        {!isGuildMaster && (
          <div style={styles.footer}>
            <button
              onClick={handleLeaveGuild}
              style={styles.leaveBtn}
              onMouseEnter={e => { e.currentTarget.style.background = '#991b1b'; e.currentTarget.style.borderColor = '#f87171'; e.currentTarget.style.color = '#fee2e2'; e.currentTarget.style.boxShadow = '0 0 0 1px rgba(239, 68, 68, 0.24), 0 0 16px rgba(239, 68, 68, 0.24)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(127, 29, 29, 0.92)'; e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#fecaca'; e.currentTarget.style.boxShadow = '0 0 0 1px rgba(239, 68, 68, 0.16), inset 0 1px 0 rgba(255,255,255,0.04)'; }}
            >
              Leave Guild
            </button>
          </div>
        )}
        </>)}
      </div>

      {/* Styled confirmation dialog */}
      {confirmDialog && (
        <div style={styles.confirmOverlay} onClick={() => setConfirmDialog(null)}>
          <div style={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <h3 style={styles.confirmTitle}>{confirmDialog.title}</h3>
            <p style={styles.confirmMessage}>{confirmDialog.message}</p>
            <div style={styles.confirmActions}>
              <button onClick={() => setConfirmDialog(null)} style={styles.confirmCancelBtn}>Cancel</button>
              <button
                onClick={() => { const cb = confirmDialog.onConfirm; setConfirmDialog(null); cb(); }}
                style={confirmDialog.danger ? styles.confirmDangerConfirmBtn : styles.confirmAcceptBtn}
              >
                {confirmDialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────
const OverviewTab = memo(function OverviewTab({ guildName, setGuildName, guildDesc, setGuildDesc, guildPublic, setGuildPublic, guildImage, imagePreview, onImageSelect, onRemoveImage, uploadingImage, motd, setMotd, onSaveOverview, onSaveMotd, canManageTheme, canModifyMotd, readOnly }) {
  const imgSrc = imagePreview || (guildImage ? getFileUrl(guildImage) : null);

  if (readOnly) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {imgSrc && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ ...styles.imagePreviewBox, borderRadius: 16 }}>
              <img src={imgSrc} alt="Guild" style={styles.uploadedImage} />
            </div>
          </div>
        )}
        <div>
          <div style={styles.infoLabel}>Name</div>
          <div style={styles.infoValue}>{guildName}</div>
        </div>
        {guildDesc && (
          <div>
            <div style={styles.infoLabel}>Description</div>
            <div style={{ ...styles.infoValue, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{guildDesc}</div>
          </div>
        )}
        <div>
          <div style={styles.infoLabel}>Visibility</div>
          <div style={styles.infoValue}>{guildPublic ? 'Public — anyone can discover and join' : 'Private — invite only'}</div>
        </div>
        <div style={styles.divider} />
        {canModifyMotd ? (
          <>
            <label style={styles.label}>
              Message of the Day
              <textarea value={motd} onChange={e => setMotd(e.target.value)} style={{ ...styles.input, minHeight: 50, resize: 'vertical' }} maxLength={500} placeholder="Shown to members on login..." />
            </label>
            <button onClick={onSaveMotd} style={styles.secondaryBtn}>Update MotD</button>
          </>
        ) : motd ? (
          <div>
            <div style={styles.infoLabel}>Message of the Day</div>
            <div style={{ ...styles.infoValue, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{motd}</div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <label style={styles.label}>
        Guild Name
        <input value={guildName} onChange={e => setGuildName(e.target.value)} style={styles.input} maxLength={50} />
      </label>
      <label style={styles.label}>
        Description
        <textarea value={guildDesc} onChange={e => setGuildDesc(e.target.value)} style={{ ...styles.input, minHeight: 60, resize: 'vertical' }} maxLength={500} />
      </label>
      <label style={{ ...styles.label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={guildPublic} onChange={e => setGuildPublic(e.target.checked)} />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Public (discoverable)</span>
      </label>
      {canManageTheme && (
        <>
          {/* Guild Image */}
          <div style={styles.label}>
            <span>Guild Image</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
              <div style={styles.imagePreviewBox}>
                {imgSrc ? (
                  <img src={imgSrc} alt="Guild" style={styles.uploadedImage} />
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={styles.uploadBtn}>
                  {uploadingImage ? 'Uploading...' : 'Choose Image'}
                  <input type="file" accept=".jpg,.jpeg" onChange={onImageSelect} disabled={uploadingImage} style={{ display: 'none' }} />
                </label>
                {guildImage && (
                  <button type="button" onClick={onRemoveImage} disabled={uploadingImage} style={styles.removeBtn}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

        </>
      )}
      <button onClick={onSaveOverview} style={styles.primaryBtn}>Save Changes</button>

      <div style={styles.divider} />

      <label style={styles.label}>
        Message of the Day
        <textarea value={motd} onChange={e => setMotd(e.target.value)} style={{ ...styles.input, minHeight: 50, resize: 'vertical' }} maxLength={500} placeholder="Shown to members on login..." />
      </label>
      <button onClick={onSaveMotd} style={styles.secondaryBtn}>Update MotD</button>
    </div>
  );
});

// ─── Members Tab ─────────────────────────────────────────
const MembersTab = memo(function MembersTab({ members, ranks, myRankOrder, onChangeRank, onKick, userId, showControls, isGuildMaster, guildId, onUpdatePermissions, onRefreshMembers, flash }) {
  const [expandedMember, setExpandedMember] = useState(null);
  const [overrideEdits, setOverrideEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const rankOptionsByCurrentRankId = useMemo(() => {
    const assignableRanks = ranks.filter((rank) => rank.rank_order > myRankOrder);
    const next = new Map();

    for (const rank of ranks) {
      if (rank.rank_order > myRankOrder) {
        next.set(rank.id, assignableRanks);
      } else {
        next.set(
          rank.id,
          [...assignableRanks, rank].sort((a, b) => a.rank_order - b.rank_order)
        );
      }
    }

    return next;
  }, [ranks, myRankOrder]);

  const startEditOverrides = (m) => {
    if (expandedMember === m.id) { setExpandedMember(null); return; }
    setExpandedMember(m.id);
    const existing = (() => { try { return JSON.parse(m.permissionOverrides || '{}'); } catch { return {}; } })();
    setOverrideEdits(existing);
  };

  const handleSaveOverrides = async (memberId) => {
    setSaving(true);
    try {
      await onUpdatePermissions(guildId, memberId, overrideEdits);
      await onRefreshMembers();
      flash('Permissions updated', false);
    } catch (err) { flash(err.message, true); }
    setSaving(false);
  };

  const handleClearOverrides = async (memberId) => {
    setSaving(true);
    try {
      await onUpdatePermissions(guildId, memberId, {});
      setOverrideEdits({});
      await onRefreshMembers();
      flash('Overrides cleared', false);
    } catch (err) { flash(err.message, true); }
    setSaving(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
        {members.length} member{members.length !== 1 ? 's' : ''}
      </div>
      {members.map(m => {
        const canModify = showControls && myRankOrder < m.rankOrder && m.id !== userId;
        const rankOptions = rankOptionsByCurrentRankId.get(m.rankId) || ranks;
        const hasOverrides = m.permissionOverrides && m.permissionOverrides !== '{}' && m.permissionOverrides !== '';
        const isExpanded = expandedMember === m.id;
        const rankPerms = (() => { try { return JSON.parse(m.permissions || '{}'); } catch { return {}; } })();

        return (
          <div key={m.id}>
            <div style={{
              ...styles.memberRow,
              cursor: isGuildMaster && m.id !== userId && m.rankOrder !== 0 ? 'pointer' : 'default',
              background: isExpanded ? 'rgba(255,255,255,0.03)' : undefined,
            }}
            onClick={() => {
              if (isGuildMaster && m.id !== userId && m.rankOrder !== 0) startEditOverrides(m);
            }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                {m.profilePicture ? (
                  <img
                    src={m.profilePicture}
                    alt=""
                    style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      objectFit: 'cover',
                    }}
                    onError={e => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: m.avatarColor || 'var(--accent)',
                  display: m.profilePicture ? 'none' : 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#fff',
                }}>
                  {m.username?.[0]?.toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {m.username}
                    </span>
                    {hasOverrides && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" title="Has permission overrides">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {m.rankName}
                  </div>
                </div>
              </div>
              {canModify && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                  onClick={e => e.stopPropagation()}
                >
                  <select
                    value={m.rankId}
                    onChange={e => onChangeRank(m.id, e.target.value)}
                    style={styles.select}
                  >
                    {rankOptions.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <button onClick={() => onKick(m.id, m.username)} style={styles.dangerSmall} title="Kick">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              )}
            </div>
            {/* Per-member permission overrides panel */}
            {isExpanded && (
              <div style={{
                padding: '12px 12px 12px 44px', background: 'rgba(255,255,255,0.02)',
                borderBottom: '1px solid var(--border)', marginBottom: 4,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Permission Overrides
                </div>
                {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                  <div key={group} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{group}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}>
                      {perms.map(p => {
                        const isDisband = p === 'disband_guild';
                        const rankDefault = !!rankPerms[p];
                        const hasOverride = overrideEdits[p] !== undefined;
                        const effectiveValue = hasOverride ? !!overrideEdits[p] : rankDefault;
                        return (
                          <label key={p} style={{
                            display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
                            color: isDisband ? 'var(--text-muted)' : hasOverride ? 'var(--text-primary)' : 'var(--text-muted)',
                            cursor: isDisband ? 'not-allowed' : 'pointer',
                            opacity: isDisband ? 0.4 : 1,
                          }}>
                            <input
                              type="checkbox"
                              checked={effectiveValue}
                              disabled={isDisband}
                              onChange={e => {
                                const val = e.target.checked;
                                setOverrideEdits(prev => {
                                  if (val === rankDefault) {
                                    const next = { ...prev };
                                    delete next[p];
                                    return next;
                                  }
                                  return { ...prev, [p]: val };
                                });
                              }}
                            />
                            <span>{PERMISSION_LABELS[p]}</span>
                            {!hasOverride && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>(rank)</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => handleSaveOverrides(m.id)} disabled={saving} style={styles.primaryBtnSmall}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => handleClearOverrides(m.id)} disabled={saving} style={styles.secondaryBtnSmall}>
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
});

// ─── Ranks Tab ───────────────────────────────────────────
const RanksTab = memo(function RanksTab({ ranks, myRankOrder, editingRank, setEditingRank, newRankName, setNewRankName, onCreateRank, onUpdateRank, onDeleteRank, canSetPerms }) {
  const [editName, setEditName] = useState('');
  const [editPerms, setEditPerms] = useState({});

  const startEdit = (rank) => {
    setEditingRank(rank.id);
    setEditName(rank.name);
    try { setEditPerms(JSON.parse(rank.permissions || '{}')); } catch { setEditPerms({}); }
  };

  const saveEdit = () => {
    onUpdateRank(editingRank, { name: editName, permissions: editPerms });
    setEditingRank(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {ranks.map(r => {
        const isEditing = editingRank === r.id;
        const canEdit = canSetPerms && r.rank_order > myRankOrder;

        if (isEditing) {
          return (
            <div key={r.id} style={styles.rankCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...styles.input, flex: 1 }} maxLength={30} />
                <button onClick={saveEdit} style={styles.primaryBtnSmall}>Save</button>
                <button onClick={() => setEditingRank(null)} style={styles.secondaryBtnSmall}>Cancel</button>
              </div>
              {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                <div key={group} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{group}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                    {perms.map(p => (
                      <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!editPerms[p]} onChange={e => setEditPerms(prev => ({ ...prev, [p]: e.target.checked }))} />
                        {PERMISSION_LABELS[p]}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        return (
          <div key={r.id} style={styles.rankCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>Order: {r.rank_order}</span>
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => startEdit(r)} style={styles.secondaryBtnSmall}>Edit</button>
                  {r.rank_order !== 0 && (
                    <button onClick={() => onDeleteRank(r.id, r.name)} style={styles.dangerBtnSmall}>Delete</button>
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
            onChange={e => setNewRankName(e.target.value)}
            placeholder="New rank name..."
            style={{ ...styles.input, flex: 1 }}
            maxLength={30}
            onKeyDown={e => e.key === 'Enter' && onCreateRank()}
          />
          <button onClick={onCreateRank} disabled={!newRankName.trim()} style={styles.primaryBtnSmall}>Add Rank</button>
        </div>
      )}
    </div>
  );
});

// ─── Invite Tab ──────────────────────────────────────────
const InviteTab = memo(function InviteTab({ inviteCode, onRegenerate, canInvite }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Share this invite code with others to let them join your guild.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          readOnly
          value={inviteCode || 'No invite code generated'}
          style={{ ...styles.input, flex: 1, fontFamily: "'Geist Mono', monospace", letterSpacing: '1px' }}
        />
        <button onClick={handleCopy} style={styles.secondaryBtnSmall}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {canInvite && (
        <button onClick={onRegenerate} style={styles.secondaryBtn}>Regenerate Invite Code</button>
      )}
    </div>
  );
});

// ─── Admin Tab (Guild Master only) ───────────────────────
const AdminTab = memo(function AdminTab({ members, transferTarget, setTransferTarget, onTransfer, onDisband, userId }) {
  const otherMembers = members.filter(m => m.id !== userId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Transfer Leadership */}
      <div style={styles.dangerSection}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--warning)', margin: 0 }}>Transfer Leadership</h4>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 12px' }}>
          Pass Guild Master to another member. You will be demoted.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={transferTarget}
            onChange={e => setTransferTarget(e.target.value)}
            style={{ ...styles.select, flex: 1 }}
          >
            <option value="">Select member...</option>
            {otherMembers.map(m => (
              <option key={m.id} value={m.id}>{m.username} ({m.rankName})</option>
            ))}
          </select>
          <button onClick={onTransfer} disabled={!transferTarget} style={styles.dangerBtn}>Transfer</button>
        </div>
      </div>

      {/* Disband */}
      <div style={styles.dangerSection}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)', margin: 0 }}>Disband Guild</h4>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 12px' }}>
          Permanently delete this guild and all its rooms, channels, and member data. This cannot be undone.
        </p>
        <button onClick={onDisband} style={styles.dangerBtn}>Disband Guild</button>
      </div>
    </div>
  );
});

// ─── Styles ──────────────────────────────────────────────
const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--bg-secondary)',
    borderRadius: 12,
    border: '1px solid var(--border)',
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)',
    width: 580,
    maxWidth: '90vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    animation: 'fadeIn 0.2s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px 0',
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 22,
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  tabs: {
    display: 'flex',
    gap: 0,
    padding: '12px 20px 0',
    borderBottom: '1px solid var(--border)',
  },
  tab: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'color 0.15s, border-color 0.15s',
  },
  tabActive: {
    color: 'var(--accent)',
    borderBottomColor: 'var(--accent)',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: 20,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-muted)',
  },
  input: {
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  select: {
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: 12,
    outline: 'none',
    cursor: 'pointer',
  },
  primaryBtn: {
    padding: '10px 16px',
    borderRadius: 6,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  primaryBtnSmall: {
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '10px 16px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'color 0.15s',
  },
  secondaryBtnSmall: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 12,
    cursor: 'pointer',
  },
  dangerBtn: {
    padding: '8px 14px',
    borderRadius: 6,
    border: '1px solid var(--danger)',
    background: 'rgba(239, 68, 68, 0.1)',
    color: 'var(--danger)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  dangerBtnSmall: {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid var(--danger)',
    background: 'transparent',
    color: 'var(--danger)',
    fontSize: 11,
    cursor: 'pointer',
  },
  dangerSmall: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    borderRadius: 4,
  },
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px',
    borderRadius: 6,
    transition: 'background 0.15s',
  },
  rankCard: {
    padding: 12,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-tertiary)',
  },
  divider: {
    height: 1,
    background: 'var(--border)',
  },
  error: {
    margin: '8px 20px 0',
    padding: '8px 12px',
    borderRadius: 6,
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid var(--danger)',
    color: 'var(--danger)',
    fontSize: 12,
  },
  success: {
    margin: '8px 20px 0',
    padding: '8px 12px',
    borderRadius: 6,
    background: 'rgba(0, 214, 143, 0.1)',
    border: '1px solid var(--success)',
    color: 'var(--success)',
    fontSize: 12,
  },
  dangerSection: {
    padding: 16,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-tertiary)',
  },
  footer: {
    padding: '12px 20px',
    borderTop: '1px solid var(--border)',
  },
  leaveBtn: {
    background: 'rgba(127, 29, 29, 0.92)',
    border: '1px solid #ef4444',
    color: '#fecaca',
    padding: '8px 16px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'Geist', sans-serif",
    boxShadow: '0 0 0 1px rgba(239, 68, 68, 0.16), inset 0 1px 0 rgba(255,255,255,0.04)',
    transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s, color 0.15s',
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: 'var(--text-primary)',
    fontWeight: 400,
  },
  imagePreviewBox: {
    width: 80, height: 80, borderRadius: 12, flexShrink: 0,
    border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  uploadedImage: {
    width: '100%', height: '100%', objectFit: 'cover',
  },
  uploadBtn: {
    padding: '6px 14px', borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', display: 'inline-block', textAlign: 'center',
  },
  removeBtn: {
    padding: '6px 14px', borderRadius: 6, background: 'transparent',
    border: '1px solid var(--danger)', color: 'var(--danger)',
    fontSize: 12, cursor: 'pointer', textAlign: 'center',
  },
  confirmOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
  },
  confirmModal: {
    background: 'linear-gradient(135deg, rgba(14, 17, 14, 0.95), rgba(21, 26, 21, 0.9))',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '28px 32px',
    width: 380,
    maxWidth: '90vw',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    fontFamily: "'Geist', sans-serif",
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 8px',
  },
  confirmMessage: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    margin: '0 0 24px',
    lineHeight: 1.5,
  },
  confirmActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
  },
  confirmCancelBtn: {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    padding: '8px 20px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: "'Geist', sans-serif",
    transition: 'border-color 0.15s',
  },
  confirmAcceptBtn: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    padding: '8px 24px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Geist', sans-serif",
  },
  confirmDangerConfirmBtn: {
    background: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--danger)',
    border: '1px solid var(--danger)',
    padding: '8px 24px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Geist', sans-serif",
  },
};

export default memo(GuildSettingsModal);
