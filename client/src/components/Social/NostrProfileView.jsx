import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchCurrentProfile } from '../../nostr/profilePublisher';
import { getUserPubkey } from '../../utils/nostrConnect';
import { useAuth } from '../../contexts/AuthContext';
import { useGuild } from '../../contexts/GuildContext';
import { useSocket } from '../../contexts/SocketContext';
import { useGuilds } from '../../hooks/useGuilds';
import { useOnlineUsers } from '../../hooks/useOnlineUsers';
import { nip19 } from 'nostr-tools';
import GuildSettingsModal from '../Guild/GuildSettingsModal';
import ProfileSettingsModal from '../Profile/ProfileSettingsModal';
import { startPerfTrace } from '../../utils/devPerf';
import { buildNostrProfileViewState } from '../../features/social/nostrProfileModel.mjs';
import {
  createCopyNpubAction,
  createLeaveGuildDialog,
  createLogoutDialog,
  createStartEditStatusAction,
  createStatusSaveAction,
  loadNostrProfileSnapshot,
} from '../../features/social/nostrProfileRuntime.mjs';
import { styles } from './NostrProfileStyles.mjs';
import {
  NostrProfileCard,
  NostrProfileConfirmDialog,
  NostrProfileFlashMessage,
  NostrProfileGuildCard,
  NostrProfileSettingsCard,
} from './NostrProfilePanels.jsx';

export default function NostrProfileView() {
  const { user, logout } = useAuth();
  const { currentGuild, currentGuildData, clearGuild } = useGuild();
  const { socket } = useSocket();
  const { leaveGuild } = useGuilds();
  const { onlineUsers } = useOnlineUsers();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusDraft, setStatusDraft] = useState('');
  const [showGuildSettings, setShowGuildSettings] = useState(false);
  const [guildSettingsOpenTraceId, setGuildSettingsOpenTraceId] = useState(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [flashMsg, setFlashMsg] = useState(null);

  const closeGuildSettings = useCallback(() => {
    setShowGuildSettings(false);
    setGuildSettingsOpenTraceId(null);
  }, []);

  const openGuildSettings = useCallback(() => {
    setGuildSettingsOpenTraceId(startPerfTrace('guild-settings-open', {
      surface: 'nostr-profile',
    }));
    setShowGuildSettings(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    loadNostrProfileSnapshot({
      user,
      fetchCurrentProfileFn: fetchCurrentProfile,
      getUserPubkeyFn: getUserPubkey,
      decodeNpubFn: nip19.decode,
    })
      .then((nextProfile) => {
        if (cancelled) return;
        setProfile(nextProfile);
      })
      .catch(() => {
        if (cancelled) return;
        setProfile(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const viewState = useMemo(() => buildNostrProfileViewState({
    user,
    profile,
    onlineUsers,
    currentGuildData,
  }), [user, profile, onlineUsers, currentGuildData]);

  const handleCopyNpub = useMemo(() => createCopyNpubAction({
    npub: viewState.npub,
    writeTextFn: (value) => navigator.clipboard.writeText(value),
    setCopiedFn: setCopied,
  }), [viewState.npub]);

  const handleStatusSave = useMemo(() => createStatusSaveAction({
    socket,
    getStatusDraftFn: () => statusDraft,
    setEditingStatusFn: setEditingStatus,
  }), [socket, statusDraft]);

  const handleStartEditStatus = useMemo(() => createStartEditStatusAction({
    getCurrentStatusFn: () => viewState.myStatus,
    setStatusDraftFn: setStatusDraft,
    setEditingStatusFn: setEditingStatus,
  }), [viewState.myStatus]);

  const handleLeaveGuild = useCallback(() => {
    setConfirmDialog(createLeaveGuildDialog({
      currentGuild,
      currentGuildData,
      leaveGuildFn: leaveGuild,
      clearGuildFn: clearGuild,
      setFlashMsgFn: setFlashMsg,
    }));
  }, [clearGuild, currentGuild, currentGuildData, leaveGuild]);

  const handleLogout = useCallback(() => {
    setConfirmDialog(createLogoutDialog({ logoutFn: logout }));
  }, [logout]);

  const handleOpenPrimal = useCallback(() => {
    window.electronAPI?.openExternal(`https://primal.net/p/${viewState.npub}`);
  }, [viewState.npub]);

  return (
    <>
      <div style={styles.container}>
        <div style={styles.scrollArea}>
          <div style={styles.column}>
            <NostrProfileCard
              picture={viewState.picture}
              displayName={viewState.displayName}
              user={user}
              npubLabel={viewState.npubLabel}
              copied={copied}
              loading={loading}
              about={viewState.about}
              onCopyNpub={() => {
                void handleCopyNpub();
              }}
              onOpenProfileEditor={() => setShowProfileEditor(true)}
              onOpenPrimal={handleOpenPrimal}
            />

            <NostrProfileGuildCard
              currentGuildData={currentGuildData}
              guildName={viewState.guildName}
              guildMemberCount={viewState.guildMemberCount}
              guildInitial={viewState.guildInitial}
              editingStatus={editingStatus}
              statusDraft={statusDraft}
              myStatus={viewState.myStatus}
              onChangeStatusDraft={setStatusDraft}
              onStatusKeyDown={(event) => {
                if (event.key === 'Enter') handleStatusSave();
                if (event.key === 'Escape') setEditingStatus(false);
              }}
              onStatusSave={handleStatusSave}
              onStartEditStatus={handleStartEditStatus}
            />

            <NostrProfileSettingsCard
              currentGuild={currentGuild}
              onOpenGuildSettings={openGuildSettings}
              onLeaveGuild={handleLeaveGuild}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </div>

      <NostrProfileFlashMessage flashMsg={flashMsg} />

      {showGuildSettings && (
        <GuildSettingsModal onClose={closeGuildSettings} openTraceId={guildSettingsOpenTraceId} />
      )}

      {showProfileEditor && (
        <ProfileSettingsModal
          onClose={() => setShowProfileEditor(false)}
          onSaved={(nextProfile) => {
            setProfile(nextProfile);
            setShowProfileEditor(false);
          }}
        />
      )}

      <NostrProfileConfirmDialog
        confirmDialog={confirmDialog}
        onClose={() => setConfirmDialog(null)}
      />
    </>
  );
}
