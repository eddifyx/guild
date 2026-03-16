#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const { db } = require('../src/db');

const DEFAULT_GUILD_ID = 'guild-byzantine-default';
const uploadDir = path.join(__dirname, '..', 'uploads');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const keepDefault = args.has('--keep-default');

function log(line) {
  process.stdout.write(String(line) + '\n');
}

function listTargetGuilds() {
  const guilds = db.prepare('SELECT id, name FROM guilds ORDER BY created_at, id').all();
  return keepDefault ? guilds.filter((guild) => guild.id !== DEFAULT_GUILD_ID) : guilds;
}

function collectGuildSnapshot(guildId) {
  const rooms = db.prepare('SELECT id, name FROM rooms WHERE guild_id = ? ORDER BY created_at, id').all(guildId);
  const voiceChannels = db.prepare('SELECT id, name FROM voice_channels WHERE guild_id = ? ORDER BY created_at, id').all(guildId);
  const members = db.prepare('SELECT COUNT(*) AS count FROM guild_members WHERE guild_id = ?').get(guildId).count;
  const ranks = db.prepare('SELECT COUNT(*) AS count FROM guild_ranks WHERE guild_id = ?').get(guildId).count;

  let roomMessages = 0;
  let roomAttachments = 0;
  let roomUploads = 0;
  let senderKeyDistributions = 0;
  const filePaths = new Set();

  const attachmentQuery = db.prepare(`
    SELECT a.file_url, uf.stored_name
    FROM attachments a
    JOIN messages m ON m.id = a.message_id
    LEFT JOIN uploaded_files uf ON uf.id = a.uploaded_file_id
    WHERE m.room_id = ?
  `);
  const uploadQuery = db.prepare('SELECT id, stored_name FROM uploaded_files WHERE room_id = ?');

  for (const room of rooms) {
    roomMessages += db.prepare('SELECT COUNT(*) AS count FROM messages WHERE room_id = ?').get(room.id).count;
    roomAttachments += db.prepare('SELECT COUNT(*) AS count FROM attachments WHERE message_id IN (SELECT id FROM messages WHERE room_id = ?)').get(room.id).count;
    roomUploads += db.prepare('SELECT COUNT(*) AS count FROM uploaded_files WHERE room_id = ?').get(room.id).count;
    senderKeyDistributions += db.prepare('SELECT COUNT(*) AS count FROM sender_key_distributions WHERE room_id = ?').get(room.id).count;

    for (const attachment of attachmentQuery.all(room.id)) {
      if (attachment.stored_name) {
        filePaths.add(path.join(uploadDir, path.basename(attachment.stored_name)));
      } else if (attachment.file_url) {
        filePaths.add(path.join(uploadDir, path.basename(attachment.file_url)));
      }
    }

    for (const upload of uploadQuery.all(room.id)) {
      if (upload.stored_name) {
        filePaths.add(path.join(uploadDir, path.basename(upload.stored_name)));
      }
    }
  }

  return {
    rooms,
    voiceChannels,
    members,
    ranks,
    roomMessages,
    roomAttachments,
    roomUploads,
    senderKeyDistributions,
    filePaths: Array.from(filePaths),
  };
}

function resetGuilds(guilds) {
  const deleteRoomAttachments = db.prepare(
    'DELETE FROM attachments WHERE message_id IN (SELECT id FROM messages WHERE room_id = ?)'
  );
  const deleteSenderKeyDistributionsForRoom = db.prepare(
    'DELETE FROM sender_key_distributions WHERE room_id = ?'
  );
  const deleteUploadedFilesForRoom = db.prepare('DELETE FROM uploaded_files WHERE room_id = ?');
  const deleteRoomMessages = db.prepare('DELETE FROM messages WHERE room_id = ?');
  const deleteRoomMembers = db.prepare('DELETE FROM room_members WHERE room_id = ?');
  const deleteRoom = db.prepare('DELETE FROM rooms WHERE id = ?');
  const clearVoiceSessions = db.prepare('DELETE FROM voice_sessions WHERE channel_id = ?');
  const deleteVoiceChannel = db.prepare('DELETE FROM voice_channels WHERE id = ?');
  const deleteGuildMembers = db.prepare('DELETE FROM guild_members WHERE guild_id = ?');
  const deleteGuildRanks = db.prepare('DELETE FROM guild_ranks WHERE guild_id = ?');
  const deleteGuild = db.prepare('DELETE FROM guilds WHERE id = ?');

  const transaction = db.transaction((snapshots) => {
    for (const { guild, snapshot } of snapshots) {
      for (const room of snapshot.rooms) {
        deleteRoomAttachments.run(room.id);
        deleteSenderKeyDistributionsForRoom.run(room.id);
        deleteUploadedFilesForRoom.run(room.id);
        deleteRoomMessages.run(room.id);
        deleteRoomMembers.run(room.id);
        deleteRoom.run(room.id);
      }

      for (const channel of snapshot.voiceChannels) {
        clearVoiceSessions.run(channel.id);
        deleteVoiceChannel.run(channel.id);
      }

      deleteGuildMembers.run(guild.id);
      deleteGuildRanks.run(guild.id);
      deleteGuild.run(guild.id);
    }
  });

  const snapshots = guilds.map((guild) => ({ guild, snapshot: collectGuildSnapshot(guild.id) }));
  transaction(snapshots);

  const deletedFiles = [];
  for (const { snapshot } of snapshots) {
    for (const filePath of snapshot.filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deletedFiles.push(filePath);
        }
      } catch (err) {
        log(`[warn] Failed to remove ${filePath}: ${err.message}`);
      }
    }
  }

  return { snapshots, deletedFiles };
}

const guilds = listTargetGuilds();

log(keepDefault
  ? '[mode] Resetting user-created guilds and preserving the default /guild'
  : '[mode] Resetting all guilds, including the default /guild');

if (guilds.length === 0) {
  log('[info] No target guilds found.');
  process.exit(0);
}

for (const guild of guilds) {
  const snapshot = collectGuildSnapshot(guild.id);
  log(`- ${guild.name} (${guild.id})`);
  log(`  members=${snapshot.members} ranks=${snapshot.ranks} rooms=${snapshot.rooms.length} voice=${snapshot.voiceChannels.length}`);
  log(`  room_messages=${snapshot.roomMessages} attachments=${snapshot.roomAttachments} uploads=${snapshot.roomUploads} sender_keys=${snapshot.senderKeyDistributions}`);
}

if (!apply) {
  log('[dry-run] No changes applied. Re-run with --apply to perform the reset.');
  if (!keepDefault) {
    log('[note] With current defaults, the app will recreate /guild on restart unless SEED_DEFAULT_GUILD=0 is set.');
  }
  process.exit(0);
}

const { snapshots, deletedFiles } = resetGuilds(guilds);
log(`[apply] Deleted ${snapshots.length} guild(s) and ${deletedFiles.length} upload file(s).`);
if (!keepDefault) {
  log('[note] If the server restarts with SEED_DEFAULT_GUILD not set, /guild will be auto-seeded again.');
}
