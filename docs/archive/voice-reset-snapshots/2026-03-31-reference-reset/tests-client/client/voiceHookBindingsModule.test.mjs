import test from 'node:test';
import assert from 'node:assert/strict';

test('voice hook binding theme modules import cleanly and expose binding factories', async () => {
  const screenShareModule = await import('../../../client/src/features/voice/voiceHookScreenShareBindings.mjs');
  const mediaModule = await import('../../../client/src/features/voice/voiceHookMediaBindings.mjs');
  const sessionModule = await import('../../../client/src/features/voice/voiceHookSessionBindings.mjs');
  const transportModule = await import('../../../client/src/features/voice/voiceHookTransportBindings.mjs');
  const sessionActionModule = await import('../../../client/src/features/voice/voiceHookSessionActionBindings.mjs');
  const uiRuntimeModule = await import('../../../client/src/features/voice/voiceHookUiRuntimeBindings.mjs');

  assert.equal(typeof screenShareModule.buildVoiceScreenShareActionRuntime, 'function');
  assert.equal(typeof mediaModule.buildVoiceCaptureActionRuntime, 'function');
  assert.equal(typeof sessionModule.buildVoiceRuntimeBindingsRuntime, 'function');
  assert.equal(typeof transportModule.buildVoiceTransportActionRuntime, 'function');
  assert.equal(typeof sessionActionModule.buildVoiceSessionJoinRuntime, 'function');
  assert.equal(typeof uiRuntimeModule.buildVoiceUiActionRuntime, 'function');
});
