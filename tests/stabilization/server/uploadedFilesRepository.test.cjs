const test = require('node:test');
const assert = require('node:assert/strict');

const { createUploadedFilesRepository } = require('../../../server/src/repositories/uploadedFilesRepository');

test('uploaded files repository claims guild chat uploads only while they remain unclaimed', () => {
  const calls = [];
  const repository = createUploadedFilesRepository({
    db: {
      prepare(sql) {
        return {
          run(...args) {
            calls.push({ sql, args });
            return { changes: 1 };
          },
        };
      },
    },
  });

  const result = repository.claimUploadedFileForGuildChatMessage.run(
    'guildchat-message-1',
    'guild-1',
    'upload-1',
    'user-1'
  );

  assert.equal(result.changes, 1);
  assert.match(calls[0].sql, /guildchat_message_id = \?/);
  assert.deepEqual(calls[0].args, ['guildchat-message-1', 'guild-1', 'upload-1', 'user-1']);
});

test('uploaded files repository lists raw stale uploads for cleanup jobs', () => {
  const repository = createUploadedFilesRepository({
    db: {
      prepare(sql) {
        return {
          all(...args) {
            assert.equal(args.length, 0);
            return sql.includes("claimed_at <= datetime('now', '-7 days')")
              ? [{ id: 'guildchat-upload' }]
              : [{ id: 'unclaimed-upload' }];
          },
          run() {
            return { changes: 1 };
          },
        };
      },
    },
  });

  assert.deepEqual(repository.getExpiredUnclaimedUploadedFiles.all(), [{ id: 'unclaimed-upload' }]);
  assert.deepEqual(repository.getExpiredGuildChatUploadedFiles.all(), [{ id: 'guildchat-upload' }]);
});
