import React, { useEffect, useLayoutEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGuild } from '../../contexts/GuildContext';
import { useGuildChatDockController } from '../../features/messaging/useGuildChatDockController.mjs';
import { buildGuildChatDockShellStyle, guildChatDockAnimationCss } from './GuildChatDockShellStyles.mjs';
import {
  GuildChatDockComposerPanel,
  GuildChatDockDragOverlay,
  GuildChatDockFeed,
  GuildChatDockHeader,
} from './GuildChatDockPanels.jsx';

function GuildChatDockContent({
  guildChat,
  hidden = false,
  compact = false,
  fullscreen = false,
  dockAligned = false,
  fillContainer = false,
  onToggleExpand,
  instantHide = false,
  animateEnter = false,
  animateExit = false,
  currentGuildData,
  currentUserId,
}) {
  const dockSpacing = !fullscreen || dockAligned;
  const controller = useGuildChatDockController({
    guildChat,
    hidden,
    currentGuildData,
    currentUserId,
  });
  const { syncFullscreenLayout, syncFullscreenCollapse } = controller;

  useLayoutEffect(() => {
    syncFullscreenLayout(fullscreen, dockAligned);
  }, [syncFullscreenLayout, fullscreen, dockAligned]);

  useEffect(() => {
    syncFullscreenCollapse(fullscreen);
  }, [syncFullscreenCollapse, fullscreen]);

  return (
    <div
      style={buildGuildChatDockShellStyle({
        hidden,
        fillContainer,
        fullscreen,
        compact,
        dockAligned,
        instantHide,
        animateEnter,
        animateExit,
      })}
      onDragEnter={controller.handleDragEnter}
      onDragOver={controller.handleDragOver}
      onDragLeave={controller.handleDragLeave}
      onDrop={controller.handleDrop}
    >
      {fullscreen && (animateEnter || animateExit) && (
        <style>{guildChatDockAnimationCss}</style>
      )}
      <GuildChatDockDragOverlay dragActive={controller.dragActive} hidden={hidden} />

      <GuildChatDockHeader
        fullscreen={fullscreen}
        onToggleExpand={onToggleExpand}
      />

      <GuildChatDockFeed
        feedRef={controller.feedRef}
        dockSpacing={dockSpacing}
        liveEntries={controller.liveEntries}
        currentUserId={currentUserId}
        typingUsers={controller.typingUsers}
        onScroll={controller.handleFeedScroll}
      />

      <GuildChatDockComposerPanel
        lastError={controller.lastError}
        pendingFiles={controller.pendingFiles}
        localError={controller.localError}
        removePendingFile={controller.removePendingFile}
        canCompose={controller.canCompose}
        focusComposer={controller.focusComposer}
        inputRef={controller.inputRef}
        hidden={hidden}
        draft={controller.draft}
        handleDraftChange={controller.handleDraftChange}
        handleKeyDown={controller.handleKeyDown}
        syncComposerSelection={controller.syncComposerSelection}
        handlePaste={controller.handlePaste}
        composerDisabledReason={controller.composerDisabledReason}
        canSend={controller.canSend}
        handleSend={controller.handleSend}
        mentionSuggestions={controller.mentionSuggestions}
        selectedMentionSuggestionIndex={controller.selectedMentionSuggestionIndex}
        applyMentionSuggestion={controller.applyMentionSuggestion}
        currentGuildMembers={currentGuildData?.members || []}
      />
    </div>
  );
}

export default function GuildChatDock({ guildChat, hidden = false, compact = false, fullscreen = false, dockAligned = false, fillContainer = false, onToggleExpand, instantHide = false, animateEnter = false, animateExit = false }) {
  const { user } = useAuth();
  const { currentGuildData } = useGuild();
  const currentUserId = user?.userId || null;

  if (!currentGuildData) return null;

  return (
    <GuildChatDockContent
      guildChat={guildChat}
      hidden={hidden}
      compact={compact}
      fullscreen={fullscreen}
      dockAligned={dockAligned}
      fillContainer={fillContainer}
      onToggleExpand={onToggleExpand}
      instantHide={instantHide}
      animateEnter={animateEnter}
      animateExit={animateExit}
      currentGuildData={currentGuildData}
      currentUserId={currentUserId}
    />
  );
}
