import test from 'node:test';
import assert from 'node:assert/strict';

test('screen share profile split modules import cleanly and expose stable helpers', async () => {
  const constantsModule = await import('../../../client/src/features/voice/screenShareProfileConstants.mjs');
  const captureModule = await import('../../../client/src/features/voice/screenShareCaptureProfile.mjs');
  const codecModule = await import('../../../client/src/features/voice/screenShareCodecPolicy.mjs');
  const profileModule = await import('../../../client/src/features/voice/screenShareProfile.mjs');

  assert.ok(Array.isArray(constantsModule.SCREEN_SHARE_PROFILES));
  assert.equal(typeof captureModule.summarizeScreenShareProfile, 'function');
  assert.equal(typeof captureModule.applyPreferredScreenShareConstraints, 'function');
  assert.equal(typeof codecModule.getRuntimeScreenShareCodecMode, 'function');
  assert.equal(typeof codecModule.getPreferredScreenShareCodecCandidates, 'function');
  assert.equal(typeof profileModule.summarizeScreenShareProfile, 'function');
  assert.equal(typeof profileModule.getRuntimeScreenShareCodecMode, 'function');
});
