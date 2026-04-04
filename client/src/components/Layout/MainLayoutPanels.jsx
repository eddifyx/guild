import React from 'react';
import UpdateOverlay from '../Common/UpdateOverlay';
import StreamPiP from '../Stream/StreamPiP';
import GuildChatDock from '../GuildChat/GuildChatDock';

export function MainLayoutAlerts({
  insecureConnection = false,
  e2eWarning = false,
  versionToast = null,
  onDismissVersionToast = () => {},
  showUpdateOverlay = false,
  latestVersionInfo = null,
  serverUrl = '',
  onDismissUpdateOverlay = () => {},
} = {}) {
  return (
    <>
      {insecureConnection && (
        <div style={{
          padding: '4px 12px',
          background: 'rgba(239, 68, 68, 0.12)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
          fontSize: 11,
          color: '#ef4444',
          textAlign: 'center',
          flexShrink: 0,
          WebkitAppRegion: 'no-drag',
        }}>
          Insecure connection — using unencrypted HTTP. Use HTTPS for production.
        </div>
      )}
      {e2eWarning && (
        <div style={{
          padding: '4px 12px',
          background: 'rgba(239, 68, 68, 0.12)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
          fontSize: 11,
          color: '#ef4444',
          textAlign: 'center',
          flexShrink: 0,
          WebkitAppRegion: 'no-drag',
        }}>
          Secure messaging is still starting or needs attention. Messages cannot be sent until encryption is restored.
        </div>
      )}
      {versionToast && (
        <>
          <style>{`
            @keyframes toastSlideIn {
              from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
              to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>
          <div
            onClick={onDismissVersionToast}
            style={{
              position: 'fixed',
              top: 48,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9998,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--accent)',
              borderRadius: 8,
              padding: '10px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              animation: 'toastSlideIn 0.2s ease',
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{versionToast}</span>
          </div>
        </>
      )}
      {showUpdateOverlay && (
        <UpdateOverlay
          serverUrl={serverUrl}
          onDismiss={onDismissUpdateOverlay}
          updateInfo={latestVersionInfo}
        />
      )}
    </>
  );
}

export function MainLayoutStreamPiPOverlay({
  showPiP = false,
  conversationType = null,
  onNavigate = () => {},
  onClose = () => {},
} = {}) {
  if (!showPiP) {
    return null;
  }

  return (
    <StreamPiP
      position={conversationType === 'assets' || conversationType === 'addons' ? 'bottom-right' : 'top-right'}
      onNavigate={onNavigate}
      onClose={onClose}
    />
  );
}

export function MainLayoutContentShell({
  SidebarComponent,
  rooms = [],
  myRooms = [],
  createRoom = () => {},
  joinRoom = () => {},
  renameRoom = () => {},
  deleteRoom = () => {},
  conversation = null,
  onSelectRoom = () => {},
  onSelectDM = () => {},
  onSelectAssetDump = () => {},
  onSelectAddons = () => {},
  onSelectStream = () => {},
  onSelectNostrProfile = () => {},
  onSelectVoiceChannel = () => {},
  onSelectTavern = () => {},
  guildChatMentionUnread = false,
  unreadCounts = {},
  unreadRoomCounts = {},
  MainContentComponent,
  conversationOpenTraceId = null,
  setGuildChatCompact = () => {},
  streamImmersive = false,
  onToggleStreamImmersive = () => {},
  guildChatDockState,
  currentGuild = null,
  guildChat = null,
  guildChatAvailable = false,
  guildChatCompact = false,
  guildChatExpanded = false,
  handleCollapseGuildChatFull = () => {},
  handleSelectGuildChatFull = () => {},
} = {}) {
  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <SidebarComponent
        rooms={rooms}
        myRooms={myRooms}
        createRoom={createRoom}
        joinRoom={joinRoom}
        renameRoom={renameRoom}
        deleteRoom={deleteRoom}
        conversation={conversation}
        onSelectRoom={onSelectRoom}
        onSelectDM={onSelectDM}
        onSelectAssetDump={onSelectAssetDump}
        onSelectAddons={onSelectAddons}
        onSelectStream={onSelectStream}
        onSelectNostrProfile={onSelectNostrProfile}
        onSelectVoiceChannel={onSelectVoiceChannel}
        onSelectTavern={onSelectTavern}
        guildChatMentionUnread={guildChatMentionUnread}
        unreadCounts={unreadCounts}
        unreadRoomCounts={unreadRoomCounts}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          paddingBottom: guildChatDockState?.shouldReserveGuildChatSpaceForStream ? guildChatDockState.guildChatDockTargetHeight : 0,
          transition: 'padding-bottom 240ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}>
          <MainContentComponent
            conversation={conversation}
            onSelectDM={onSelectDM}
            openTraceId={conversationOpenTraceId}
            onGuildRosterExpandedChange={setGuildChatCompact}
            streamImmersive={streamImmersive}
            onToggleStreamImmersive={onToggleStreamImmersive}
          />
        </div>
        {!!currentGuild && (
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: guildChatDockState?.dockTop,
            height: guildChatDockState?.dockHeight,
            zIndex: guildChatDockState?.dockZIndex,
            overflow: 'hidden',
            opacity: guildChatDockState?.dockOpacity,
            pointerEvents: guildChatDockState?.dockPointerEvents,
            transition: 'top 240ms cubic-bezier(0.2, 0.8, 0.2, 1), height 240ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 120ms ease',
          }}>
            <GuildChatDock
              guildChat={guildChat}
              hidden={!guildChatAvailable}
              compact={guildChatCompact}
              fullscreen={guildChatExpanded}
              dockAligned={!guildChatExpanded}
              fillContainer
              onToggleExpand={guildChatExpanded ? handleCollapseGuildChatFull : handleSelectGuildChatFull}
            />
          </div>
        )}
      </div>
    </div>
  );
}
