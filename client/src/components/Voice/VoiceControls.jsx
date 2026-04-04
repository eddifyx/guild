import React, { useState, useEffect, useCallback } from 'react';
import { useVoiceContext } from '../../contexts/VoiceContext';
import AudioSettings from './AudioSettings';
import SourcePicker from '../Stream/SourcePicker';
import { startPerfTrace } from '../../utils/devPerf';

export default function VoiceControls() {
  const {
    channelId,
    muted,
    deafened,
    toggleMute,
    toggleDeafen,
    leaveChannel,
    screenSharing,
    stopScreenShare,
    showSourcePicker,
    confirmScreenShare,
    cancelSourcePicker,
    screenShareError,
    clearScreenShareError,
  } = useVoiceContext();
  const [showSettings, setShowSettings] = useState(false);
  const [audioSettingsOpenTraceId, setAudioSettingsOpenTraceId] = useState(null);
  const closeSettings = useCallback(() => {
    setShowSettings(false);
    setAudioSettingsOpenTraceId(null);
  }, []);
  const openSettings = useCallback(() => {
    setAudioSettingsOpenTraceId(startPerfTrace('audio-settings-open', {
      surface: 'voice-controls',
    }));
    setShowSettings(true);
  }, []);

  useEffect(() => {
    if (!screenShareError) return;
    const t = setTimeout(() => clearScreenShareError(), 4000);
    return () => clearTimeout(t);
  }, [screenShareError, clearScreenShareError]);

  if (!channelId) return null;

  const controlBtn = (onClick, title, isActive, isDanger, icon) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        flex: 1,
        padding: '7px 0',
        background: isDanger ? 'var(--danger)' : isActive ? 'var(--accent)' : 'var(--bg-tertiary)',
        border: 'none',
        borderRadius: 4,
        color: isActive || isDanger ? '#fff' : 'var(--text-muted)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
      }}
    >
      {icon}
    </button>
  );

  const shareButtonTitle = screenSharing ? 'Stop sharing' : 'Screen Sharing Coming Soon™';
  const shareButtonHandler = screenSharing ? stopScreenShare : undefined;
  const shareButtonActive = screenSharing;
  const shareButtonStyle = !screenSharing ? {
    color: 'rgba(255, 255, 255, 0.35)',
    cursor: 'not-allowed',
    opacity: 0.72,
  } : null;

  return (
    <>
      <div style={{
        padding: '8px 10px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-tertiary)',
        WebkitAppRegion: 'no-drag',
      }}>
        {screenSharing && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 6,
            fontSize: 11,
          }}>
            <div style={{
              width: 6, height: 6,
              borderRadius: '50%',
              background: '#40FF40',
              boxShadow: '0 0 6px rgba(64, 255, 64, 0.4)',
            }} />
            <span style={{ color: '#40FF40', fontWeight: 600 }}>Sharing Screen</span>
          </div>
        )}

        {screenShareError && (
          <div style={{
            marginBottom: 6,
            padding: '5px 8px',
            background: 'rgba(255, 71, 87, 0.1)',
            borderRadius: 4,
            fontSize: 10,
            color: 'var(--danger)',
            lineHeight: 1.4,
          }}>
            <div>{screenShareError}</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 4 }}>
          {controlBtn(toggleMute, muted ? 'Unmute' : 'Mute', muted, false,
            muted ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .67-.1 1.32-.27 1.93" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )
          )}

          {controlBtn(toggleDeafen, deafened ? 'Undeafen' : 'Deafen', deafened, false,
            deafened ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v6" />
                <path d="M5 12v-2a7 7 0 0 1 12-4.9" />
                <line x1="5" y1="12" x2="5" y2="14" />
                <path d="M5 14a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2" />
                <path d="M19 14a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
            )
          )}

          {controlBtn(openSettings, 'Audio settings', false, false,
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          )}

          <button
            onClick={shareButtonHandler}
            title={shareButtonTitle}
            aria-disabled={!screenSharing}
            style={{
              flex: 1,
              padding: '7px 0',
              background: shareButtonActive ? 'var(--accent)' : 'var(--bg-tertiary)',
              border: 'none',
              borderRadius: 4,
              color: shareButtonActive ? '#fff' : 'var(--text-muted)',
              cursor: screenSharing ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              opacity: screenSharing ? 1 : 0.72,
              ...(shareButtonStyle || {}),
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </button>

          {controlBtn(leaveChannel, 'Disconnect', false, true,
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
              <line x1="23" y1="1" x2="17" y2="7" />
              <line x1="17" y1="1" x2="23" y2="7" />
            </svg>
          )}
        </div>
      </div>

      {showSettings && <AudioSettings onClose={closeSettings} openTraceId={audioSettingsOpenTraceId} />}
      {showSourcePicker && <SourcePicker onSelect={confirmScreenShare} onClose={cancelSourcePicker} />}
    </>
  );
}
