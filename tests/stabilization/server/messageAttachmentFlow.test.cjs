const test = require('node:test');
const assert = require('node:assert/strict');

const { createMessageAttachmentFlow } = require('../../../server/src/domain/messaging/messageAttachmentFlow');

function createHarness(overrides = {}) {
  const attachmentWrites = [];
  const roomClaims = [];
  const dmClaims = [];
  const guildClaims = [];
  const uploads = new Map([
    ['upload-1', {
      id: 'upload-1',
      file_name: 'screenshot.png',
      file_type: 'image/png',
      file_size: 1024,
      stored_name: 'stored-screenshot.png',
    }],
    ['upload-2', {
      id: 'upload-2',
      file_name: 'archive.zip',
      file_type: 'application/zip',
      file_size: 30 * 1024 * 1024,
      stored_name: 'stored-archive.zip',
    }],
  ]);

  const flow = createMessageAttachmentFlow({
    userId: 'user-1',
    maxAttachments: 10,
    maxAttachmentFileSize: 100 * 1024 * 1024,
    maxGuildChatFileSize: 25 * 1024 * 1024,
    uploadIdPattern: /^upload-[0-9]+$/i,
    uuidGenerator: (() => {
      let index = 0;
      return () => `attachment-${++index}`;
    })(),
    getOwnedUnclaimedUploadedFile: {
      get: (fileId, ownerId) => ownerId === 'user-1' ? uploads.get(fileId) || null : null,
    },
    claimUploadedFileForRoomMessage: {
      run: (...args) => {
        roomClaims.push(args);
        return { changes: 1 };
      },
    },
    claimUploadedFileForDMMessage: {
      run: (...args) => {
        dmClaims.push(args);
        return { changes: 1 };
      },
    },
    claimUploadedFileForGuildChatMessage: {
      run: (...args) => {
        guildClaims.push(args);
        return { changes: 1 };
      },
    },
    insertAttachment: {
      run: (...args) => attachmentWrites.push(args),
    },
    ...overrides,
  });

  return {
    flow,
    attachmentWrites,
    roomClaims,
    dmClaims,
    guildClaims,
  };
}

test('message attachment flow sanitizes generic attachment refs and drops invalid entries', () => {
  const { flow } = createHarness();

  assert.deepEqual(flow.sanitizeAttachmentRefs([
    { fileId: ' upload-1 ' },
    { fileId: 'invalid' },
    {},
  ]), [{ fileId: 'upload-1' }]);
  assert.equal(flow.sanitizeAttachmentRefs('nope'), null);
});

test('message attachment flow sanitizes guild chat attachment refs with preserved metadata', () => {
  const { flow } = createHarness();

  assert.deepEqual(flow.sanitizeGuildChatAttachmentRefs([{
    fileId: 'upload-1',
    encryptionKey: '  key ',
    encryptionDigest: ' digest ',
    originalFileName: ' screenshot.png ',
    originalFileType: ' image/png ',
    originalFileSize: '42',
  }]), [{
    fileId: 'upload-1',
    encryptionKey: 'key',
    encryptionDigest: 'digest',
    originalFileName: 'screenshot.png',
    originalFileType: 'image/png',
    originalFileSize: 42,
  }]);
  assert.equal(flow.sanitizeGuildChatAttachmentRefs([{ fileId: 'bad-id' }]), null);
});

test('message attachment flow claims room and dm attachments through the correct persistence path', () => {
  const { flow, attachmentWrites, roomClaims, dmClaims } = createHarness();

  const roomAttachments = flow.claimUploadedAttachments('message-1', [{ fileId: 'upload-1' }], {
    type: 'room',
    roomId: 'room-1',
  });
  const dmAttachments = flow.claimUploadedAttachments('message-2', [{ fileId: 'upload-1' }], {
    type: 'dm',
    dmUserA: 'user-1',
    dmUserB: 'user-2',
  });

  assert.equal(roomAttachments.length, 1);
  assert.equal(dmAttachments.length, 1);
  assert.deepEqual(roomClaims, [['message-1', 'room-1', 'upload-1', 'user-1']]);
  assert.deepEqual(dmClaims, [['message-2', 'user-1', 'user-2', 'upload-1', 'user-1']]);
  assert.equal(attachmentWrites.length, 2);
});

test('message attachment flow enforces guild chat upload size and keeps original metadata', () => {
  const { flow, guildClaims } = createHarness();

  assert.throws(() => {
    flow.claimGuildChatAttachments('message-1', 'guild-1', [{ fileId: 'upload-2' }]);
  }, /25 MB/);

  const attachments = flow.claimGuildChatAttachments('message-2', 'guild-1', [{
    fileId: 'upload-1',
    originalFileName: 'proof.png',
    originalFileType: 'image/png',
    originalFileSize: 2048,
    encryptionKey: 'key',
    encryptionDigest: 'digest',
  }]);

  assert.deepEqual(guildClaims, [['message-2', 'guild-1', 'upload-1', 'user-1']]);
  assert.deepEqual(attachments, [{
    id: 'upload-1',
    uploaded_file_id: 'upload-1',
    fileUrl: '/api/files/upload-1',
    serverFileUrl: '/api/files/upload-1',
    fileName: 'screenshot.png',
    fileType: 'image/png',
    fileSize: 1024,
    originalFileName: 'proof.png',
    originalFileType: 'image/png',
    originalFileSize: 2048,
    encryptionKey: 'key',
    encryptionDigest: 'digest',
    _storedName: 'stored-screenshot.png',
  }]);
});
