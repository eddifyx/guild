import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createFollowingModalCopyInviteAction,
  createFollowingModalCopyNpubAction,
  createFollowingModalRemoveFriendAction,
  createFollowingModalRequestDecisionAction,
  createFollowingModalSendNostrDmAction,
  createFollowingModalSendRequestAction,
  openFollowingModalPrimalProfile,
} from '../../../client/src/features/social/followingModalActionRuntime.mjs';

test('following modal action runtime sends friend requests and records success and failure messages', async () => {
  const state = [];
  const sendRequest = createFollowingModalSendRequestAction({
    sendFriendRequestFn: async (npub) => {
      if (npub === 'bad') throw new Error('nope');
    },
    setSendingNpubFn: (value) => state.push(['sending', value]),
    setSearchMsgFn: (value) => state.push(['msg', value]),
    setSentNpubsFn: (updater) => {
      const next = updater(new Set(['npub-old']));
      state.push(['sent', Array.from(next)]);
    },
    clearSearchMessageFn: (delay) => state.push(['clear', delay]),
  });

  await sendRequest('npub-good');
  await sendRequest('bad');

  assert.deepEqual(state, [
    ['sending', 'npub-good'],
    ['msg', ''],
    ['sent', ['npub-old', 'npub-good']],
    ['msg', 'Friend request sent!'],
    ['clear', 3000],
    ['sending', null],
    ['sending', 'bad'],
    ['msg', ''],
    ['msg', 'nope'],
    ['clear', 4000],
    ['sending', null],
  ]);
});

test('following modal action runtime handles request decisions and friend removal through shared helpers', async () => {
  const state = [];
  const accept = createFollowingModalRequestDecisionAction({
    requestActionFn: async () => {},
    setActioningIdFn: (value) => state.push(['actioning', value]),
    setIncomingFn: (updater) => {
      state.push(['incoming', updater([{ id: 'keep' }, { id: 'drop' }])]);
    },
    onAcceptedFn: async () => state.push(['accepted', true]),
  });
  await accept('drop');

  const remove = createFollowingModalRemoveFriendAction({
    removeContactFn: async () => [{ contact_npub: 'npub-b' }],
    setContactsFn: (value) => state.push(['contacts', value]),
    selectedNpub: 'npub-a',
    setSelectedNpubFn: (value) => state.push(['selected', value]),
  });
  await remove('npub-a');

  assert.deepEqual(state, [
    ['actioning', 'drop'],
    ['incoming', [{ id: 'keep' }]],
    ['accepted', true],
    ['actioning', null],
    ['contacts', [{ contact_npub: 'npub-b' }]],
    ['selected', null],
  ]);
});

test('following modal action runtime handles clipboard, invite dm, and primal profile actions', async () => {
  const state = [];

  const copyNpub = createFollowingModalCopyNpubAction({
    writeTextFn: async (value) => state.push(['copy', value]),
    setCopiedFn: (value) => state.push(['copied', value]),
    setTimeoutFn: (fn, delay) => {
      state.push(['timeout', delay]);
      fn();
    },
  });
  copyNpub('npub-1');
  await Promise.resolve();

  const copyInvite = createFollowingModalCopyInviteAction({
    inviteText: 'invite-text',
    writeTextFn: async (value) => state.push(['invite-copy', value]),
    setSearchMsgFn: (value) => state.push(['msg', value]),
    clearSearchMessageFn: (delay) => state.push(['clear', delay]),
    setInviteMenuNpubFn: (value) => state.push(['menu', value]),
  });
  copyInvite();
  await Promise.resolve();

  const sendDm = createFollowingModalSendNostrDmAction({
    setSendingDMFn: (value) => state.push(['sendingDm', value]),
    setInviteMenuNpubFn: (value) => state.push(['menu', value]),
    decodeNpubFn: (value) => ({ data: `decoded:${value}` }),
    publishDMFn: async (pubkey, message) => {
      state.push(['publish', pubkey, message]);
      return { ok: true };
    },
    inviteText: 'invite-text',
    setSearchMsgFn: (value) => state.push(['msg', value]),
    clearSearchMessageFn: (delay) => state.push(['clear', delay]),
  });
  await sendDm('npub-2');

  openFollowingModalPrimalProfile({
    npub: 'npub-3',
    openExternalFn: (url) => state.push(['open', url]),
  });

  assert.deepEqual(state, [
    ['copy', 'npub-1'],
    ['copied', true],
    ['timeout', 2000],
    ['copied', false],
    ['invite-copy', 'invite-text'],
    ['menu', null],
    ['msg', 'Invite link copied!'],
    ['clear', 3000],
    ['sendingDm', true],
    ['menu', null],
    ['publish', 'decoded:npub-2', 'invite-text'],
    ['msg', 'Invite DM sent via Nostr!'],
    ['sendingDm', false],
    ['clear', 4000],
    ['open', 'https://primal.net/p/npub-3'],
  ]);
});
