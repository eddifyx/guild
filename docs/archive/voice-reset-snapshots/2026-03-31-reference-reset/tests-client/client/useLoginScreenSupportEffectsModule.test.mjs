import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('login screen support effects own auth-challenge subscription and image-preview synchronization', async () => {
  const supportEffectsSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenSupportEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(supportEffectsSource, /function useLoginScreenSupportEffects\(/);
  assert.match(supportEffectsSource, /getAuthChallengeEventName\(/);
  assert.match(supportEffectsSource, /createLoginScreenAuthChallengeHandler\(/);
  assert.match(supportEffectsSource, /syncLoginScreenImagePreview\(/);
  assert.match(supportEffectsSource, /window\.addEventListener/);
});
