import test from 'node:test';
import assert from 'node:assert/strict';

import {
  attachVoiceConsumerPlaybackRuntime,
  clearVoicePlaybackHooks,
  updateVoiceConsumerPlayback,
} from '../../../client/src/features/voice/voiceConsumerPlayback.mjs';

function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(eventName, handler) {
      if (!listeners.has(eventName)) {
        listeners.set(eventName, new Set());
      }
      listeners.get(eventName).add(handler);
    },
    removeEventListener(eventName, handler) {
      listeners.get(eventName)?.delete(handler);
    },
    emit(eventName) {
      for (const handler of listeners.get(eventName) || []) {
        handler();
      }
    },
    listenerCount(eventName) {
      return listeners.get(eventName)?.size || 0;
    },
  };
}

test('voice consumer playback updates diagnostics for a specific producer', () => {
  let diagnostics = {
    consumers: {
      'producer-1': {
        playback: null,
      },
    },
  };

  updateVoiceConsumerPlayback((updater) => {
    diagnostics = updater(diagnostics);
  }, 'producer-1', {
    state: 'playing',
    via: 'initial',
    startedAt: 'now',
    error: null,
  });

  assert.deepEqual(diagnostics.consumers['producer-1'].playback, {
    state: 'playing',
    via: 'initial',
    startedAt: 'now',
    error: null,
  });
});

test('voice consumer playback runtime retries blocked playback on user gesture and clears hooks after success', async () => {
  const audio = createEventTarget();
  const track = createEventTarget();
  const documentObject = createEventTarget();
  const windowObject = createEventTarget();
  const diagnostics = [];
  const laneEvents = [];
  const playCalls = [];
  let shouldBlock = true;

  audio.play = async () => {
    playCalls.push(shouldBlock ? 'blocked' : 'playing');
    if (shouldBlock) {
      throw new Error('autoplay blocked');
    }
  };

  attachVoiceConsumerPlaybackRuntime({
    audio,
    consumerTrack: track,
    chId: 'channel-1',
    producerId: 'producer-2',
    producerUserId: 'user-2',
    buildPlaybackErrorMessageFn: (error) => error.message,
    updateVoiceDiagnosticsFn: (updater) => diagnostics.push(typeof updater === 'function' ? updater({ consumers: { 'producer-2': {} } }) : updater),
    recordLaneDiagnosticFn: (...args) => laneEvents.push(args),
    documentObject,
    windowObject,
  });

  await Promise.resolve();
  await Promise.resolve();

  assert.equal(documentObject.listenerCount('click'), 1);
  assert.equal(windowObject.listenerCount('focus'), 1);
  assert.equal(diagnostics.at(-1).consumers['producer-2'].playback.state, 'blocked');

  shouldBlock = false;
  documentObject.emit('click');
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(diagnostics.at(-1).consumers['producer-2'].playback.state, 'playing');
  assert.equal(documentObject.listenerCount('click'), 0);
  assert.equal(windowObject.listenerCount('focus'), 0);
  assert.deepEqual(playCalls, ['blocked', 'playing']);
  assert.equal(laneEvents[0][1], 'audio_playback_blocked');
  assert.equal(laneEvents.at(-1)[1], 'audio_playback_started');
});

test('voice consumer playback cleanup removes retry and media listeners', () => {
  const audio = createEventTarget();
  const track = createEventTarget();
  const documentObject = createEventTarget();
  const windowObject = createEventTarget();

  audio.play = async () => {
    throw new Error('still blocked');
  };

  attachVoiceConsumerPlaybackRuntime({
    audio,
    consumerTrack: track,
    producerId: 'producer-3',
    updateVoiceDiagnosticsFn: () => {},
    documentObject,
    windowObject,
  });

  clearVoicePlaybackHooks(audio);

  assert.equal(documentObject.listenerCount('click'), 0);
  assert.equal(documentObject.listenerCount('keydown'), 0);
  assert.equal(windowObject.listenerCount('focus'), 0);
  assert.equal(audio.listenerCount('loadedmetadata'), 0);
  assert.equal(track.listenerCount('unmute'), 0);
});
