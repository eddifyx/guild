import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGuildChatTypingLabel,
  buildRenderableMentionRanges,
} from '../../../client/src/features/messaging/guildChatMessageViewModel.mjs';

test('guild chat message view model normalizes valid non-overlapping mention ranges', () => {
  const ranges = buildRenderableMentionRanges({
    id: 'm-1',
    content: 'Hello @alpha and @beta',
    mentions: [
      { userId: 'alpha', start: 6, end: 12, display: '@alpha' },
      { userId: 'broken', start: 0, end: 99, display: '@broken' },
      { userId: 'beta-overlap', start: 10, end: 15, display: '@beta' },
      { userId: 'beta', start: 17, end: 22, display: '@beta' },
    ],
  });

  assert.deepEqual(
    ranges.map((range) => ({ userId: range.userId, start: range.start, end: range.end, display: range.display })),
    [
      { userId: 'alpha', start: 6, end: 12, display: '@alpha' },
      { userId: 'beta', start: 17, end: 22, display: '@beta' },
    ],
  );
});

test('guild chat message view model derives compact typing labels', () => {
  assert.equal(buildGuildChatTypingLabel([]), '');
  assert.equal(buildGuildChatTypingLabel([{ username: 'alpha' }]), 'alpha is typing');
  assert.equal(
    buildGuildChatTypingLabel([{ username: 'alpha' }, { username: 'beta' }, { username: 'gamma' }]),
    'alpha, beta +1 are typing',
  );
});
