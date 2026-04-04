import React from 'react';
import { ConversationHeaderContent } from './MainLayoutConversationHeader.jsx';
import { MainLayoutWindowControls } from './MainLayoutWindowControls.jsx';

export function MainLayoutTitleBar({
  headerState = null,
  updateButtonState = null,
  onRequestVerifyIdentity = () => {},
  onUpdateButtonClick = () => {},
  onWindowMinimize = () => {},
  onWindowMaximize = () => {},
  onWindowClose = () => {},
} = {}) {
  return (
    <div style={{
      height: 42,
      minHeight: 42,
      display: 'flex',
      alignItems: 'center',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      WebkitAppRegion: 'drag',
    }}>
      <div style={{
        width: 260,
        minWidth: 260,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingLeft: 16,
        borderRight: '1px solid var(--border)',
        height: '100%',
        overflow: 'hidden',
      }}>
        <span style={{
          fontSize: 15,
          fontWeight: 700,
          fontFamily: "'Geist', sans-serif",
          color: '#40FF40',
          textShadow: '0 0 12px rgba(64, 255, 64, 0.4), 0 0 24px rgba(64, 255, 64, 0.15)',
          letterSpacing: '-0.5px',
        }}>
          /guild
        </span>
      </div>

      <ConversationHeaderContent
        headerState={headerState}
        onRequestVerifyIdentity={onRequestVerifyIdentity}
      />

      <MainLayoutWindowControls
        updateButtonState={updateButtonState}
        onUpdateButtonClick={onUpdateButtonClick}
        onWindowMinimize={onWindowMinimize}
        onWindowMaximize={onWindowMaximize}
        onWindowClose={onWindowClose}
      />
    </div>
  );
}
