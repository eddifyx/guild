import test from 'node:test';
import assert from 'node:assert/strict';

import { VOICE_RECOVERY_RUNTIME } from '../../../client/src/features/voice/voiceRecoveryConfig.mjs';

test('voice recovery config defaults to the candidate-C live voice recovery lane', () => {
  assert.deepEqual(VOICE_RECOVERY_RUNTIME, {
    voiceSafeMode: false,
    voiceEmergencyDirectSourceTrack: true,
    disableOpusDtx: true,
    forceFreshRawMicCapture: true,
    disableVoiceInsertableStreams: true,
  });
});
