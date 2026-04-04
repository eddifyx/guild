import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyDeafenToggle,
  applyMuteToggle,
  getDefaultVoiceControlState,
} from '../../../client/src/features/voice/voiceControlState.mjs';

test('applyMuteToggle updates muted state and remembers standalone mute preference', () => {
  const nextState = applyMuteToggle({
    muted: false,
    deafened: false,
    mutedBeforeDeafen: false,
  });

  assert.deepEqual(nextState, {
    muted: true,
    deafened: false,
    mutedBeforeDeafen: true,
    shouldEmitSpeakingFalse: true,
    shouldScheduleHealthProbe: false,
  });
});

test('applyDeafenToggle remembers prior mute state when entering deafen', () => {
  const nextState = applyDeafenToggle({
    muted: false,
    deafened: false,
    mutedBeforeDeafen: false,
  });

  assert.deepEqual(nextState, {
    muted: true,
    deafened: true,
    mutedBeforeDeafen: false,
    shouldEmitSpeakingFalse: true,
    shouldEmitMuteUpdate: true,
    shouldScheduleHealthProbe: false,
  });
});

test('applyDeafenToggle restores pre-deafen mute preference when leaving deafen', () => {
  const nextState = applyDeafenToggle({
    muted: true,
    deafened: true,
    mutedBeforeDeafen: false,
  });

  assert.deepEqual(nextState, {
    muted: false,
    deafened: false,
    mutedBeforeDeafen: false,
    shouldEmitSpeakingFalse: false,
    shouldEmitMuteUpdate: true,
    shouldScheduleHealthProbe: true,
  });
});

test('getDefaultVoiceControlState resets voice controls to a known baseline', () => {
  assert.deepEqual(getDefaultVoiceControlState(), {
    muted: false,
    deafened: false,
    mutedBeforeDeafen: false,
    speaking: false,
  });
});
