import React from 'react';
import Avatar from '../Common/Avatar';
import {
  buildGuildChatMentionSuggestionEntries,
  buildGuildChatPendingUploadEntries,
} from '../../features/messaging/guildChatDockModel.mjs';

function GuildChatDockError({
  message = '',
} = {}) {
  if (!message) {
    return null;
  }

  return (
    <div style={{
      fontSize: 11,
      color: '#ff9898',
      background: 'rgba(255, 71, 87, 0.08)',
      border: '1px solid rgba(255, 71, 87, 0.12)',
      borderRadius: 10,
      padding: '8px 10px',
    }}>
      {message}
    </div>
  );
}

function GuildChatDockPendingUploads({
  pendingFiles = [],
  removePendingFile = () => {},
} = {}) {
  const uploadEntries = buildGuildChatPendingUploadEntries({ pendingFiles });
  if (uploadEntries.length === 0) {
    return null;
  }

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      padding: '0 2px 2px',
    }}>
      {uploadEntries.map((file) => (
        <div key={file.key} style={{
          position: 'relative',
          borderRadius: 10,
          border: '1px solid rgba(64, 255, 64, 0.12)',
          overflow: 'hidden',
          background: 'rgba(9, 17, 9, 0.82)',
        }}>
          {file.isImage && file.previewUrl ? (
            <img
              src={file.previewUrl}
              alt={file.name}
              style={{ height: 72, width: 96, objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-secondary)', maxWidth: 140 }}>
              {file.name}
            </div>
          )}
          <button
            type="button"
            onClick={() => void removePendingFile(file.index)}
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.76)',
              border: 'none',
              color: '#fff',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}

function GuildChatDockMentionSuggestions({
  canCompose = false,
  mentionSuggestions = [],
  selectedMentionSuggestionIndex = 0,
  currentGuildMembers = [],
  applyMentionSuggestion = () => {},
} = {}) {
  const suggestionEntries = buildGuildChatMentionSuggestionEntries({
    mentionSuggestions,
    selectedMentionSuggestionIndex,
    members: currentGuildMembers,
  });

  if (!canCompose || suggestionEntries.length === 0) {
    return null;
  }

  return (
    <div style={{
      display: 'grid',
      gap: 4,
      marginTop: -2,
      padding: '6px',
      borderRadius: 12,
      border: '1px solid rgba(255, 166, 77, 0.16)',
      background: 'rgba(7, 12, 7, 0.96)',
      boxShadow: '0 14px 28px rgba(0, 0, 0, 0.22)',
    }}>
      {suggestionEntries.map((suggestion) => (
        <button
          key={suggestion.userId}
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
            applyMentionSuggestion(suggestion);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            border: 'none',
            borderRadius: 10,
            padding: '8px 10px',
            background: suggestion.selected ? 'rgba(255, 166, 77, 0.16)' : 'transparent',
            color: suggestion.selected ? '#ffe3bf' : '#d7ffd7',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
          }}>
            <Avatar
              username={suggestion.username}
              color={suggestion.avatarColor}
              size={20}
              profilePicture={suggestion.profilePicture}
            />
            <span style={{ minWidth: 0 }}>
              <span style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {suggestion.displayLabel}
              </span>
              <span style={{
                display: 'block',
                fontSize: 10,
                color: suggestion.selected ? 'rgba(255, 227, 191, 0.72)' : 'rgba(170, 214, 170, 0.68)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {suggestion.mentionToken}
              </span>
            </span>
          </span>
          {suggestion.selected && (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'rgba(255, 227, 191, 0.78)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              flexShrink: 0,
            }}>
              Enter
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function GuildChatDockComposerContent({
  lastError = '',
  pendingFiles = [],
  localError = '',
  removePendingFile = () => {},
  canCompose = false,
  focusComposer = () => {},
  inputRef,
  hidden = false,
  draft = '',
  handleDraftChange = () => {},
  handleKeyDown = () => {},
  syncComposerSelection = () => {},
  handlePaste = () => {},
  composerDisabledReason = '',
  canSend = false,
  handleSend = () => {},
  mentionSuggestions = [],
  selectedMentionSuggestionIndex = 0,
  applyMentionSuggestion = () => {},
  currentGuildMembers = [],
} = {}) {
  return (
    <div style={{
      padding: '0 12px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <GuildChatDockError message={lastError} />
      <GuildChatDockPendingUploads
        pendingFiles={pendingFiles}
        removePendingFile={removePendingFile}
      />
      <GuildChatDockError message={localError} />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        border: '1px solid rgba(64, 255, 64, 0.12)',
        background: 'rgba(4, 11, 4, 0.88)',
        borderRadius: 14,
        padding: '6px 10px 6px 12px',
        cursor: canCompose ? 'text' : 'default',
      }}>
        <div
          onMouseDown={(event) => {
            if (!canCompose || event.button !== 0) return;
            if (event.target instanceof HTMLElement && event.target.closest('button')) return;
            event.preventDefault();
            focusComposer();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            minWidth: 0,
            minHeight: 34,
          }}
        >
          <input
            ref={inputRef}
            autoFocus={!hidden}
            data-primary-composer="guildchat"
            value={draft}
            onChange={handleDraftChange}
            onKeyDown={handleKeyDown}
            onClick={syncComposerSelection}
            onKeyUp={syncComposerSelection}
            onSelect={syncComposerSelection}
            onPaste={(event) => { void handlePaste(event); }}
            placeholder={composerDisabledReason}
            aria-label="/guildchat message"
            disabled={!canCompose}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: canCompose ? '#d7ffd7' : 'rgba(215, 255, 215, 0.58)',
              fontSize: 14,
              lineHeight: '20px',
              fontWeight: 500,
              fontFamily: "'Geist', sans-serif",
              caretColor: '#40FF40',
              textShadow: '0 0 10px rgba(64, 255, 64, 0.08)',
              padding: '2px 0',
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend}
          style={{
            border: 'none',
            borderRadius: 10,
            padding: '8px 13px',
            background: !canSend
              ? 'rgba(255,255,255,0.06)'
              : '#40FF40',
            color: !canSend
              ? 'rgba(180, 214, 180, 0.5)'
              : '#071007',
            fontWeight: 700,
            fontSize: 11,
            cursor: !canSend ? 'default' : 'pointer',
          }}
        >
          Send
        </button>
      </div>

      <GuildChatDockMentionSuggestions
        canCompose={canCompose}
        mentionSuggestions={mentionSuggestions}
        selectedMentionSuggestionIndex={selectedMentionSuggestionIndex}
        currentGuildMembers={currentGuildMembers}
        applyMentionSuggestion={applyMentionSuggestion}
      />
    </div>
  );
}
