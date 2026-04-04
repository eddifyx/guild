import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('login screen controller effects own QR session, auth challenge, and image preview synchronization', async () => {
  const effectsSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenControllerEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(effectsSource, /function useLoginScreenControllerEffects\(/);
  assert.match(effectsSource, /from '\.\/useLoginScreenQrEffects\.mjs'/);
  assert.match(effectsSource, /from '\.\/useLoginScreenSupportEffects\.mjs'/);
  assert.match(effectsSource, /useLoginScreenQrEffects\(/);
  assert.match(effectsSource, /useLoginScreenSupportEffects\(/);
  assert.doesNotMatch(effectsSource, /startLoginScreenQrSession\(/);
  assert.doesNotMatch(effectsSource, /createLoginScreenAuthChallengeHandler\(/);
  assert.doesNotMatch(effectsSource, /syncLoginScreenImagePreview\(/);
  assert.doesNotMatch(effectsSource, /getAuthChallengeEventName\(/);
});
