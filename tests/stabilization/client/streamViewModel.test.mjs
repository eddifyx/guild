import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findActivePeerStreamerId,
  findChannelStreamer,
  formatStreamCount,
  formatStreamFps,
  formatStreamKbps,
  formatStreamMs,
  formatStreamResolution,
  formatStreamTimestamp,
  getStreamerName,
  isUserStillSharing,
  resolveStreamViewState,
} from '../../../client/src/features/stream/streamViewModel.mjs';

test('stream view model formats diagnostics values with stable fallbacks', () => {
  assert.equal(formatStreamResolution(1920, 1080), '1920x1080');
  assert.equal(formatStreamResolution(null, 1080), '—');
  assert.equal(formatStreamFps(29.94), '29.9 fps');
  assert.equal(formatStreamCount(42.6), '43');
  assert.equal(formatStreamMs(10.44), '10.4 ms');
  assert.equal(formatStreamKbps(1024.4), '1,024 kbps');
  assert.equal(formatStreamTimestamp('not-a-date'), '—');
});

test('stream view model resolves streamer names and active streamers from voice state', () => {
  const voiceChannels = [
    {
      id: 'voice-1',
      participants: [
        { userId: 'user-1', username: 'Alpha' },
        { userId: 'user-2', username: 'Beta', screenSharing: true },
      ],
    },
  ];

  assert.equal(getStreamerName({ voiceChannels, userId: 'user-2' }), 'Beta');
  assert.equal(findActivePeerStreamerId({
    screenSharing: false,
    peers: { 'user-2': { screenSharing: true } },
  }), 'user-2');
  assert.deepEqual(findChannelStreamer({
    channelId: 'voice-1',
    activePeerStreamerId: null,
    voiceChannels,
    currentUserId: 'user-1',
  }), { userId: 'user-2', username: 'Beta', screenSharing: true });
  assert.equal(isUserStillSharing({
    targetUserId: 'user-2',
    activePeerStreamerId: null,
    voiceChannels,
  }), true);
});

test('stream view model resolves own stream, remote stream, and empty state canonically', () => {
  const voiceChannels = [
    {
      id: 'voice-1',
      participants: [
        { userId: 'user-1', username: 'Alpha' },
        { userId: 'user-2', username: 'Beta', screenSharing: true },
      ],
    },
  ];

  const ownState = resolveStreamViewState({
    requestedUserId: 'user-1',
    currentUserId: 'user-1',
    screenSharing: true,
    screenShareStream: { id: 'local-stream' },
    peers: {},
  });
  assert.equal(ownState.isOwnStream, true);
  assert.equal(ownState.ownStreamMedia.id, 'local-stream');

  const remoteState = resolveStreamViewState({
    requestedUserId: null,
    currentUserId: 'user-1',
    screenSharing: false,
    incomingScreenShares: [
      { producerId: 'producer-1', userId: 'user-2', stream: { id: 'stream-1' } },
    ],
    voiceChannels,
    channelId: 'voice-1',
    peers: {},
    voiceDiagnostics: {
      consumers: {
        'producer-1': { sampledAt: '2026-03-26T00:00:00.000Z' },
      },
    },
  });
  assert.equal(remoteState.targetUserId, 'user-2');
  assert.equal(remoteState.share.stream.id, 'stream-1');
  assert.deepEqual(remoteState.consumerDiagnostics, { sampledAt: '2026-03-26T00:00:00.000Z' });

  const emptyState = resolveStreamViewState({
    requestedUserId: null,
    currentUserId: 'user-1',
    screenSharing: false,
    incomingScreenShares: [],
    voiceChannels: [],
    channelId: null,
    peers: {},
  });
  assert.equal(emptyState.showNoStream, true);
  assert.equal(emptyState.targetUserId, null);
});
