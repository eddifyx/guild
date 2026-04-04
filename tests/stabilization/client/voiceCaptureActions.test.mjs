import test from 'node:test';
import assert from 'node:assert/strict';

import { createVoiceCaptureActions } from '../../../client/src/features/voice/voiceCaptureActions.mjs';

test('voice capture actions delegate VAD, live capture, reconfigure, and health probes through one lane context', async () => {
  const calls = [];
  const refs = {
    vadIntervalRef: { current: null },
    mutedRef: { current: false },
    channelIdRef: { current: 'channel-1' },
    liveCaptureConfigGenRef: { current: 0 },
    liveCaptureRef: { current: { id: 'capture-1' } },
    producerRef: { current: { id: 'producer-1' } },
    sendTransportRef: { current: { id: 'send-1' } },
    pendingVoiceModeSwitchTraceRef: { current: 'trace-1' },
    voiceHealthProbeTimeoutRef: { current: null },
    voiceHealthProbeRetryCountRef: { current: 0 },
  };

  const actions = createVoiceCaptureActions({
    refs,
    setters: {
      setSpeakingFn: (value) => calls.push(['setSpeaking', value]),
      setLiveVoiceFallbackReasonFn: (value) => calls.push(['setFallback', value]),
      setMutedFn: (value) => calls.push(['setMuted', value]),
    },
    runtime: {
      socket: { id: 'socket-1' },
      startVoiceVadRuntimeFn: ({ currentVadIntervalId }) => {
        calls.push(['startVAD', currentVadIntervalId]);
        return 91;
      },
      onVadError: (error) => calls.push(['vadError', error.message]),
      applyVoiceLiveCaptureProducerFn: async (payload) => {
        calls.push(['applyLiveCapture', payload.chId, payload.perfTraceId]);
        await payload.attachLiveCaptureProducerFn({
          previousProducer: { id: 'producer-1' },
          nextCapture: { id: 'capture-2' },
          nextDiagnostics: { state: 'ready' },
          sendTransport: { id: 'send-2' },
        });
      },
      createLiveMicCaptureFn: async (payload) => {
        calls.push(['createLiveMicCapture', payload.chId, payload.mode]);
        return { id: 'capture-2' };
      },
      getStoredVoiceProcessingModeFn: () => 'standard',
      disposeLiveCaptureFn: () => calls.push(['disposeLiveCapture']),
      attachLiveCaptureProducerFn: async (payload) => {
        calls.push([
          'attachLiveCaptureProducer',
          payload.voiceMaxBitrate,
          payload.disableOpusDtx,
          payload.voiceSafeMode,
        ]);
      },
      getVoiceAudioBypassModeFn: () => null,
      applySenderPreferencesFn: async () => calls.push(['applySenderPreferences']),
      attachSenderEncryptionFn: () => calls.push(['attachSenderEncryption']),
      roundMsFn: (value) => value,
      syncLiveCaptureRefsFn: () => calls.push(['syncLiveCaptureRefs']),
      updateVoiceDiagnosticsFn: (value) => calls.push(['updateVoiceDiagnostics', typeof value]),
      addPerfPhaseFn: (...args) => calls.push(['addPerfPhase', ...args]),
      endPerfTraceFn: (...args) => calls.push(['endPerfTrace', ...args]),
      cancelPerfTraceFn: (...args) => calls.push(['cancelPerfTrace', ...args]),
      normalizeVoiceErrorMessageFn: (error) => error?.message || '',
      reconfigureVoiceLiveCaptureFn: async (payload) => {
        calls.push(['reconfigureLiveCapture', payload.perfTraceId]);
      },
      warnFn: (...args) => calls.push(['warn', ...args]),
      scheduleVoiceHealthProbeFlowFn: (payload) => {
        calls.push(['scheduleHealthProbe', payload.chId, payload.delayMs, payload.reason]);
      },
      clearVoiceHealthProbeFn: () => calls.push(['clearHealthProbe']),
      setTimeoutFn: (callback) => {
        callback();
        return 11;
      },
      runVoiceHealthProbeCheckFn: (...args) => calls.push(['runHealthProbeCheck', ...args]),
      summarizeProducerStatsFn: (value) => value,
    },
    constants: {
      voiceMaxBitrate: 64000,
      disableOpusDtx: true,
      voiceSafeMode: true,
    },
  });

  actions.startVAD({ id: 'gain-1' });
  await actions.applyLiveCaptureToProducer({ chId: 'channel-1', perfTraceId: 'trace-live' });
  await actions.reconfigureLiveCapture({ perfTraceId: 'trace-reconfig' });
  actions.scheduleVoiceHealthProbe('channel-1', { delayMs: 3333, reason: 'manual' });

  assert.equal(refs.vadIntervalRef.current, 91);
  assert.equal(
    calls.some((entry) => entry[0] === 'attachLiveCaptureProducer'
      && entry[1] === 64000
      && entry[2] === true
      && entry[3] === true),
    true
  );
  assert.equal(calls.some((entry) => entry[0] === 'reconfigureLiveCapture' && entry[1] === 'trace-reconfig'), true);
  assert.equal(calls.some((entry) => entry[0] === 'scheduleHealthProbe' && entry[1] === 'channel-1' && entry[2] === 3333), true);
});
