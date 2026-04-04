import test from 'node:test';
import assert from 'node:assert/strict';

import {
  startProcessedVoiceCaptureGraph,
  startSafeModeVoiceCaptureGraph,
} from '../../../client/src/features/voice/voiceCaptureGraphRuntime.mjs';

function createNode(label) {
  return {
    label,
    gain: { value: null },
    connections: [],
    connect(target) {
      this.connections.push(target);
    },
  };
}

function createAudioContextFactory({ state = 'running' } = {}) {
  return class FakeAudioContext {
    constructor(options) {
      this.options = options;
      this.state = state;
      this.destination = createNode('destination');
      this.resumeCalls = 0;
    }

    async resume() {
      this.resumeCalls += 1;
      this.state = 'running';
    }

    createMediaStreamSource(stream) {
      const source = createNode('micSource');
      source.stream = stream;
      return source;
    }

    createGain() {
      return createNode('gain');
    }

    createMediaStreamDestination() {
      return {
        stream: {
          getAudioTracks() {
            return [{ id: 'dest-track', enabled: false }];
          },
        },
      };
    }
  };
}

test('voice capture graph runtime builds the safe-mode analysis graph', async () => {
  const capture = {};
  const AudioContextCtor = createAudioContextFactory({ state: 'suspended' });

  const result = await startSafeModeVoiceCaptureGraph({
    capture,
    stream: { id: 'stream-1' },
    getVoiceAudioContextOptionsFn: () => ({ latencyHint: 'interactive' }),
    readStoredMicGainFn: () => 1.7,
    audioContextCtor: AudioContextCtor,
    nowFn: (() => {
      let tick = 0;
      return () => (tick += 5);
    })(),
    roundMsFn: (value) => value,
  });

  assert.equal(result.audioGraphSetupMs, 5);
  assert.equal(result.error, null);
  assert.equal(capture.micCtx.resumeCalls, 1);
  assert.equal(capture.gainNode.gain.value, 1.7);
  assert.equal(capture.vadNode, capture.gainNode);
  assert.equal(result.micSource.connections[0], capture.gainNode);
  assert.equal(capture.gainNode.connections.length, 0);
});

test('voice capture graph runtime reports safe-mode graph failures without throwing', async () => {
  const capture = {};
  const errors = [];
  class BrokenAudioContext {
    constructor() {
      this.state = 'running';
    }

    createMediaStreamSource() {
      throw new Error('graph failed');
    }
  }

  const result = await startSafeModeVoiceCaptureGraph({
    capture,
    stream: { id: 'stream-2' },
    audioContextCtor: BrokenAudioContext,
    nowFn: (() => {
      let tick = 0;
      return () => (tick += 7);
    })(),
    roundMsFn: (value) => value,
    onGraphUnavailable: (error) => errors.push(error.message),
  });

  assert.equal(result.audioGraphSetupMs, 7);
  assert.equal(result.error.message, 'graph failed');
  assert.deepEqual(errors, ['graph failed']);
});

test('voice capture graph runtime builds the processed capture graph and destination track', async () => {
  const capture = {};
  const AudioContextCtor = createAudioContextFactory({ state: 'suspended' });

  const result = await startProcessedVoiceCaptureGraph({
    capture,
    stream: { id: 'stream-3' },
    getVoiceAudioContextOptionsFn: () => ({ latencyHint: 'balanced' }),
    readStoredMicGainFn: () => 2.2,
    audioContextCtor: AudioContextCtor,
    nowFn: (() => {
      let tick = 0;
      return () => (tick += 6);
    })(),
    roundMsFn: (value) => value,
  });

  assert.equal(result.audioGraphSetupMs, 6);
  assert.equal(capture.micCtx.resumeCalls, 1);
  assert.equal(capture.gainNode.gain.value, 2.2);
  assert.equal(capture.vadNode, capture.gainNode);
  assert.equal(result.destinationTrack.id, 'dest-track');
  assert.equal(capture.gainNode.connections.length, 1);
  assert.equal(capture.gainNode.connections[0].stream.getAudioTracks()[0].id, 'dest-track');
});
