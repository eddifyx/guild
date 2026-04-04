import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildVoiceTrustError,
  getUntrustedVoiceParticipants,
} from '../../../client/src/features/voice/voiceTrustState.mjs';

test('voice trust state filters trusted participants and excludes the current user', () => {
  const untrusted = getUntrustedVoiceParticipants([
    { userId: 'user-1', username: 'Builder', npub: 'npub-builder' },
    { userId: 'user-2', username: 'Scout', npub: 'npub-scout' },
    { userId: 'user-3', username: 'Mystery', npub: null },
  ], {
    currentUserId: 'user-1',
    hasKnownNpubFn(userId) {
      return userId === 'user-2';
    },
  });

  assert.deepEqual(untrusted, [
    { userId: 'user-3', username: 'Mystery', npub: null },
  ]);
});

test('voice trust state builds readable trust warnings for one, two, or many users', () => {
  const participants = [
    { userId: 'user-1', username: 'Builder' },
    { userId: 'user-2', username: 'Scout' },
    { userId: 'user-3', username: 'Rogue' },
    { userId: 'user-4', username: 'Sage' },
  ];

  const hasKnownNpubFn = (userId) => userId === 'user-1';

  assert.equal(
    buildVoiceTrustError(participants.slice(0, 2), {
      currentUserId: 'user-1',
      hasKnownNpubFn,
    }),
    "Secure voice is waiting for Scout's Nostr identity."
  );
  assert.equal(
    buildVoiceTrustError(participants.slice(0, 3), {
      currentUserId: 'user-1',
      hasKnownNpubFn,
    }),
    'Secure voice is waiting for Scout and Rogue.'
  );
  assert.equal(
    buildVoiceTrustError(participants, {
      currentUserId: 'user-1',
      hasKnownNpubFn,
    }),
    'Secure voice is waiting for Scout, Rogue, Sage.'
  );
});
