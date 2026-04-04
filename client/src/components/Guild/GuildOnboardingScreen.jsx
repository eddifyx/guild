import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGuild } from '../../contexts/GuildContext';
import { useGuilds } from '../../hooks/useGuilds';
import { checkLatestVersion, getFileUrl, getServerUrl } from '../../api';
import CreateGuildModal from './CreateGuildModal';
import JoinGuildModal from './JoinGuildModal';
import ProfileSettingsModal from '../Profile/ProfileSettingsModal';
import { confirmLogout } from '../../utils/confirmLogout';
import { createGuildOnboardingUpdateAction } from '../../features/guild/guildOnboardingModel.mjs';
import { styles } from './GuildOnboardingStyles.mjs';
import {
  GuildJoinConfirmationDialog,
  GuildOnboardingActions,
  GuildOnboardingChrome,
  GuildOnboardingDiscoverSection,
  GuildOnboardingHeader,
} from './GuildOnboardingPanels.jsx';

export default function GuildOnboardingScreen() {
  const { user, logout } = useAuth();
  const { fetchMyGuild } = useGuild();
  const { publicGuilds, fetchPublicGuilds, joinGuild } = useGuilds();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [joining, setJoining] = useState(null);
  const [confirmGuild, setConfirmGuild] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersionInfo, setLatestVersionInfo] = useState(null);
  const [appVersion, setAppVersion] = useState('');
  const [showUpdateOverlay, setShowUpdateOverlay] = useState(false);
  const [versionToast, setVersionToast] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetchPublicGuilds();
  }, [fetchPublicGuilds]);

  useEffect(() => {
    requestAnimationFrame(() => setReady(true));
  }, []);

  useEffect(() => {
    window.electronAPI?.getAppVersion?.().then((version) => setAppVersion(version));
    checkLatestVersion()
      .then((info) => {
        setLatestVersionInfo(info);
        if (info?.hasUpdate) {
          setUpdateAvailable(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleVersionClick = useMemo(() => createGuildOnboardingUpdateAction({
    getUpdateAvailableFn: () => updateAvailable,
    getLatestVersionInfoFn: () => latestVersionInfo,
    getAppVersionFn: () => appVersion,
    checkLatestVersionFn: checkLatestVersion,
    setLatestVersionInfoFn: setLatestVersionInfo,
    setUpdateAvailableFn: setUpdateAvailable,
    setShowUpdateOverlayFn: setShowUpdateOverlay,
    setVersionToastFn: setVersionToast,
  }), [updateAvailable, latestVersionInfo, appVersion]);

  const handleGuildCreated = () => {
    setShowCreate(false);
    fetchMyGuild();
  };

  const handleGuildJoined = () => {
    setShowJoin(false);
    fetchMyGuild();
  };

  const handleConfirmJoin = async () => {
    if (!confirmGuild) return;
    setJoining(confirmGuild.id);
    setConfirmGuild(null);
    try {
      await joinGuild(confirmGuild.id);
      fetchMyGuild();
    } catch (err) {
      if (/already a member/i.test(err?.message || '')) {
        await fetchMyGuild();
        return;
      }
      console.error('Failed to join guild:', err);
      setJoining(null);
    }
  };

  return (
    <div style={{ ...styles.container, opacity: ready ? 1 : 0 }}>
      <GuildOnboardingChrome
        updateAvailable={updateAvailable}
        latestVersionInfo={latestVersionInfo}
        appVersion={appVersion}
        versionToast={versionToast}
        showUpdateOverlay={showUpdateOverlay}
        serverUrl={getServerUrl()}
        onVersionClick={handleVersionClick}
        onDismissVersionToast={() => setVersionToast(null)}
        onDismissUpdateOverlay={() => setShowUpdateOverlay(false)}
      />

      <div style={styles.ambientGlow} />
      <div style={styles.ambientGlow2} />

      <div style={styles.inner}>
        <GuildOnboardingHeader
          user={user}
          onOpenProfile={() => setShowProfile(true)}
          onLogout={() => {
            void confirmLogout(logout);
          }}
        />

        <GuildOnboardingActions
          onCreateGuild={() => setShowCreate(true)}
          onJoinGuild={() => setShowJoin(true)}
        />

        <GuildOnboardingDiscoverSection
          publicGuilds={publicGuilds}
          joining={joining}
          onDiscoverClick={setConfirmGuild}
          getFileUrlFn={getFileUrl}
        />
      </div>

      {showCreate && (
        <CreateGuildModal
          onClose={() => setShowCreate(false)}
          onCreated={handleGuildCreated}
        />
      )}

      {showJoin && (
        <JoinGuildModal
          onClose={() => setShowJoin(false)}
          onJoined={handleGuildJoined}
        />
      )}

      {showProfile && (
        <ProfileSettingsModal onClose={() => setShowProfile(false)} />
      )}

      <GuildJoinConfirmationDialog
        guild={confirmGuild}
        onCancel={() => setConfirmGuild(null)}
        onConfirm={handleConfirmJoin}
        getFileUrlFn={getFileUrl}
      />
    </div>
  );
}
