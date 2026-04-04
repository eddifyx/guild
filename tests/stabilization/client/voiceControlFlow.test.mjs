import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createToggleDeafenAction,
  createToggleMuteAction,
  emitVoiceDeafenState,
  emitVoiceMuteState,
  emitVoiceSpeakingState,
} from '../../../client/src/features/voice/voiceControlFlow.mjs';
import { VOICE_SOCKET_EVENT_NAMES } from '../../../client/src/features/voice/voiceSocketRuntime.mjs';

function createStateContainer(initialValue) {
  return {
    value: initialValue,
    set(nextValue) {
      this.value = typeof nextValue === 'function' ? nextValue(this.value) : nextValue;
    },
  };
}

test('voice control emit helpers use the canonical socket event names', () => {
  const emitted = [];
  const socket = {
    emit(eventName, payload) {
      emitted.push([eventName, payload]);
    },
  };

  assert.equal(emitVoiceSpeakingState(socket, 'channel-1', false), true);
  assert.equal(emitVoiceMuteState(socket, 'channel-1', true), true);
  assert.equal(emitVoiceDeafenState(socket, 'channel-1', true), true);

  assert.deepEqual(emitted, [
    [VOICE_SOCKET_EVENT_NAMES.speaking, { channelId: 'channel-1', speaking: false }],
    [VOICE_SOCKET_EVENT_NAMES.toggleMute, { channelId: 'channel-1', muted: true }],
    [VOICE_SOCKET_EVENT_NAMES.toggleDeafen, { channelId: 'channel-1', deafened: true }],
  ]);
});

test('toggle mute flow pauses the producer, clears speaking, and emits mute state', () => {
  const emitted = [];
  const muted = createStateContainer(false);
  const speaking = createStateContainer(true);
  let mutedBeforeDeafen = false;
  let healthProbeCleared = 0;
  let healthProbeResets = 0;
  let producerPaused = 0;
  let producerResumed = 0;

  const toggleMute = createToggleMuteAction({
    socket: {
      emit(eventName, payload) {
        emitted.push([eventName, payload]);
      },
    },
    getCurrentChannelId: () => 'channel-1',
    getCurrentControlState: () => ({
      muted: muted.value,
      deafened: false,
      mutedBeforeDeafen,
    }),
    setMutedBeforeDeafen: (nextValue) => {
      mutedBeforeDeafen = nextValue;
    },
    setMuted: (nextValue) => muted.set(nextValue),
    setSpeaking: (nextValue) => speaking.set(nextValue),
    getProducer: () => ({
      pause() { producerPaused += 1; },
      resume() { producerResumed += 1; },
    }),
    clearVoiceHealthProbe: () => { healthProbeCleared += 1; },
    resetVoiceHealthProbeRetries: () => { healthProbeResets += 1; },
  });

  const nextState = toggleMute();

  assert.equal(nextState.muted, true);
  assert.equal(muted.value, true);
  assert.equal(speaking.value, false);
  assert.equal(mutedBeforeDeafen, true);
  assert.equal(healthProbeCleared, 1);
  assert.equal(healthProbeResets, 1);
  assert.equal(producerPaused, 1);
  assert.equal(producerResumed, 0);
  assert.deepEqual(emitted, [
    [VOICE_SOCKET_EVENT_NAMES.speaking, { channelId: 'channel-1', speaking: false }],
    [VOICE_SOCKET_EVENT_NAMES.toggleMute, { channelId: 'channel-1', muted: true }],
  ]);
});

test('toggle deafen flow mutes incoming audio, restores mute state on undeafen, and schedules health probe', () => {
  const emitted = [];
  const muted = createStateContainer(true);
  const deafened = createStateContainer(true);
  const speaking = createStateContainer(false);
  let mutedBeforeDeafen = false;
  let healthProbeResets = 0;
  const scheduledProbes = [];
  let producerPaused = 0;
  let producerResumed = 0;
  const audioA = { muted: false };
  const audioB = { muted: false };

  const toggleDeafen = createToggleDeafenAction({
    socket: {
      emit(eventName, payload) {
        emitted.push([eventName, payload]);
      },
    },
    getCurrentChannelId: () => 'channel-9',
    getCurrentControlState: () => ({
      muted: muted.value,
      deafened: deafened.value,
      mutedBeforeDeafen,
    }),
    setMutedBeforeDeafen: (nextValue) => {
      mutedBeforeDeafen = nextValue;
    },
    setDeafened: (nextValue) => deafened.set(nextValue),
    setMuted: (nextValue) => muted.set(nextValue),
    setSpeaking: (nextValue) => speaking.set(nextValue),
    getProducer: () => ({
      pause() { producerPaused += 1; },
      resume() { producerResumed += 1; },
    }),
    getAudioElements: () => [audioA, audioB],
    resetVoiceHealthProbeRetries: () => { healthProbeResets += 1; },
    scheduleVoiceHealthProbe: (...args) => { scheduledProbes.push(args); },
  });

  const nextState = toggleDeafen();

  assert.equal(nextState.deafened, false);
  assert.equal(deafened.value, false);
  assert.equal(muted.value, false);
  assert.equal(speaking.value, false);
  assert.equal(audioA.muted, false);
  assert.equal(audioB.muted, false);
  assert.equal(producerPaused, 0);
  assert.equal(producerResumed, 1);
  assert.equal(healthProbeResets, 1);
  assert.deepEqual(scheduledProbes, [[
    'channel-9',
    { delayMs: 1500, reason: 'undeafen' },
  ]]);
  assert.deepEqual(emitted, [
    [VOICE_SOCKET_EVENT_NAMES.toggleMute, { channelId: 'channel-9', muted: false }],
    [VOICE_SOCKET_EVENT_NAMES.toggleDeafen, { channelId: 'channel-9', deafened: false }],
  ]);
});
