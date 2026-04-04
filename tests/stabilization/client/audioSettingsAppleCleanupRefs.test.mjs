import test from 'node:test';
import assert from 'node:assert/strict';

import { cleanupAudioSettingsAppleRefs } from '../../../client/src/features/voice/audioSettingsAppleCleanupRefs.mjs';

test('audio settings apple cleanup refs tears down cleanup refs, source nodes, preview audio, and context', async () => {
  const cleanupCalls = [];
  let previewPaused = false;
  let audioCtxClosed = false;
  let sourceReset = 0;
  let sourceDisconnected = 0;

  const refs = {
    appleVoiceFrameCleanupRef: { current: () => cleanupCalls.push('frame') },
    appleVoiceStateCleanupRef: { current: () => cleanupCalls.push('state') },
    appleVoiceSourceNodeRef: {
      current: {
        port: {
          postMessage(message) {
            if (message?.type === 'reset') {
              sourceReset += 1;
            }
          },
        },
        disconnect() {
          sourceDisconnected += 1;
        },
      },
    },
    previewAudioRef: {
      current: {
        srcObject: { id: 'preview' },
        src: 'blob:test',
        pause() {
          previewPaused = true;
        },
      },
    },
    audioCtxRef: {
      current: {
        async close() {
          audioCtxClosed = true;
        },
      },
    },
  };

  await cleanupAudioSettingsAppleRefs(refs);

  assert.deepEqual(cleanupCalls, ['frame', 'state']);
  assert.equal(sourceReset, 1);
  assert.equal(sourceDisconnected, 1);
  assert.equal(previewPaused, true);
  assert.equal(audioCtxClosed, true);
  assert.equal(refs.appleVoiceFrameCleanupRef.current, null);
  assert.equal(refs.appleVoiceStateCleanupRef.current, null);
  assert.equal(refs.appleVoiceSourceNodeRef.current, null);
  assert.equal(refs.previewAudioRef.current, null);
  assert.equal(refs.audioCtxRef.current, null);
});

test('audio settings apple cleanup refs tolerate missing nodes and cleanup failures', async () => {
  const refs = {
    appleVoiceFrameCleanupRef: { current: null },
    appleVoiceStateCleanupRef: { current: null },
    appleVoiceSourceNodeRef: {
      current: {
        port: {
          postMessage() {
            throw new Error('reset-failed');
          },
        },
        disconnect() {
          throw new Error('disconnect-failed');
        },
      },
    },
    previewAudioRef: { current: null },
    audioCtxRef: {
      current: {
        async close() {
          throw new Error('close-failed');
        },
      },
    },
  };

  await cleanupAudioSettingsAppleRefs(refs);

  assert.equal(refs.appleVoiceSourceNodeRef.current, null);
  assert.equal(refs.audioCtxRef.current, null);
});
