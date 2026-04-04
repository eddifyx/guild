import test from 'node:test';
import assert from 'node:assert/strict';

test('audio settings action flow split modules import cleanly and expose stable actions', async () => {
  const actionFlowModule = await import('../../../client/src/features/voice/audioSettingsActionFlow.mjs');
  const outputActionModule = await import('../../../client/src/features/voice/audioSettingsOutputActionFlow.mjs');
  const micTestStartModule = await import('../../../client/src/features/voice/audioSettingsMicTestStartFlow.mjs');

  assert.equal(typeof actionFlowModule.applyAudioSettingsOutputChange, 'function');
  assert.equal(typeof actionFlowModule.applyAudioSettingsProcessingModeChange, 'function');
  assert.equal(typeof actionFlowModule.restartAudioSettingsMicTest, 'function');
  assert.equal(typeof actionFlowModule.closeAudioSettings, 'function');
  assert.equal(typeof actionFlowModule.runAudioSettingsMicTestStart, 'function');
  assert.equal(typeof outputActionModule.applyAudioSettingsOutputChange, 'function');
  assert.equal(typeof outputActionModule.applyAudioSettingsProcessingModeChange, 'function');
  assert.equal(typeof micTestStartModule.runAudioSettingsMicTestStart, 'function');
});
