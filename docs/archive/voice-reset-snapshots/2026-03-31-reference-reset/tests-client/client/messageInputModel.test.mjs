import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getMessageInputActiveState,
  getMessageInputPlaceholder,
  getMessageInputTypingPayload,
  hasFileDrag,
} from '../../../client/src/features/messaging/messageInputModel.mjs';

test('message input model derives active state and placeholder from draft state', () => {
  assert.equal(getMessageInputActiveState({ text: '  hi  ' }), true);
  assert.equal(getMessageInputActiveState({ pendingFiles: [{ id: 'file-1' }] }), true);
  assert.equal(getMessageInputActiveState({ text: '  ', uploading: true }), false);
  assert.equal(getMessageInputPlaceholder({ uploading: true }), 'Uploading encrypted image...');
  assert.equal(getMessageInputPlaceholder({ uploading: false }), 'Type a message...');
});

test('message input model derives typing payloads for rooms and direct messages', () => {
  assert.deepEqual(getMessageInputTypingPayload({ id: 'room-1', type: 'room' }), {
    roomId: 'room-1',
    toUserId: null,
  });
  assert.deepEqual(getMessageInputTypingPayload({ id: 'user-1', type: 'dm' }), {
    roomId: null,
    toUserId: 'user-1',
  });
  assert.equal(getMessageInputTypingPayload(null), null);
});

test('message input model detects file drags only when Files is present', () => {
  assert.equal(hasFileDrag({ types: ['text/plain', 'Files'] }), true);
  assert.equal(hasFileDrag({ types: ['text/plain'] }), false);
  assert.equal(hasFileDrag(null), false);
});
