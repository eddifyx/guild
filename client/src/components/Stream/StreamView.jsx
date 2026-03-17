import { useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useVoiceContext, useVoicePresenceContext } from '../../contexts/VoiceContext';

function formatResolution(width, height) {
  if (!width || !height) return '—';
  return `${width}x${height}`;
}

function formatFps(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${Math.round(value * 10) / 10} fps`;
}

function formatKbps(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${Math.round(value)} kbps`;
}

function ScreenShareStatsOverlay({ diagnostics }) {
  if (!diagnostics?.active) return null;

  const captureSettings = diagnostics.captureTrack?.settings || {};
  const senderStats = diagnostics.sender || {};
  const outboundVideo = senderStats.outboundVideo || {};

  return (
    <div style={{
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 3,
      minWidth: 220,
      padding: '10px 12px',
      borderRadius: 10,
      background: 'rgba(5, 7, 5, 0.78)',
      border: '1px solid rgba(64, 255, 64, 0.22)',
      backdropFilter: 'blur(8px)',
      color: '#d8ffe0',
      display: 'grid',
      gap: 6,
      fontSize: 11,
      lineHeight: 1.35,
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.9px',
        color: '#8cff9c',
      }}>
        Screen Share Stats
      </div>
      <div style={{ display: 'grid', gap: 3, fontVariantNumeric: 'tabular-nums' }}>
        <div>Target: {diagnostics.requestedCapture?.minimumResolution || '—'} @ {diagnostics.requestedCapture?.targetFps || '—'}fps</div>
        <div>Captured: {formatResolution(captureSettings.width, captureSettings.height)} @ {formatFps(captureSettings.frameRate)}</div>
        <div>Sent: {formatResolution(outboundVideo.frameWidth, outboundVideo.frameHeight)} @ {formatFps(outboundVideo.framesPerSecond)}</div>
        <div>Bitrate: {formatKbps(senderStats.outgoingBitrateKbps)}</div>
        <div>RTT: {senderStats.remoteInboundVideo?.roundTripTimeMs ?? senderStats.candidatePair?.currentRoundTripTimeMs ?? '—'} ms</div>
        <div>Limitation: {outboundVideo.qualityLimitationReason || 'none'}</div>
      </div>
    </div>
  );
}

function StreamVideo({ stream, muted = false }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (!videoRef.current) return;

    videoRef.current.srcObject = stream || null;
    videoRef.current.muted = muted;
    if (stream) {
      videoRef.current.play().catch(() => {});
    }
  }, [stream, muted]);
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      style={{
        width: '100%',
        height: '100%',
        background: '#000',
        objectFit: 'contain',
      }}
    />
  );
}

const placeholderStyle = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: 12,
  color: 'var(--text-muted)',
};

const monitorIcon = (size) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

function NoStreamPlaceholder() {
  return (
    <div style={placeholderStyle}>
      {monitorIcon(48)}
      <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)' }}>
        No Active Stream
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        When someone shares their screen, it will appear here
      </span>
    </div>
  );
}

export default function StreamView({ userId }) {
  const { user } = useAuth();
  const { screenSharing, screenShareStream, screenShareDiagnostics, incomingScreenShares, voiceChannels, channelId } = useVoiceContext();
  const { peers } = useVoicePresenceContext();

  const isOwnStream = userId && userId === user.userId;
  const activePeerStreamerId = !screenSharing
    ? (Object.entries(peers || {}).find(([, state]) => state?.screenSharing)?.[0] || null)
    : null;

  const getStreamerName = (uid) => {
    for (const ch of voiceChannels) {
      const p = (ch.participants || []).find(p => p.userId === uid);
      if (p) return p.username;
    }
    return 'Unknown';
  };

  // Find any active streamer in our current voice channel (excluding self)
  const findChannelStreamer = () => {
    if (!channelId) return null;
    if (activePeerStreamerId) {
      return {
        userId: activePeerStreamerId,
        username: getStreamerName(activePeerStreamerId),
      };
    }
    for (const ch of voiceChannels) {
      if (ch.id === channelId) {
        return (ch.participants || []).find(p => p.screenSharing && p.userId !== user.userId) || null;
      }
    }
    return null;
  };

  // Own stream view
  if (isOwnStream) {
    if (!screenSharing) {
      return <NoStreamPlaceholder />;
    }
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000', minHeight: 0, position: 'relative' }}>
        {screenShareStream ? (
          <>
            <StreamVideo stream={screenShareStream} muted />
            <ScreenShareStatsOverlay diagnostics={screenShareDiagnostics} />
          </>
        ) : (
          <div style={placeholderStyle}>
            {monitorIcon(48)}
            <span style={{ fontSize: 14 }}>You are streaming</span>
          </div>
        )}
      </div>
    );
  }

  // Determine which remote user to show
  let targetUser = userId || null;

  // If target user stopped streaming, fall through to channel auto-detect
  if (targetUser) {
    const stillSharing = activePeerStreamerId
      ? activePeerStreamerId === targetUser
      : voiceChannels.some(ch => (ch.participants || []).some(p => p.userId === targetUser && p.screenSharing));
    if (!stillSharing) targetUser = null;
  }

  // Auto-detect from channel if no valid target
  if (!targetUser) {
    const channelStreamer = findChannelStreamer();
    if (channelStreamer) targetUser = channelStreamer.userId;
  }

  // Nobody streaming
  if (!targetUser) {
    return <NoStreamPlaceholder />;
  }

  // Find the media stream for the target
  const share = [...incomingScreenShares].reverse().find(s => s.userId === targetUser);
  if (!share) {
    return (
      <div style={placeholderStyle}>
        <span style={{ fontSize: 14 }}>Connecting to {getStreamerName(targetUser)}'s stream...</span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000', minHeight: 0 }}>
      <StreamVideo stream={share.stream} />
    </div>
  );
}
