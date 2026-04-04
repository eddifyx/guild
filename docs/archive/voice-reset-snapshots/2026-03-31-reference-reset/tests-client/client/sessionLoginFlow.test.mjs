import test from 'node:test';
import assert from 'node:assert/strict';

import {
  finalizeAuthenticatedLogin,
  stageAuthenticatedSession,
} from '../../../client/src/features/auth/sessionLoginFlow.mjs';

test('stageAuthenticatedSession persists auth before resetting expiry', () => {
  const calls = [];
  const authData = { userId: 'user-1', token: 'token-1' };

  const result = stageAuthenticatedSession(authData, {
    persistAuth: (value) => calls.push(['persist', value]),
    resetSessionExpiry: () => calls.push(['reset']),
  });

  assert.equal(result, authData);
  assert.deepEqual(calls, [
    ['persist', authData],
    ['reset'],
  ]);
});

test('finalizeAuthenticatedLogin stages, secures, and sets the session user in order', async () => {
  const calls = [];
  const authData = { userId: 'user-1', token: 'token-1' };

  const result = await finalizeAuthenticatedLogin(authData, {
    stageSession: (value) => {
      calls.push(['stage', value]);
      return { ...value, staged: true };
    },
    ensureSecureLogin: async (value) => {
      calls.push(['secure', value]);
    },
    setUser: (value) => {
      calls.push(['setUser', value]);
    },
  });

  assert.deepEqual(result, {
    userId: 'user-1',
    token: 'token-1',
    staged: true,
  });
  assert.deepEqual(calls, [
    ['stage', authData],
    ['secure', {
      userId: 'user-1',
      token: 'token-1',
      staged: true,
    }],
    ['setUser', {
      userId: 'user-1',
      token: 'token-1',
      staged: true,
    }],
  ]);
});
