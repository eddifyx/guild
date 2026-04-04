import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useVoiceContext, useVoicePresenceContext } from '../../contexts/VoiceContext';
import { isVoiceDiagnosticsEnabled } from '../../utils/voiceDiagnostics';
import { resolveStreamViewState } from '../../features/stream/streamViewModel.mjs';
import {
  NoStreamPlaceholder,
  StreamDebugHud,
  StreamShell,
  StreamVideo,
} from './StreamViewPanels.jsx';

export default function StreamView({ userId, immersive = false, onToggleImmersive }) {
  const { user } = useAuth();
  const {
    screenSharing,
    screenShareStream,
    incomingScreenShares,
    voiceChannels,
    channelId,
    voiceDiagnostics,
  } = useVoiceContext();
  const { peers } = useVoicePresenceContext();
  const diagnosticsEnabled = isVoiceDiagnosticsEnabled();
  const streamState = resolveStreamViewState({
    requestedUserId: userId,
    currentUserId: user.userId,
    screenSharing,
    screenShareStream,
    incomingScreenShares,
    voiceChannels,
    channelId,
    peers,
    voiceDiagnostics,
  });

  // Own stream view
  if (streamState.isOwnStream) {
    if (streamState.showNoStream) {
      return <NoStreamPlaceholder />;
    }
    return (
      <StreamShell immersive={immersive} onToggleImmersive={onToggleImmersive}>
        {diagnosticsEnabled && (
          <StreamDebugHud
            ownStream
            streamerName="You"
            screenShareDiagnostics={voiceDiagnostics?.screenShare || null}
            consumerDiagnostics={null}
          />
        )}
        {streamState.ownStreamMedia ? (
          <StreamVideo stream={streamState.ownStreamMedia} muted />
        ) : (
          <div style={placeholderStyle}>
            {monitorIcon(48)}
            <span style={{ fontSize: 14 }}>You are streaming</span>
          </div>
        )}
      </StreamShell>
    );
  }

  if (streamState.showNoStream) {
    return <NoStreamPlaceholder />;
  }

  if (streamState.waitingForShare) {
    return (
      <div style={placeholderStyle}>
        <span style={{ fontSize: 14 }}>Connecting to {streamState.targetUserName}'s stream...</span>
      </div>
    );
  }

  return (
    <StreamShell immersive={immersive} onToggleImmersive={onToggleImmersive}>
      {diagnosticsEnabled && (
        <StreamDebugHud
          ownStream={false}
          streamerName={streamState.targetUserName}
          screenShareDiagnostics={null}
          consumerDiagnostics={streamState.consumerDiagnostics}
        />
      )}
      <StreamVideo stream={streamState.share.stream} muted />
    </StreamShell>
  );
}
