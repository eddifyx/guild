const { createGuildsRepository } = require('./repositories/guildsRepository');
const { createLibraryRepository } = require('./repositories/libraryRepository');
const { createMessagesReadRepository } = require('./repositories/messagesReadRepository');
const { createMessagesWriteRepository } = require('./repositories/messagesWriteRepository');
const { createRoomsRepository } = require('./repositories/roomsRepository');
const { createSignalKeysRepository } = require('./repositories/signalKeysRepository');
const { createSessionsRepository } = require('./repositories/sessionsRepository');
const { createSocialRepository } = require('./repositories/socialRepository');
const { createUploadedFilesRepository } = require('./repositories/uploadedFilesRepository');
const { createUsersRepository } = require('./repositories/usersRepository');
const { createUsersVisibilityRepository } = require('./repositories/usersVisibilityRepository');
const { createVoiceRepository } = require('./repositories/voiceRepository');

function createDbBindings({ db }) {
  const userBindings = createUsersRepository({ db });

  const roomBindings = createRoomsRepository({ db });

  const messageWriteBindings = createMessagesWriteRepository({ db });

  const uploadedFileBindings = createUploadedFilesRepository({ db });

  const messageReadBindings = createMessagesReadRepository({
    db,
    getRoomMembership: roomBindings.getRoomMembership,
  });

  const voiceBindings = createVoiceRepository({ db });

  const libraryBindings = createLibraryRepository({ db });

  const signalKeyBindings = createSignalKeysRepository({ db });

  const sessionBindings = createSessionsRepository({ db });

  const guildBindings = createGuildsRepository({ db });

  const socialBindings = createSocialRepository({ db });

  const usersVisibilityBindings = createUsersVisibilityRepository({ db });

  const insertEncryptedMessage = db.prepare(
    "INSERT INTO messages (id, content, sender_id, room_id, dm_partner_id, encrypted, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
  );

  return {
    ...userBindings,
    ...roomBindings,
    ...messageWriteBindings,
    ...uploadedFileBindings,
    ...messageReadBindings,
    ...voiceBindings,
    ...libraryBindings,
    ...signalKeyBindings,
    insertEncryptedMessage,
    ...sessionBindings,
    ...guildBindings,
    ...socialBindings,
    ...usersVisibilityBindings,
  };
}

module.exports = {
  createDbBindings,
};
