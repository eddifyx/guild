import React, { memo } from 'react';
import ChatView from '../Chat/ChatView';
import AssetDumpView from '../AssetDump/AssetDumpView';
import AddonView from '../Addons/AddonView';
import StreamView from '../Stream/StreamView';
import NostrProfileView from '../Social/NostrProfileView';
import GuildDashboard from '../Guild/GuildDashboard';
import VoiceChannelView from '../Voice/VoiceChannelView';

export const MainLayoutContentPane = memo(function MainLayoutContentPane({
  conversation,
  onSelectDM,
  openTraceId,
  onGuildRosterExpandedChange,
  streamImmersive,
  onToggleStreamImmersive,
}) {
  if (conversation?.type === 'assets') {
    return <AssetDumpView />;
  }
  if (conversation?.type === 'addons') {
    return <AddonView />;
  }
  if (conversation?.type === 'stream') {
    return <StreamView userId={conversation.id} immersive={streamImmersive} onToggleImmersive={onToggleStreamImmersive} />;
  }
  if (conversation?.type === 'nostr-profile') {
    return <NostrProfileView />;
  }
  if (conversation?.type === 'voice') {
    return <VoiceChannelView channelId={conversation.id} />;
  }
  if (conversation) {
    return <ChatView conversation={conversation} openTraceId={openTraceId} />;
  }
  return <GuildDashboard onSelectDM={onSelectDM} onRosterViewChange={onGuildRosterExpandedChange} />;
});
