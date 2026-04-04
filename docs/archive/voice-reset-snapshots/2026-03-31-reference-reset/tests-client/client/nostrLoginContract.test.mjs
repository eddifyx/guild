import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import {
  AUTH_EVENT_RELAY_HINT,
  buildLoginAuthEvent,
  LOGIN_COMPAT_CLIENT,
  LOGIN_COMPAT_CONTENT,
  LOGIN_COMPAT_KIND,
} from '../../../client/src/features/auth/nostrLoginContract.mjs';

const require = createRequire(import.meta.url);
const {
  isAcceptedLoginProofEvent,
} = require('../../../server/src/domain/auth/nostrSession');

test('client nip-42 login auth events are accepted by the server auth domain', () => {
  const event = buildLoginAuthEvent('challenge-123', {
    pubkey: 'f'.repeat(64),
  });

  assert.equal(event.kind, 22242);
  assert.deepEqual(event.tags, [
    ['relay', AUTH_EVENT_RELAY_HINT],
    ['challenge', 'challenge-123'],
  ]);
  assert.equal(isAcceptedLoginProofEvent(event), true);
});

test('client compatibility login auth events are accepted by the server auth domain', () => {
  const event = buildLoginAuthEvent('challenge-123', {
    compatibilityMode: true,
    pubkey: 'e'.repeat(64),
  });

  assert.equal(event.kind, LOGIN_COMPAT_KIND);
  assert.equal(event.content, LOGIN_COMPAT_CONTENT);
  assert.deepEqual(event.tags, [
    ['challenge', 'challenge-123'],
    ['client', LOGIN_COMPAT_CLIENT],
    ['relay', AUTH_EVENT_RELAY_HINT],
  ]);
  assert.equal(isAcceptedLoginProofEvent(event), true);
});
