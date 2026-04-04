import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('main layout controller support owns room, unread, notification, and guild-chat helper hooks', async () => {
  const supportSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutControllerSupport.mjs', import.meta.url),
    'utf8'
  );

  assert.match(supportSource, /function useMainLayoutControllerSupport\(/);
  assert.match(supportSource, /useRooms\(/);
  assert.match(supportSource, /useNotifications\(/);
  assert.match(supportSource, /useUnreadDMs\(/);
  assert.match(supportSource, /useUnreadRooms\(/);
  assert.match(supportSource, /useGuildChat\(/);
});
