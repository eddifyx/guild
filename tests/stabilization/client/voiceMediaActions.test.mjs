import test from 'node:test';
import assert from 'node:assert/strict';

import { createVoiceMediaActions } from '../../../client/src/features/voice/voiceMediaActions.mjs';

test('voice media actions synchronize screen shares, mount audio, and clean producers through one lane context', () => {
  const calls = [];
  const host = {
    appended: [],
    appendChild(node) {
      this.appended.push(node);
      node.parentNode = this;
    },
  };
  const audio = {
    parentNode: null,
    style: {},
    setAttribute(name, value) {
      calls.push(['setAttribute', name, value]);
    },
  };

  const actions = createVoiceMediaActions({
    refs: {
      screenShareVideosRef: {
        current: new Map([
          ['producer-1', { userId: 'user-1', stream: { id: 'stream-1' } }],
        ]),
      },
      userAudioRef: { current: new Map() },
      consumersRef: { current: new Map([['producer-2', { id: 'consumer-2' }]]) },
      audioElementsRef: { current: new Map([['producer-2', audio]]) },
      producerMetaRef: { current: new Map([['producer-2', { source: 'microphone' }]]) },
      producerUserMapRef: { current: new Map([['producer-2', 'user-2']]) },
    },
    runtime: {
      setIncomingScreenSharesFn: (value) => calls.push(['setIncomingScreenShares', value]),
      listIncomingScreenSharesFn: (entries) => Array.from(entries).map(([producerId, value]) => ({ producerId, ...value })),
      setVoiceUserAudioEntryFn: (map, userId, producerId, element) => {
        calls.push(['setUserAudioEntry', userId, producerId]);
        if (!map.has(userId)) {
          map.set(userId, new Map());
        }
        map.get(userId).set(producerId, element);
      },
      ensureVoiceAudioHostFn: () => host,
      cleanupRemoteVoiceProducerFn: (...args) => calls.push(['cleanupRemoteVoiceProducer', ...args]),
      clearVoicePlaybackHooksFn: () => calls.push(['clearVoicePlaybackHooks']),
      updateVoiceDiagnosticsFn: (value) => calls.push(['updateVoiceDiagnostics', typeof value]),
    },
  });

  actions.syncIncomingScreenShares();
  actions.setUserAudioEntry('user-2', 'producer-2', audio);
  actions.mountRemoteAudioElement(audio, 'producer-2');
  actions.cleanupRemoteProducer('producer-2', { producerUserId: 'user-2', source: 'microphone' });

  assert.equal(calls.some((entry) => entry[0] === 'setIncomingScreenShares'), true);
  assert.equal(calls.some((entry) => entry[0] === 'setUserAudioEntry' && entry[1] === 'user-2'), true);
  assert.equal(host.appended[0], audio);
  assert.equal(audio.style.position, 'absolute');
  assert.equal(audio.style.width, '1px');
  assert.equal(audio.style.height, '1px');
  assert.equal(audio.style.opacity, '0.001');
  assert.equal(calls.some((entry) => entry[0] === 'cleanupRemoteVoiceProducer'), true);
});
