import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import {
  buildGuildMentionDirectory as buildClientGuildMentionDirectory,
  extractGuildMentions,
} from '../../../client/src/features/messaging/guildChatMentionCore.mjs';

const require = createRequire(import.meta.url);
const {
  buildGuildMentionDirectory: buildServerGuildMentionDirectory,
  extractGuildChatMentionsFromContent,
} = require('../../../server/src/domain/messaging/guildChat');

const members = [
  { id: 'user-a', username: 'Alpha Wolf', npub: 'npub1alpha9999' },
  { id: 'user-b', username: 'Alpha Wolf', npub: 'npub1bravo1111' },
  { id: 'user-c', username: 'Builder' },
];

test('client and server guild mention directories agree on duplicate mention tokens', () => {
  const clientTokens = buildClientGuildMentionDirectory(members).entries
    .map((entry) => entry.mentionToken)
    .sort();
  const serverTokens = Array.from(buildServerGuildMentionDirectory(members).values())
    .map((entry) => entry.mentionToken)
    .sort();

  assert.deepEqual(clientTokens, serverTokens);
});

test('client and server mention extraction stay in parity for duplicate names and dedupe behavior', () => {
  const content = 'hello @Builder and @Alpha·Wolf·9999 and again @Builder';

  const clientMentions = extractGuildMentions(content, members);
  const serverMentions = extractGuildChatMentionsFromContent(content, members);

  assert.deepEqual(clientMentions, serverMentions);
});
