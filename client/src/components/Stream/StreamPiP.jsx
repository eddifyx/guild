import React, { useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useVoiceContext } from '../../contexts/VoiceContext';

export default function StreamPiP({ onNavigate, onClose, position = 'top-right' }) {
  const { user } = useAuth();
  const { screenShareStream, incomingScreenShares, screenSharing, voiceChannels, channelId } = useVoiceContext();
  const videoRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Find active stream — own first, then any remote streamer in our channel
  let stream = null;
  let streamerId = null;
  let streamerName = null;

  if (screenSharing && screenShareStream) {
    stream = screenShareStream;
    streamerId = user.userId;
    streamerName = 'Your Stream';
  }

  if (!stream && channelId) {
    for (const ch of voiceChannels) {
      if (ch.id === channelId) {
        const streamer = (ch.participants || []).find(p => p.screenSharing && p.userId !== user.userId);
        if (streamer) {
          const share = incomingScreenShares.find(s => s.userId === streamer.userId);
          if (share) {
            stream = share.stream;
            streamerId = streamer.userId;
            streamerName = streamer.username;
          }
        }
        break;
      }
    }
  }

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

  // Auto-close when stream ends
  useEffect(() => {
    if (!stream) onCloseRef.current();
  }, [stream]);

  if (!stream) return null;

  return (
    <div
      onClick={() => onNavigate(streamerId, streamerName === 'Your Stream' ? user.username : streamerName)}
      style={{
        position: 'fixed',
        ...(position === 'bottom-right'
          ? { bottom: 16, right: 16 }
          : { top: 50, right: 16 }),
        width: 320,
        height: 180,
        zIndex: 900,
        borderRadius: 10,
        overflow: 'hidden',
        border: '2px solid var(--border)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        cursor: 'pointer',
        animation: 'fadeIn 0.2s ease-out',
        background: '#000',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          background: '#000',
        }}
      />

      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(0, 0, 0, 0.6)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 71, 87, 0.8)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)'}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Bottom label with gradient */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 8px 6px',
        background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.7))',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        pointerEvents: 'none',
      }}>
        <span style={{
          fontSize: 9,
          color: '#40FF40',
          fontWeight: 700,
          padding: '1px 5px',
          background: 'rgba(64, 255, 64, 0.25)',
          borderRadius: 3,
          letterSpacing: '0.5px',
        }}>
          LIVE
        </span>
        <span style={{
          fontSize: 11,
          color: '#fff',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {streamerName}
        </span>
      </div>
    </div>
  );
}
