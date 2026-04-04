import test from 'node:test';
import assert from 'node:assert/strict';

import {
  attachAudioSettingsMonitorOutput,
  clearAudioSettingsPreviewPlayback,
} from '../../../client/src/features/voice/audioSettingsMonitorRuntime.mjs';

function createFakeMonitorContext() {
  const log = [];
  const destination = { id: 'destination' };
  const previewDestination = { stream: { id: 'preview-stream' } };

  const ctx = {
    destination,
    createGain() {
      return {
        gain: { value: 0 },
        connect: (...args) => log.push(['monitorGain.connect', ...args]),
        disconnect: (...args) => log.push(['monitorGain.disconnect', ...args]),
      };
    },
    createChannelMerger(channelCount) {
      return {
        channelCount,
        connect: (...args) => log.push(['channelMerger.connect', ...args]),
      };
    },
    createMediaStreamDestination() {
      return previewDestination;
    },
  };

  const gainNode = {
    connect: (...args) => log.push(['gainNode.connect', ...args]),
  };

  return { ctx, gainNode, log, previewDestination };
}

test('audio settings monitor runtime clears preview playback safely', () => {
  const previewAudio = {
    paused: false,
    srcObject: { id: 'stream' },
    src: 'blob:test',
    pause() {
      this.paused = true;
    },
  };
  const previewAudioRef = { current: previewAudio };

  clearAudioSettingsPreviewPlayback(previewAudioRef);

  assert.equal(previewAudio.paused, true);
  assert.equal(previewAudio.srcObject, null);
  assert.equal(previewAudio.src, '');
  assert.equal(previewAudioRef.current, null);
});

test('audio settings monitor runtime uses direct monitoring when sink routing is bypassed', async () => {
  const { ctx, gainNode, log } = createFakeMonitorContext();
  const monitorGainRef = { current: null };

  const result = await attachAudioSettingsMonitorOutput({
    ctx,
    gainNode,
    activeOutputId: 'default',
    monitorProfile: { gain: 0.5 },
    preferDirectMonitor: true,
    refs: {
      monitorGainRef,
      previewAudioRef: { current: null },
    },
    runtime: {
      performanceNowFn: () => 100,
    },
  });

  assert.equal(result.mode, 'direct');
  assert.equal(result.playbackError, null);
  assert.equal(monitorGainRef.current.gain.value, 0.5);
  assert.equal(log.some((entry) => entry[0] === 'monitorGain.connect' && entry[1] === ctx.destination), true);
});

test('audio settings monitor runtime can use preview playback on the default output when requested', async () => {
  const { ctx, gainNode, log } = createFakeMonitorContext();

  class DefaultPreviewAudio {
    constructor() {
      this.readyState = 2;
      this.listeners = [];
      this.played = false;
    }
    addEventListener(event, handler) {
      this.listeners.push([event, handler]);
    }
    async play() {
      this.played = true;
    }
  }

  const result = await attachAudioSettingsMonitorOutput({
    ctx,
    gainNode,
    activeOutputId: '',
    monitorProfile: { gain: 0.5 },
    preferDirectMonitor: true,
    refs: {
      monitorGainRef: { current: null },
      previewAudioRef: { current: null },
    },
    runtime: {
      audioCtor: DefaultPreviewAudio,
      clearPreviewPlaybackFn: () => {},
      performanceNowFn: () => 150,
      setTimeoutFn: () => {},
      haveMetadataReadyState: 1,
      preferPreviewMonitorOnDefault: true,
    },
  });

  assert.equal(result.mode, 'sink');
  assert.equal(result.playbackError, null);
  assert.equal(log.some((entry) => entry[0] === 'monitorGain.connect' && entry[1] === ctx.destination), false);
});

test('audio settings monitor runtime skips sink routing for the literal default device id', async () => {
  const { ctx, gainNode, log } = createFakeMonitorContext();
  const sinkCalls = [];

  class DefaultSinkAudio {
    constructor() {
      this.readyState = 2;
      this.listeners = [];
    }
    addEventListener(event, handler) {
      this.listeners.push([event, handler]);
    }
    async play() {
      this.played = true;
    }
    async setSinkId(deviceId) {
      sinkCalls.push(deviceId);
    }
  }

  const result = await attachAudioSettingsMonitorOutput({
    ctx,
    gainNode,
    activeOutputId: 'default',
    monitorProfile: { gain: 0.5 },
    preferDirectMonitor: true,
    refs: {
      monitorGainRef: { current: null },
      previewAudioRef: { current: null },
    },
    runtime: {
      audioCtor: DefaultSinkAudio,
      clearPreviewPlaybackFn: () => {},
      performanceNowFn: () => 175,
      setTimeoutFn: () => {},
      haveMetadataReadyState: 1,
      preferPreviewMonitorOnDefault: true,
    },
  });

  assert.equal(result.mode, 'sink');
  assert.equal(result.playbackError, null);
  assert.deepEqual(sinkCalls, []);
  assert.equal(log.some((entry) => entry[0] === 'monitorGain.connect' && entry[1] === ctx.destination), false);
});

test('audio settings monitor runtime falls back cleanly when setSinkId is unavailable', async () => {
  const { ctx, gainNode } = createFakeMonitorContext();
  const previewAudioRef = { current: null };
  let cleared = 0;

  class FakeAudio {
    constructor() {
      this.readyState = 0;
      this.srcObject = null;
      this.src = '';
    }
    pause() {}
    addEventListener() {}
  }

  const result = await attachAudioSettingsMonitorOutput({
    ctx,
    gainNode,
    activeOutputId: 'speaker-1',
    monitorProfile: { gain: 0.8 },
    refs: {
      monitorGainRef: { current: null },
      previewAudioRef,
    },
    runtime: {
      audioCtor: FakeAudio,
      clearPreviewPlaybackFn: () => {
        cleared += 1;
        clearAudioSettingsPreviewPlayback(previewAudioRef);
      },
      performanceNowFn: () => 200,
    }
  });

  assert.equal(result.mode, 'direct-fallback');
  assert.match(result.playbackError, /unavailable here/i);
  assert.equal(cleared, 1);
  assert.equal(previewAudioRef.current, null);
});

test('audio settings monitor runtime falls back cleanly when setSinkId or play fails', async () => {
  const { ctx, gainNode } = createFakeMonitorContext();

  class SinkErrorAudio {
    constructor() {
      this.readyState = 2;
    }
    async setSinkId() {
      throw new Error('sink-failed');
    }
  }

  const sinkResult = await attachAudioSettingsMonitorOutput({
    ctx,
    gainNode,
    activeOutputId: 'speaker-2',
    monitorProfile: { gain: 1 },
    refs: {
      monitorGainRef: { current: null },
      previewAudioRef: { current: null },
    },
    runtime: {
      audioCtor: SinkErrorAudio,
      clearPreviewPlaybackFn: () => {},
      performanceNowFn: () => 300,
    },
  });

  assert.equal(sinkResult.mode, 'direct-fallback');
  assert.equal(sinkResult.playbackError, 'sink-failed');

  class PlayErrorAudio {
    constructor() {
      this.readyState = 2;
      this.listeners = [];
    }
    async setSinkId() {}
    addEventListener(event, handler) {
      this.listeners.push([event, handler]);
    }
    async play() {
      throw new Error('play-failed');
    }
  }

  const playResult = await attachAudioSettingsMonitorOutput({
    ctx,
    gainNode,
    activeOutputId: 'speaker-3',
    monitorProfile: { gain: 1 },
    refs: {
      monitorGainRef: { current: null },
      previewAudioRef: { current: null },
    },
    runtime: {
      audioCtor: PlayErrorAudio,
      clearPreviewPlaybackFn: () => {},
      performanceNowFn: () => 400,
      setTimeoutFn: (callback) => callback(),
      haveMetadataReadyState: 1,
    },
  });

  assert.equal(playResult.mode, 'sink');
  assert.equal(playResult.playbackState, 'live-playing');
  assert.equal(playResult.playbackError, 'play-failed');
});
