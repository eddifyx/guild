import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCopyNpubAction,
  createLeaveGuildDialog,
  createLogoutDialog,
  createStartEditStatusAction,
  createStatusSaveAction,
  loadNostrProfileSnapshot,
  resolveCurrentNostrPubkey,
} from '../../../client/src/features/social/nostrProfileRuntime.mjs';

test('nostr profile runtime resolves current pubkey from the active signer first', () => {
  const pubkey = resolveCurrentNostrPubkey({
    user: { npub: 'npub-ignored' },
    getUserPubkeyFn: () => 'hex-pubkey',
    decodeNpubFn: () => ({ data: 'decoded-pubkey' }),
  });

  assert.equal(pubkey, 'hex-pubkey');
});

test('nostr profile runtime falls back to decoding npub when signer pubkey is unavailable', () => {
  const pubkey = resolveCurrentNostrPubkey({
    user: { npub: 'npub-1' },
    getUserPubkeyFn: () => '',
    decodeNpubFn: () => ({ data: 'decoded-pubkey' }),
  });

  assert.equal(pubkey, 'decoded-pubkey');
});

test('nostr profile runtime loads the relay profile using the resolved pubkey', async () => {
  const profile = await loadNostrProfileSnapshot({
    user: { npub: 'npub-1' },
    getUserPubkeyFn: () => '',
    decodeNpubFn: () => ({ data: 'decoded-pubkey' }),
    fetchCurrentProfileFn: async (pubkey) => ({ pubkey, name: 'edd' }),
  });

  assert.deepEqual(profile, { pubkey: 'decoded-pubkey', name: 'edd' });
});

test('nostr profile runtime copies npub and clears the copied indicator later', async () => {
  const calls = [];
  let timeoutCallback = null;
  const copy = createCopyNpubAction({
    npub: 'npub-test',
    writeTextFn: async (value) => calls.push(['writeText', value]),
    setCopiedFn: (value) => calls.push(['setCopied', value]),
    setTimeoutFn: (callback, delayMs) => {
      timeoutCallback = callback;
      calls.push(['setTimeout', delayMs]);
    },
  });

  await copy();
  timeoutCallback?.();

  assert.deepEqual(calls, [
    ['writeText', 'npub-test'],
    ['setCopied', true],
    ['setTimeout', 2000],
    ['setCopied', false],
  ]);
});

test('nostr profile runtime saves trimmed status text through the socket', () => {
  const emitted = [];
  const save = createStatusSaveAction({
    socket: { emit: (...args) => emitted.push(args) },
    getStatusDraftFn: () => '  hello guild  ',
    setEditingStatusFn: (value) => emitted.push(['editing', value]),
  });

  const saved = save();

  assert.equal(saved, 'hello guild');
  assert.deepEqual(emitted, [
    ['status:update', { status: 'hello guild' }],
    ['editing', false],
  ]);
});

test('nostr profile runtime seeds status editing from the current status', () => {
  const calls = [];
  const startEdit = createStartEditStatusAction({
    getCurrentStatusFn: () => 'Shipping',
    setStatusDraftFn: (value) => calls.push(['draft', value]),
    setEditingStatusFn: (value) => calls.push(['editing', value]),
  });

  startEdit();

  assert.deepEqual(calls, [
    ['draft', 'Shipping'],
    ['editing', true],
  ]);
});

test('nostr profile runtime builds leave guild confirmation and surfaces flash errors', async () => {
  const calls = [];
  let timeoutCallback = null;
  const dialog = createLeaveGuildDialog({
    currentGuild: 'guild-1',
    currentGuildData: { name: 'Byzantine' },
    leaveGuildFn: async () => {
      throw new Error('leave failed');
    },
    clearGuildFn: () => calls.push(['clearGuild']),
    setFlashMsgFn: (value) => calls.push(['flash', value]),
    setTimeoutFn: (callback, delayMs) => {
      timeoutCallback = callback;
      calls.push(['timeout', delayMs]);
    },
  });

  assert.equal(dialog.title, 'Leave Guild');
  assert.match(dialog.message, /Byzantine/);

  await dialog.onConfirm();
  timeoutCallback?.();

  assert.deepEqual(calls, [
    ['flash', 'leave failed'],
    ['timeout', 4000],
    ['flash', null],
  ]);
});

test('nostr profile runtime builds logout confirmation', () => {
  const calls = [];
  const dialog = createLogoutDialog({
    logoutFn: () => calls.push('logout'),
  });

  assert.equal(dialog.title, 'Log Out');
  dialog.onConfirm();
  assert.deepEqual(calls, ['logout']);
});

