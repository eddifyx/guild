import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyNoiseSuppressionRouting,
  applySenderPreferences,
  buildPlaybackErrorMessage,
  ensureVoiceAudioHost,
  getVoiceAudioBypassMode,
  isExpectedVoiceTeardownError,
  normalizeVoiceErrorMessage,
  roundMs,
  roundRate,
  summarizeSenderParameters,
  withTimeout,
} from '../../../client/src/features/voice/voiceRuntimeUtils.mjs';

test('voice runtime utils toggle routing gains only when processed routing is ready', () => {
  const routing = {
    processedReady: true,
    rawBypassGain: { gain: { value: 1 } },
    processedGain: { gain: { value: 0 } },
  };
  assert.equal(applyNoiseSuppressionRouting(routing, true), true);
  assert.equal(routing.rawBypassGain.gain.value, 0);
  assert.equal(routing.processedGain.gain.value, 1);
  assert.equal(roundMs(12.345), 12.3);
  assert.equal(roundRate(12.345, 2), 12.35);
});

test('voice runtime utils ensure an audio host and summarize sender parameters safely', () => {
  const created = [];
  const documentStub = {
    body: {
      appendChild(node) {
        created.push(node);
      },
    },
    getElementById() {
      return null;
    },
    createElement() {
      return {
        style: {},
        setAttribute() {},
      };
    },
  };

  const host = ensureVoiceAudioHost(documentStub);
  assert.equal(created.length, 1);
  assert.equal(host.id, 'voice-audio-host');
  assert.deepEqual(summarizeSenderParameters({
    degradationPreference: 'maintain-framerate',
    encodings: [{ maxBitrate: 64_000, priority: 'high' }],
  }), {
    degradationPreference: 'maintain-framerate',
    encodings: [{
      active: null,
      maxBitrate: 64_000,
      maxFramerate: null,
      scaleResolutionDownBy: null,
      scalabilityMode: null,
      priority: 'high',
      networkPriority: null,
    }],
  });
});

test('voice runtime utils derive bypass mode and apply sender preferences canonically', async () => {
  assert.equal(getVoiceAudioBypassMode({
    kind: 'audio',
    source: 'microphone',
    forceAudioBypassByKind: false,
    voiceSafeMode: true,
    bypassMode: 'fallback',
  }), 'bypassed-voice-safe-mode');
  assert.equal(getVoiceAudioBypassMode({
    kind: 'audio',
    source: 'microphone',
    forceAudioBypassByKind: true,
    voiceSafeMode: false,
    bypassMode: 'forced-audio-bypass',
  }), 'forced-audio-bypass');
  assert.equal(getVoiceAudioBypassMode({
    kind: 'audio',
    source: 'screen-share-audio',
    forceAudioBypassByKind: true,
    voiceSafeMode: false,
    bypassMode: 'forced-audio-bypass',
  }), 'forced-audio-bypass');
  assert.equal(getVoiceAudioBypassMode({
    kind: 'audio',
    source: 'microphone',
    forceAudioBypassByKind: false,
    voiceSafeMode: false,
    disableVoiceInsertableStreams: true,
    bypassMode: null,
  }), 'bypassed-plain-voice-transport');

  const sender = {
    parameters: { encodings: [{}] },
    getParameters() {
      return this.parameters;
    },
    async setParameters(parameters) {
      this.parameters = parameters;
    },
  };

  const parameters = await applySenderPreferences(sender, {
    maxBitrate: 96_000,
    maxFramerate: 30,
    priority: 'high',
  });

  assert.equal(parameters.encodings[0].maxBitrate, 96_000);
  assert.equal(parameters.encodings[0].maxFramerate, 30);
  assert.equal(parameters.encodings[0].priority, 'high');
});

test('voice runtime utils normalize teardown errors and playback messages', async () => {
  assert.equal(normalizeVoiceErrorMessage(new Error(' transport closed ')), 'transport closed');
  assert.equal(isExpectedVoiceTeardownError(new Error('transport closed')), true);
  assert.equal(buildPlaybackErrorMessage({ name: 'NotAllowedError' }), 'NotAllowedError');

  const timers = [];
  const resolved = await withTimeout(Promise.resolve('ok'), 25, 'timed out', {
    setTimeoutFn: (handler, delay) => {
      timers.push(['set', delay]);
      return 'timer-1';
    },
    clearTimeoutFn: (id) => {
      timers.push(['clear', id]);
    },
  });

  assert.equal(resolved, 'ok');
  assert.deepEqual(timers, [['set', 25], ['clear', 'timer-1']]);
});
