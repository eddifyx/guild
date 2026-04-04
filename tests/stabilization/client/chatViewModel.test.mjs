import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getEffectiveConversation,
  getMessageTimestampValue,
  isConversationDmSupported,
  shouldGroupWithPreviousMessage,
} from '../../../client/src/features/messaging/chatViewModel.mjs';

test('chat view model parses message timestamps across numeric and sql-like inputs', () => {
  assert.equal(getMessageTimestampValue({ created_at: 123 }), 123);
  assert.equal(getMessageTimestampValue({ createdAt: '2026-03-25 12:30:00' }) > 0, true);
  assert.equal(getMessageTimestampValue({ timestamp: 'invalid' }), null);
});

test('chat view model groups only same-sender messages within the time window', () => {
  const previousMessage = {
    sender_id: 'user-1',
    sender_name: 'Builder',
    created_at: '2026-03-25 12:00:00',
  };
  const groupedMessage = {
    sender_id: 'user-1',
    sender_name: 'Builder',
    created_at: '2026-03-25 12:04:00',
  };
  const splitMessage = {
    sender_id: 'user-2',
    sender_name: 'Other',
    created_at: '2026-03-25 12:04:00',
  };

  assert.equal(shouldGroupWithPreviousMessage(previousMessage, groupedMessage), true);
  assert.equal(shouldGroupWithPreviousMessage(previousMessage, splitMessage), false);
});

test('chat view model resolves DM support and effective conversation state', () => {
  const dmConversation = { type: 'dm', id: 'user-2' };
  assert.equal(isConversationDmSupported(dmConversation, null, true), true);
  assert.equal(isConversationDmSupported(dmConversation, { members: [{ id: 'user-2' }] }, false), true);
  assert.equal(isConversationDmSupported(dmConversation, { members: [{ id: 'user-9' }] }, false), false);

  assert.deepEqual(getEffectiveConversation(dmConversation, false), {
    type: 'dm',
    id: 'user-2',
    dmUnsupported: true,
  });
});
