import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyAudioSettingsNoiseSuppressionRouting,
  updateAudioSettingsMicMeter,
} from '../../../client/src/features/voice/audioSettingsControllerRuntimeUtils.mjs';

test('audio settings controller runtime updates mic meter refs with normalized presentation', () => {
  const refs = {
    meterFillRef: { current: { style: {} } },
    meterValueRef: { current: { style: {}, textContent: '' } },
    meterStatusRef: { current: { textContent: '' } },
  };

  const result = updateAudioSettingsMicMeter({
    level: 152,
    refs,
    getMicLevelColorFn: () => '#0f0',
    getMicStatusTextFn: () => 'Loud',
  });

  assert.deepEqual(result, {
    normalized: 100,
    color: '#0f0',
  });
  assert.equal(refs.meterFillRef.current.style.width, '100%');
  assert.equal(refs.meterFillRef.current.style.background, '#0f0');
  assert.equal(refs.meterValueRef.current.textContent, '100');
  assert.equal(refs.meterValueRef.current.style.color, '#0f0');
  assert.equal(refs.meterStatusRef.current.textContent, 'Loud');
});

test('audio settings controller runtime switches routing only when a processed lane is ready', () => {
  const routing = {
    processedReady: true,
    rawBypassGain: { gain: { value: 1 } },
    processedGain: { gain: { value: 0 } },
  };

  const enabledResult = applyAudioSettingsNoiseSuppressionRouting({
    enabled: true,
    routing,
  });
  assert.equal(enabledResult, true);
  assert.equal(routing.rawBypassGain.gain.value, 0);
  assert.equal(routing.processedGain.gain.value, 1);

  const disabledResult = applyAudioSettingsNoiseSuppressionRouting({
    enabled: false,
    routing,
  });
  assert.equal(disabledResult, false);
  assert.equal(routing.rawBypassGain.gain.value, 1);
  assert.equal(routing.processedGain.gain.value, 0);

  assert.equal(
    applyAudioSettingsNoiseSuppressionRouting({ enabled: true, routing: null }),
    false,
  );
});
