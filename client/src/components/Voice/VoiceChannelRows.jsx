import React from 'react';
import Avatar from '../Common/Avatar';
import {
  buildVoiceChannelRowState,
  buildVoiceParticipantRowState,
} from '../../features/voice/voiceChannelListModel.mjs';

export function VoiceChannelRows({
  voiceChannels = [],
  channelId = null,
  currentUserId = null,
  myRankOrder = null,
  onlineUsersById = new Map(),
  selfSpeaking = false,
  peers = {},
  onChannelActivate = () => {},
  onChannelContextMenu = () => {},
  onParticipantContextMenu = () => {},
} = {}) {
  return voiceChannels.map((channel) => {
    const participantStateOptions = {
      currentUserId,
      activeChannelId: channelId,
      channelId: channel.id,
      selfSpeaking,
      peers,
    };
    const rowState = buildVoiceChannelRowState(channel, {
      activeChannelId: channelId,
      currentUserId,
      myRankOrder,
      participantStateOptions,
    });
    const participants = channel.participants || [];

    return (
      <div key={channel.id}>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
          <button
            onClick={() => {
              onChannelActivate({
                channel,
                isActive: rowState.isActive,
                participants,
                participantStateOptions,
              });
            }}
            onContextMenu={(event) => {
              onChannelContextMenu(event, channel, rowState.canDeleteChannel);
            }}
            style={{
              flex: 1,
              width: '100%',
              padding: '7px 12px',
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              color: rowState.isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: rowState.isActive ? 500 : 400,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = 'var(--bg-hover)';
              event.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent';
              event.currentTarget.style.color = rowState.isActive ? 'var(--text-primary)' : 'var(--text-secondary)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, flexShrink: 0 }}>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            <span style={{ flex: 1 }}>{channel.name}</span>
            {rowState.isActive && rowState.hasActiveStream && (
              <span style={{
                fontSize: 9,
                color: '#40FF40',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                opacity: 0.9,
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#40FF40" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                LIVE
              </span>
            )}
            {rowState.participantCount > 0 && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {rowState.participantCount}
              </span>
            )}
          </button>
        </div>

        {participants.length > 0 && (
          <div style={{ paddingLeft: 32, paddingBottom: 4 }}>
            {participants.map((participant) => {
              const participantRow = buildVoiceParticipantRowState(participant, {
                onlineUsersById,
                participantStateOptions,
              });
              const { state } = participantRow;

              return (
                <div
                  key={participant.userId}
                  onContextMenu={(event) => {
                    onParticipantContextMenu(event, participant, currentUserId);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 4px',
                    borderRadius: 4,
                    fontSize: 11,
                    color: state.speaking ? '#40FF40' : 'var(--text-secondary)',
                    background: state.speaking ? 'rgba(64, 255, 64, 0.06)' : 'transparent',
                    transition: 'all 0.15s ease',
                    cursor: participant.userId !== currentUserId ? 'context-menu' : 'default',
                  }}
                >
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: state.speaking ? '2px solid #40FF40' : '2px solid transparent',
                    boxShadow: state.speaking ? '0 0 6px rgba(64, 255, 64, 0.4)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}>
                    <Avatar
                      username={participant.username}
                      color={participant.avatarColor}
                      size={14}
                      profilePicture={participantRow.profilePicture}
                    />
                  </div>
                  <span
                    className="truncate"
                    style={{
                      flex: 1,
                      fontWeight: state.speaking ? 600 : 400,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {participant.username}
                  </span>
                  {state.screenSharing && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#40FF40" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" title="Sharing screen">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  )}
                  {state.muted && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .67-.1 1.32-.27 1.93" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                  {state.deafened && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M6 18.7A7 7 0 0 1 5 12V9" />
                      <path d="M19 12v-2a7 7 0 0 0-12.37-4.47" />
                      <path d="M9 9h6v4" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  });
}
