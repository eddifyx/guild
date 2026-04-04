import test from 'node:test';
import assert from 'node:assert/strict';

import { toBase64 } from '../../../client/src/crypto/primitives.js';
import {
  encodeRatchetAAD,
  skipRatchetMessageKeys,
  validateRatchetHeader,
} from '../../../client/src/features/crypto/doubleRatchetSupport.mjs';

test('double ratchet support validates safe header counters', () => {
  assert.doesNotThrow(() => validateRatchetHeader({ n: 0, pn: 1 }));
  assert.throws(
    () => validateRatchetHeader({ n: -1, pn: 1 }),
    /Invalid message header/,
  );
  assert.throws(
    () => validateRatchetHeader({ n: Number.MAX_SAFE_INTEGER, pn: 1 }),
    /Invalid message header/,
  );
  assert.throws(
    () => validateRatchetHeader({ n: 1.5, pn: 0 }),
    /Invalid message header/,
  );
});

test('double ratchet support encodes aad deterministically from header and participants', () => {
  const encoded = encodeRatchetAAD({ dh: 'dh-key', pn: 3, n: 7 }, 'alice', 'bob');
  const text = new TextDecoder().decode(encoded);

  assert.equal(text, JSON.stringify({
    dh: 'dh-key',
    pn: 3,
    n: 7,
    sid: 'alice',
    rid: 'bob',
  }));
});

test('double ratchet support skips message keys, advances the receiving chain, and caps storage', () => {
  const state = {
    DHr: 'peer-dh',
    CKr: toBase64(new Uint8Array(32).fill(9)),
    Nr: 0,
    MKSKIPPED: Object.fromEntries(
      Array.from({ length: 5000 }, (_, index) => [`old:${index}`, `mk-${index}`]),
    ),
  };

  skipRatchetMessageKeys(state, 2);

  assert.equal(state.Nr, 2);
  assert.equal(Object.keys(state.MKSKIPPED).length, 5000);
  assert.equal(state.MKSKIPPED['peer-dh:0'] !== undefined, true);
  assert.equal(state.MKSKIPPED['peer-dh:1'] !== undefined, true);
  assert.equal(state.MKSKIPPED['old:0'], undefined);
});

test('double ratchet support rejects skips larger than the configured limit', () => {
  const state = {
    DHr: 'peer-dh',
    CKr: toBase64(new Uint8Array(32).fill(7)),
    Nr: 0,
    MKSKIPPED: {},
  };

  assert.throws(
    () => skipRatchetMessageKeys(state, 1001),
    /Cannot skip more than 1000 messages/,
  );
});
