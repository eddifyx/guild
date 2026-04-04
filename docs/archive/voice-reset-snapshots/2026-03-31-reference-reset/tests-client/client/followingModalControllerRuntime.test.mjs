import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bindFollowingModalSocketRuntime,
  createFollowingModalLoadFriendsAction,
  createFollowingModalLoadRequestsAction,
  createFollowingModalLoadSentRequestsAction,
  startFollowingModalSearchRuntime,
} from '../../../client/src/features/social/followingModalControllerRuntime.mjs';

test('following modal controller runtime loads friends, profiles, and loading state canonically', async () => {
  const state = [];
  const loadFriends = createFollowingModalLoadFriendsAction({
    getContactsFn: async () => [{ contact_npub: 'npub1abc' }],
    decodeNpubFn: (value) => ({ data: `decoded:${value}` }),
    fetchProfileFn: async (value) => ({ name: value }),
    setContactsFn: (value) => state.push(['contacts', value]),
    setLoadingFriendsFn: (value) => state.push(['loading', value]),
    setProfilesFn: (updater) => state.push(['profiles', updater({})]),
  });

  await loadFriends();

  assert.deepEqual(state, [
    ['contacts', [{ contact_npub: 'npub1abc' }]],
    ['loading', false],
    ['profiles', { npub1abc: { name: 'decoded:npub1abc' } }],
  ]);
});

test('following modal controller runtime loads requests and sent requests through canonical state setters', async () => {
  const state = [];
  const loadRequests = createFollowingModalLoadRequestsAction({
    getIncomingRequestsFn: async () => [{ id: 'req-1' }],
    setIncomingFn: (value) => state.push(['incoming', value]),
    setLoadingRequestsFn: (value) => state.push(['loadingRequests', value]),
  });
  await loadRequests();

  const loadSentRequests = createFollowingModalLoadSentRequestsAction({
    getSentRequestsFn: async () => [{ to_npub: 'npub1sent' }],
    setSentNpubsFn: (value) => state.push(['sent', Array.from(value)]),
  });
  await loadSentRequests();

  assert.deepEqual(state, [
    ['incoming', [{ id: 'req-1' }]],
    ['loadingRequests', false],
    ['sent', ['npub1sent']],
  ]);
});

test('following modal controller runtime binds socket events and reloads contacts on accept', async () => {
  const state = [];
  const handlers = new Map();
  const socket = {
    on(event, handler) {
      handlers.set(event, handler);
    },
    off(event, handler) {
      state.push(['off', event, handlers.get(event) === handler]);
      handlers.delete(event);
    },
  };

  const cleanup = bindFollowingModalSocketRuntime({
    socket,
    setIncomingFn: (updater) => state.push(['incoming', updater([{ id: 'old' }])]),
    reloadContactsFn: async () => state.push(['reload', true]),
  });

  handlers.get('friend:request-received')({ id: 'new' });
  await handlers.get('friend:request-accepted')();
  cleanup();

  assert.deepEqual(state, [
    ['incoming', [{ id: 'new' }, { id: 'old' }]],
    ['reload', true],
    ['off', 'friend:request-received', true],
    ['off', 'friend:request-accepted', true],
  ]);
});

test('following modal controller runtime schedules and resolves npub and idle searches canonically', async () => {
  const state = [];
  const timerRef = { current: null };
  const scheduled = [];

  const idleCleanup = startFollowingModalSearchRuntime({
    query: 'a',
    timerRef,
    setSearchResultsFn: (value) => state.push(['results', value]),
    setSearchingFn: (value) => state.push(['searching', value]),
    setGuildNpubsFn: (value) => state.push(['guild', Array.from(value)]),
    decodeNpubFn: () => ({ data: '' }),
    fetchProfileFn: async () => null,
    checkNpubsFn: async () => ({ registered: [] }),
    searchProfilesFn: async () => [],
    setTimeoutFn: (fn, delay) => {
      scheduled.push([fn, delay]);
      return fn;
    },
    clearTimeoutFn: () => state.push(['clear', true]),
  });
  idleCleanup();

  state.length = 0;

  const searchCleanup = startFollowingModalSearchRuntime({
    query: 'npub1abc',
    timerRef,
    setSearchResultsFn: (value) => state.push(['results', value]),
    setSearchingFn: (value) => state.push(['searching', value]),
    setGuildNpubsFn: (value) => state.push(['guild', Array.from(value)]),
    decodeNpubFn: (value) => ({ data: `decoded:${value}` }),
    fetchProfileFn: async (value) => ({ name: value, picture: 'pic' }),
    checkNpubsFn: async () => ({ registered: ['npub1abc'] }),
    searchProfilesFn: async () => [],
    setTimeoutFn: (fn, delay) => {
      scheduled.push([fn, delay]);
      return fn;
    },
    clearTimeoutFn: () => state.push(['clear', true]),
  });

  assert.equal(scheduled.at(-1)[1], 200);
  await scheduled.at(-1)[0]();
  searchCleanup();

  assert.deepEqual(state, [
    ['searching', true],
    ['clear', true],
    ['results', [{
      npub: 'npub1abc',
      name: 'decoded:npub1abc',
      picture: 'pic',
      about: '',
    }]],
    ['guild', ['npub1abc']],
    ['searching', false],
    ['clear', true],
  ]);
});
