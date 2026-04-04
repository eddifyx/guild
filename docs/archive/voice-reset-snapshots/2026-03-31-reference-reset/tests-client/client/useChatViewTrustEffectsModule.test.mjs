import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('chat view runtime delegates trust bootstrap and verification subscriptions to a dedicated trust-effects hook', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewRuntime.mjs', import.meta.url),
    'utf8'
  );
  const trustEffectsSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewTrustEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /from '\.\/useChatViewTrustEffects\.mjs'/);
  assert.match(runtimeSource, /useChatViewTrustEffects\(/);
  assert.doesNotMatch(runtimeSource, /loadRemoteIdentityVerification\(/);
  assert.doesNotMatch(runtimeSource, /shouldLoadChatViewIdentityVerification\(/);
  assert.doesNotMatch(runtimeSource, /window\.addEventListener\('trusted-npub-updated'/);
  assert.doesNotMatch(runtimeSource, /window\.addEventListener\('identity-verified'/);

  assert.match(trustEffectsSource, /function useChatViewTrustEffects\(/);
  assert.match(trustEffectsSource, /buildChatViewIdentityVerificationInput\(/);
  assert.match(trustEffectsSource, /shouldLoadChatViewIdentityVerification\(/);
  assert.match(trustEffectsSource, /loadRemoteIdentityVerification/);
  assert.match(trustEffectsSource, /window\.addEventListener\('trusted-npub-updated'/);
  assert.match(trustEffectsSource, /window\.addEventListener\('identity-verified'/);
});
