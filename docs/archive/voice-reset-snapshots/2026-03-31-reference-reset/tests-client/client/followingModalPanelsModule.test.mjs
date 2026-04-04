import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('following modal panels delegate views to dedicated social modal modules', async () => {
  const panelsSource = await readFile(
    new URL('../../../client/src/components/Social/FollowingModalPanels.jsx', import.meta.url),
    'utf8'
  );
  const headerSource = await readFile(
    new URL('../../../client/src/components/Social/FollowingModalHeader.jsx', import.meta.url),
    'utf8'
  );
  const tabsSource = await readFile(
    new URL('../../../client/src/components/Social/FollowingModalTabs.jsx', import.meta.url),
    'utf8'
  );
  const searchSource = await readFile(
    new URL('../../../client/src/components/Social/FollowingModalSearchPanel.jsx', import.meta.url),
    'utf8'
  );
  const requestsSource = await readFile(
    new URL('../../../client/src/components/Social/FollowingModalRequestsPanel.jsx', import.meta.url),
    'utf8'
  );
  const friendsSource = await readFile(
    new URL('../../../client/src/components/Social/FollowingModalFriendsPanel.jsx', import.meta.url),
    'utf8'
  );

  assert.match(panelsSource, /from '\.\/FollowingModalHeader\.jsx'/);
  assert.match(panelsSource, /from '\.\/FollowingModalTabs\.jsx'/);
  assert.match(panelsSource, /from '\.\/FollowingModalSearchPanel\.jsx'/);
  assert.match(panelsSource, /from '\.\/FollowingModalRequestsPanel\.jsx'/);
  assert.match(panelsSource, /from '\.\/FollowingModalFriendsPanel\.jsx'/);
  assert.match(headerSource, /export function FollowingModalHeader/);
  assert.match(tabsSource, /export function FollowingModalTabs/);
  assert.match(searchSource, /export function FollowingModalSearchPanel/);
  assert.match(requestsSource, /export function FollowingModalRequestsPanel/);
  assert.match(friendsSource, /export function FollowingModalFriendsPanel/);
});
