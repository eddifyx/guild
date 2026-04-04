import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGiftWrapUnavailableMessage,
  buildNoteEventTemplate,
  buildProfileEventTemplate,
  bytesToHex,
  describeSignerError,
  isMissingNip04Capability,
  toBase64Url,
} from '../../../client/src/features/nostr/profilePublisherModel.mjs';

test('profile publisher model formats signer errors and missing nip04 detection predictably', () => {
  assert.equal(describeSignerError(new Error('boom')), 'boom');
  assert.equal(describeSignerError({ reason: 'denied' }), 'denied');
  assert.equal(describeSignerError({}, 'fallback'), 'fallback');
  assert.equal(isMissingNip04Capability('no nip04_encrypt_method'), true);
  assert.equal(isMissingNip04Capability('unsupported method'), true);
  assert.equal(isMissingNip04Capability('network timeout'), false);
});

test('profile publisher model builds canonical profile and note event templates', () => {
  const profileEvent = buildProfileEventTemplate({
    name: 'x'.repeat(80),
    about: 'y'.repeat(400),
    picture: 'pic',
    banner: 'banner',
    lud16: 'zap@example.com',
  }, 1_700_000_000_000, 'pubkey-1');

  const noteEvent = buildNoteEventTemplate('z'.repeat(1400), 1_700_000_123_000, 'pubkey-2');

  assert.equal(profileEvent.kind, 0);
  assert.equal(profileEvent.created_at, 1_700_000_000);
  assert.equal(profileEvent.pubkey, 'pubkey-1');
  assert.equal(JSON.parse(profileEvent.content).name.length, 50);
  assert.equal(JSON.parse(profileEvent.content).about.length, 250);

  assert.equal(noteEvent.kind, 1);
  assert.equal(noteEvent.created_at, 1_700_000_123);
  assert.equal(noteEvent.pubkey, 'pubkey-2');
  assert.equal(noteEvent.content.length, 1000);
});

test('profile publisher model builds blossom auth tokens and DM fallback copy consistently', () => {
  const bytes = new Uint8Array([0, 15, 255]).buffer;
  assert.equal(bytesToHex(bytes), '000fff');
  assert.equal(toBase64Url('guild/nostr+ok?'), 'Z3VpbGQvbm9zdHIrb2s_');
  assert.match(
    buildGiftWrapUnavailableMessage({ loginMode: 'nip46', giftWrapError: 'denied' }),
    /Reconnect your signer/,
  );
  assert.match(
    buildGiftWrapUnavailableMessage({ loginMode: 'nsec', giftWrapError: 'denied' }),
    /invite code tab/,
  );
});
