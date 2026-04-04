import test from 'node:test';
import assert from 'node:assert/strict';

import { createVoiceUiActions } from '../../../client/src/features/voice/voiceUiActions.mjs';

test('voice ui actions delegate control, routing, and device updates through one lane context', async () => {
  const calls = [];
  const refs = {
    channelIdRef: { current: 'channel-1' },
    mutedRef: { current: false },
    deafenedRef: { current: false },
    mutedBeforeDeafenRef: { current: null },
    producerRef: { current: { id: 'producer-1' } },
    audioElementsRef: { current: new Map([['audio-1', { volume: 0.5 }]]) },
    voiceHealthProbeRetryCountRef: { current: 4 },
    pendingLiveReconfigureRef: { current: null },
    pendingVoiceModeSwitchTraceRef: { current: 'trace-1' },
    voiceProcessingModeRef: { current: 'standard' },
    micGainNodeRef: { current: { gain: { value: 1 } } },
    userAudioRef: { current: new Map([['user-2', new Map([['producer-2', { volume: 0.3 }]])]]) },
  };

  const actions = createVoiceUiActions({
    refs,
    setters: {
      setMutedFn: (value) => calls.push(['setMuted', value]),
      setSpeakingFn: (value) => calls.push(['setSpeaking', value]),
      setDeafenedFn: (value) => calls.push(['setDeafened', value]),
      setVoiceProcessingModeStateFn: (value) => calls.push(['setVoiceProcessingModeState', value]),
      setLiveVoiceFallbackReasonFn: (value) => calls.push(['setFallback', value]),
    },
    runtime: {
      socket: {
        emit: (...args) => calls.push(['socket.emit', ...args]),
      },
      clearVoiceHealthProbeFn: () => calls.push(['clearHealthProbe']),
      scheduleVoiceHealthProbeFn: (...args) => calls.push(['scheduleHealthProbe', ...args]),
      scheduleVoiceLiveReconfigureFlowFn: (payload) => {
        calls.push(['scheduleLiveReconfigure', payload.perfTraceId]);
      },
      clearTimeoutFn: (...args) => calls.push(['clearTimeout', ...args]),
      setTimeoutFn: (...args) => calls.push(['setTimeout', ...args]),
      cancelPerfTraceFn: (...args) => calls.push(['cancelPerfTrace', ...args]),
      addPerfPhaseFn: (...args) => calls.push(['addPerfPhase', ...args]),
      reconfigureLiveCaptureFn: (...args) => calls.push(['reconfigureLiveCapture', ...args]),
      startPerfTraceFn: (...args) => {
        calls.push(['startPerfTrace', ...args]);
        return 'trace-new';
      },
      endPerfTraceFn: (...args) => calls.push(['endPerfTrace', ...args]),
      switchLiveCaptureModeInPlaceFn: () => ({
        handled: false,
        reason: 'needs-reconfigure',
      }),
      applyNoiseSuppressionRoutingFn: (...args) => calls.push(['applyNoiseSuppressionRouting', ...args]),
      applyVoiceModeDependenciesFn: (mode) => {
        calls.push(['applyVoiceModeDependencies', mode]);
        return {
          mode,
          noiseSuppression: mode !== 'ultra-low-latency',
        };
      },
      persistVoiceProcessingModeFn: (...args) => calls.push(['persistVoiceProcessingMode', ...args]),
      persistNoiseSuppressionEnabledFn: (...args) => calls.push(['persistNoiseSuppressionEnabled', ...args]),
      isUltraLowLatencyModeFn: (mode) => mode === 'ultra-low-latency',
    },
  });

  actions.toggleMute();
  actions.toggleDeafen();
  actions.scheduleLiveVoiceReconfigure('trace-2');
  actions.setVoiceProcessingMode('ultra-low-latency', { perfSource: 'test' });
  actions.toggleNoiseSuppression(true);
  actions.setMicGain(1.7);
  actions.setUserVolume('user-2', 0.8);
  actions.setOutputDevice('default');

  assert.equal(refs.voiceHealthProbeRetryCountRef.current, 0);
  assert.equal(refs.micGainNodeRef.current.gain.value, 1.7);
  assert.equal(refs.userAudioRef.current.get('user-2').get('producer-2').volume, 0.8);
  assert.equal(calls.some((entry) => entry[0] === 'scheduleLiveReconfigure' && entry[1] === 'trace-2'), true);
  assert.equal(calls.some((entry) => entry[0] === 'startPerfTrace'), true);
  assert.equal(calls.some((entry) => entry[0] === 'setVoiceProcessingModeState' && entry[1] === 'ultra-low-latency'), true);
  assert.equal(calls.some((entry) => entry[0] === 'persistVoiceProcessingMode' && entry[1] === 'standard'), true);
});
