import React from 'react';
import Avatar from '../Common/Avatar';
import { getFileUrl } from '../../api';
import { styles } from './NostrProfileStyles.mjs';

function HoverButton({ style, enterStyle, leaveStyle, ...props }) {
  return (
    <button
      {...props}
      style={style}
      onMouseEnter={(event) => Object.assign(event.currentTarget.style, enterStyle)}
      onMouseLeave={(event) => Object.assign(event.currentTarget.style, leaveStyle)}
    />
  );
}

export function NostrProfileCard({
  picture,
  displayName,
  user,
  npubLabel,
  copied,
  loading,
  about,
  onCopyNpub,
  onOpenProfileEditor,
  onOpenPrimal,
}) {
  return (
    <div style={styles.card}>
      <div style={styles.profileRow}>
        {picture ? (
          <img src={picture} alt="" style={styles.profilePic} />
        ) : (
          <Avatar username={displayName} color={user?.avatarColor || '#40FF40'} size={64} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.displayName}>{displayName}</div>
          <button onClick={onCopyNpub} style={styles.npubBtn} title="Copy npub">
            <span style={styles.npubText}>{npubLabel}</span>
            {copied ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Loading profile...</div>
      ) : about ? (
        <p style={styles.aboutText}>{about}</p>
      ) : null}

      <div style={styles.profileActions}>
        <HoverButton
          onClick={onOpenProfileEditor}
          style={styles.editProfileBtn}
          enterStyle={{ borderColor: 'var(--accent)', color: 'var(--text-primary)' }}
          leaveStyle={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          Edit Profile
        </HoverButton>
        <HoverButton
          onClick={onOpenPrimal}
          style={styles.primalBtn}
          enterStyle={{ borderColor: 'var(--accent)', color: 'var(--text-primary)' }}
          leaveStyle={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          View on Primal
        </HoverButton>
      </div>
    </div>
  );
}

export function NostrProfileGuildCard({
  currentGuildData,
  guildName,
  guildMemberCount,
  guildInitial,
  editingStatus,
  statusDraft,
  myStatus,
  onChangeStatusDraft,
  onStatusKeyDown,
  onStatusSave,
  onStartEditStatus,
}) {
  if (!currentGuildData) {
    return null;
  }

  return (
    <div style={styles.card}>
      <div style={styles.sectionLabel}>GUILD</div>
      <div style={styles.guildRow}>
        {currentGuildData.image_url ? (
          <img src={getFileUrl(currentGuildData.image_url)} alt="" style={styles.guildIcon} />
        ) : (
          <div style={styles.guildIconFallback}>{guildInitial}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{guildName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{guildMemberCount} members</div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={styles.sectionLabel}>STATUS</div>
        {editingStatus ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={statusDraft}
              onChange={(event) => onChangeStatusDraft(event.target.value)}
              onKeyDown={onStatusKeyDown}
              maxLength={128}
              placeholder="What are you up to?"
              autoFocus
              style={styles.statusInput}
            />
            <button onClick={onStatusSave} style={styles.statusSaveBtn}>Save</button>
          </div>
        ) : (
          <button onClick={onStartEditStatus} style={styles.statusDisplay}>
            {myStatus || 'Set a status...'}
          </button>
        )}
      </div>
    </div>
  );
}

export function NostrProfileSettingsCard({
  currentGuild,
  onOpenGuildSettings,
  onLeaveGuild,
  onLogout,
}) {
  return (
    <div style={styles.card}>
      <div style={styles.sectionLabel}>SETTINGS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {currentGuild && (
          <HoverButton
            onClick={onOpenGuildSettings}
            style={styles.settingsBtn}
            enterStyle={{ background: 'rgba(255,255,255,0.04)' }}
            leaveStyle={{ background: 'transparent' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            Guild Settings
          </HoverButton>
        )}

        {currentGuild && (
          <HoverButton
            onClick={onLeaveGuild}
            style={styles.leaveGuildBtn}
            enterStyle={{
              background: '#991b1b',
              borderColor: '#f87171',
              color: '#fee2e2',
              boxShadow: '0 0 0 1px rgba(239, 68, 68, 0.24), 0 0 14px rgba(239, 68, 68, 0.22)',
            }}
            leaveStyle={{
              background: 'rgba(127, 29, 29, 0.92)',
              borderColor: '#ef4444',
              color: '#fecaca',
              boxShadow: '0 0 0 1px rgba(239, 68, 68, 0.16), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16,17 21,12 16,7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Leave Guild
          </HoverButton>
        )}

        <HoverButton
          onClick={onLogout}
          style={{ ...styles.settingsBtn, color: 'var(--danger)' }}
          enterStyle={{ background: 'rgba(239, 68, 68, 0.06)' }}
          leaveStyle={{ background: 'transparent' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16,17 21,12 16,7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Log Out
        </HoverButton>
      </div>
    </div>
  );
}

export function NostrProfileFlashMessage({ flashMsg }) {
  if (!flashMsg) {
    return null;
  }
  return <div style={styles.flashMsg}>{flashMsg}</div>;
}

export function NostrProfileConfirmDialog({ confirmDialog, onClose }) {
  if (!confirmDialog) {
    return null;
  }

  return (
    <div style={styles.confirmOverlay} onClick={onClose}>
      <div style={styles.confirmModal} onClick={(event) => event.stopPropagation()}>
        <h3 style={styles.confirmTitle}>{confirmDialog.title}</h3>
        <p style={styles.confirmMessage}>{confirmDialog.message}</p>
        <div style={styles.confirmActions}>
          <button onClick={onClose} style={styles.confirmCancelBtn}>Cancel</button>
          <button
            onClick={() => {
              const callback = confirmDialog.onConfirm;
              onClose();
              callback?.();
            }}
            style={confirmDialog.danger ? styles.confirmDangerBtn : styles.confirmAcceptBtn}
          >
            {confirmDialog.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
