import React from 'react';
import UpdateOverlay from '../Common/UpdateOverlay';
import { styles } from './GuildOnboardingStyles.mjs';

function VersionButton({ updateAvailable, appVersion, onClick }) {
  return (
    <button
      onClick={onClick}
      title={updateAvailable ? 'Update available — click for details' : `v${appVersion} — Check for updates`}
      style={{
        background: updateAvailable ? 'rgba(0, 214, 143, 0.15)' : 'none',
        border: 'none',
        color: updateAvailable ? 'var(--success)' : 'var(--text-muted)',
        cursor: 'pointer',
        padding: '0 12px',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        transition: 'color 0.15s, background 0.15s',
        animation: updateAvailable ? 'pulse-glow-green 2s ease-in-out infinite' : 'none',
        fontSize: 10,
      }}
      onMouseEnter={(event) => {
        if (updateAvailable) {
          event.currentTarget.style.background = 'rgba(0, 214, 143, 0.25)';
        } else {
          event.currentTarget.style.color = 'var(--text-secondary)';
          event.currentTarget.style.background = 'rgba(255,255,255,0.06)';
        }
      }}
      onMouseLeave={(event) => {
        if (updateAvailable) {
          event.currentTarget.style.background = 'rgba(0, 214, 143, 0.15)';
        } else {
          event.currentTarget.style.color = 'var(--text-muted)';
          event.currentTarget.style.background = 'none';
        }
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7,10 12,15 17,10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </button>
  );
}

function WindowControlButton({ onClick, enterStyle, leaveStyle, children }) {
  return (
    <button
      onClick={onClick}
      style={styles.winBtn}
      onMouseEnter={(event) => Object.assign(event.currentTarget.style, enterStyle)}
      onMouseLeave={(event) => Object.assign(event.currentTarget.style, leaveStyle)}
    >
      {children}
    </button>
  );
}

export function GuildOnboardingChrome({
  updateAvailable,
  latestVersionInfo,
  appVersion,
  versionToast,
  showUpdateOverlay,
  serverUrl,
  onVersionClick,
  onDismissVersionToast,
  onDismissUpdateOverlay,
}) {
  return (
    <>
      <div style={styles.titleBar}>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, height: '100%', WebkitAppRegion: 'no-drag' }}>
          <VersionButton
            updateAvailable={updateAvailable}
            appVersion={appVersion}
            onClick={onVersionClick}
          />
          <WindowControlButton
            onClick={() => window.electronAPI?.windowMinimize?.()}
            enterStyle={{ background: 'rgba(255,255,255,0.08)' }}
            leaveStyle={{ background: 'none' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1" />
            </svg>
          </WindowControlButton>
          <WindowControlButton
            onClick={() => window.electronAPI?.windowMaximize?.()}
            enterStyle={{ background: 'rgba(255,255,255,0.08)' }}
            leaveStyle={{ background: 'none' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="1.5" y="1.5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          </WindowControlButton>
          <WindowControlButton
            onClick={() => window.electronAPI?.windowClose?.()}
            enterStyle={{ background: '#e81123', color: '#fff' }}
            leaveStyle={{ background: 'none', color: 'var(--text-muted)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1" />
              <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1" />
            </svg>
          </WindowControlButton>
        </div>
      </div>

      {versionToast && (
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
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{versionToast}</span>
        </div>
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
