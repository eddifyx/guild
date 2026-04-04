import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanupRemoteVoiceProducer,
  listIncomingScreenShares,
  removeVoiceConsumerDiagnostics,
  removeVoiceUserAudioEntry,
  setVoiceUserAudioEntry,
} from '../../../client/src/features/voice/voiceRemoteMediaState.mjs';

test('voice remote media state lists incoming screen shares from producer entries', () => {
  const shares = listIncomingScreenShares(new Map([
    ['producer-1', { userId: 'user-1', stream: { id: 'stream-1' } }],
    ['producer-2', { userId: 'user-2', stream: { id: 'stream-2' } }],
  ]).entries());

  assert.deepEqual(shares, [
    { producerId: 'producer-1', userId: 'user-1', stream: { id: 'stream-1' } },
    { producerId: 'producer-2', userId: 'user-2', stream: { id: 'stream-2' } },
  ]);
});

test('voice remote media state manages per-user audio entries', () => {
  const userAudio = new Map();
  const audioA = { id: 'audio-a' };
  const audioB = { id: 'audio-b' };

  setVoiceUserAudioEntry(userAudio, 'user-1', 'producer-1', audioA);
  setVoiceUserAudioEntry(userAudio, 'user-1', 'producer-2', audioB);
  assert.equal(userAudio.get('user-1').size, 2);

  removeVoiceUserAudioEntry(userAudio, 'user-1', 'producer-1');
  assert.equal(userAudio.get('user-1').size, 1);

  removeVoiceUserAudioEntry(userAudio, 'user-1', 'producer-2');
  assert.equal(userAudio.has('user-1'), false);
});

test('voice remote media state removes consumer diagnostics for a producer', () => {
  let diagnostics = {
    consumers: {
      'producer-1': { playback: { state: 'playing' } },
      'producer-2': { playback: { state: 'blocked' } },
    },
  };

  removeVoiceConsumerDiagnostics((updater) => {
    diagnostics = updater(diagnostics);
  }, 'producer-1');

  assert.deepEqual(diagnostics, {
    consumers: {
      'producer-2': { playback: { state: 'blocked' } },
    },
  });
});

test('voice remote media state cleans up audio elements, consumers, screen shares, and diagnostics together', () => {
  const consumerClosed = [];
  const consumers = new Map([
    ['producer-9', { close: () => consumerClosed.push('producer-9') }],
  ]);
  const audio = {
    pauseCalled: false,
    srcObject: { id: 'stream-9' },
    parentNode: {
      removed: [],
      removeChild(node) {
        this.removed.push(node);
      },
    },
    pause() {
      this.pauseCalled = true;
    },
  };
  const audioElements = new Map([['producer-9', audio]]);
  const userAudio = new Map([['user-9', new Map([['producer-9', audio]])]]);
  const producerMeta = new Map([['producer-9', { userId: 'user-9', source: 'screen-video' }]]);
  const producerUserMap = new Map([['producer-9', 'user-9']]);
  const screenShareVideos = new Map([['producer-9', { userId: 'user-9', stream: { id: 'screen-9' } }]]);
  const syncCalls = [];
  const hookCleanupCalls = [];
  let diagnostics = {
    consumers: {
      'producer-9': { playback: { state: 'playing' } },
    },
  };

  cleanupRemoteVoiceProducer('producer-9', {
    consumers,
    audioElements,
    userAudio,
    producerMeta,
    producerUserMap,
    screenShareVideos,
    clearVoicePlaybackHooksFn: (nextAudio) => hookCleanupCalls.push(nextAudio),
    syncIncomingScreenSharesFn: () => syncCalls.push('synced'),
    updateVoiceDiagnosticsFn: (updater) => {
      diagnostics = updater(diagnostics);
    },
  });

  assert.deepEqual(consumerClosed, ['producer-9']);
  assert.equal(audio.pauseCalled, true);
  assert.equal(audio.srcObject, null);
  assert.deepEqual(audio.parentNode.removed, [audio]);
  assert.equal(audioElements.has('producer-9'), false);
  assert.equal(userAudio.has('user-9'), false);
  assert.equal(producerMeta.has('producer-9'), false);
  assert.equal(producerUserMap.has('producer-9'), false);
  assert.equal(screenShareVideos.has('producer-9'), false);
  assert.deepEqual(syncCalls, ['synced']);
  assert.deepEqual(hookCleanupCalls, [audio]);
  assert.deepEqual(diagnostics, { consumers: {} });
});
