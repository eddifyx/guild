import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAppleHardwareProcessingGuidance,
  getPreferredNoiseSuppressionImplementation,
} from '../../../client/src/utils/voiceProcessing.js';

test('voice processing helpers describe the Apple hardware path honestly', () => {
  const preferred = getPreferredNoiseSuppressionImplementation('darwin-arm64');
  assert.equal(preferred.id, 'apple-voice-processing');
  assert.match(preferred.label, /Mac Hardware Processing/);
  assert.match(preferred.detail, /Control Center/);

  assert.match(
    getAppleHardwareProcessingGuidance({
      platformTarget: 'darwin-arm64',
      selectedInput: '',
      lowLatencyEnabled: false,
    }),
    /Voice Isolation/
  );

  assert.match(
    getAppleHardwareProcessingGuidance({
      platformTarget: 'darwin-arm64',
      selectedInput: 'mic-1',
      lowLatencyEnabled: false,
    }),
    /Input Device is set to Default/
  );

  assert.equal(
    getAppleHardwareProcessingGuidance({
      platformTarget: 'darwin-arm64',
      selectedInput: '',
      lowLatencyEnabled: true,
    }),
    null,
  );

  assert.equal(
    getAppleHardwareProcessingGuidance({
      platformTarget: 'win32-x64',
      selectedInput: '',
      lowLatencyEnabled: false,
    }),
    null,
  );
});
