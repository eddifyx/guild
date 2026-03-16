const express = require('express');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/authMiddleware');
const {
  db, createRoom, getAllRooms, getRoomById, getRoomsByGuild, addRoomMember,
  removeRoomMember, getRoomMembers, getUserRooms, isRoomMember,
  renameRoom, deleteRoomRow, deleteRoomMembers, deleteRoomAttachments, deleteRoomMessages,
  getAllUsers, isGuildMember, getGuildMembers,
  getPendingSenderKeyDistributionsForRecipientInRoom,
  acknowledgeSenderKeyDistributions,
  deleteSenderKeyDistributionsForRoom,
  deleteSenderKeyDistributionsForRecipientInRoom,
} = require('../db');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const { guildId } = req.query;
  if (!guildId) return res.status(400).json({ error: 'guildId is required' });
  const membership = isGuildMember.get(guildId, req.userId);
  if (!membership) return res.status(403).json({ error: 'Not a member of this guild' });
  const rooms = getRoomsByGuild.all(guildId);
  res.json(rooms);
});

router.get('/mine', auth, (req, res) => {
  const rooms = getUserRooms.all(req.userId);
  res.json(rooms);
});

const MAX_ROOMS_PER_USER = 50;

router.post('/', auth, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Room name is required' });
  }
  if (name.trim().length > 100) {
    return res.status(400).json({ error: 'Room name must be 100 characters or less' });
  }
  // Prevent unbounded room creation
  const allRooms = getAllRooms.all();
  const userRoomCount = allRooms.filter(r => r.created_by === req.userId).length;
  if (userRoomCount >= MAX_ROOMS_PER_USER) {
    return res.status(429).json({ error: `Cannot create more than ${MAX_ROOMS_PER_USER} rooms` });
  }

  const { guildId } = req.body;
  if (!guildId) return res.status(400).json({ error: 'Guild ID is required' });

  // Verify user is a guild member
  const guildMembership = isGuildMember.get(guildId, req.userId);
  if (!guildMembership) return res.status(403).json({ error: 'Not a member of this guild' });

  // Check manage_rooms permission
  const perms = JSON.parse(guildMembership.permissions || '{}');
  if (guildMembership.rank_order !== 0 && !perms.manage_rooms) {
    return res.status(403).json({ error: 'No permission to create rooms' });
  }

  const id = uuidv4();
  try {
    createRoom.run(id, name.trim(), guildId, req.userId);
    // Auto-join all guild members to new room
    const guildMembers = getGuildMembers.all(guildId);
    for (const m of guildMembers) {
      addRoomMember.run(id, m.id);
    }
    const room = getRoomById.get(id);
    // Notify guild members about new room
    if (router._io) {
      const guildMemberIds = guildMembers.map(m => m.id);
      for (const memberId of guildMemberIds) {
        router._io.to(`user:${memberId}`).emit('room:created', room);
      }
    }
    res.status(201).json(room);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Room name already exists' });
    }
    throw err;
  }
});

router.post('/:id/join', auth, (req, res) => {
  const room = getRoomById.get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  // Verify user is a member of the room's guild
  if (room.guild_id) {
    const membership = isGuildMember.get(room.guild_id, req.userId);
    if (!membership) return res.status(403).json({ error: 'Not a member of this guild' });
  }

  addRoomMember.run(req.params.id, req.userId);
  res.json({ success: true });
});

router.post('/:id/leave', auth, (req, res) => {
  removeRoomMember.run(req.params.id, req.userId);
  deleteSenderKeyDistributionsForRecipientInRoom.run(req.params.id, req.userId);

  // Broadcast member removal so remaining members re-key their sender keys
  if (router._io) {
    const remainingMembers = getRoomMembers.all(req.params.id);
    router._io.to(`room:${req.params.id}`).emit('room:member_removed', {
      roomId: req.params.id,
      removedUserId: req.userId,
      members: remainingMembers.map(m => m.id),
    });
  }

  res.json({ success: true });
});

router.get('/:id/members', auth, (req, res) => {
  // Only room members can see the member list
  const member = isRoomMember.get(req.params.id, req.userId);
  if (!member) return res.status(403).json({ error: 'Not a member of this room' });
  const members = getRoomMembers.all(req.params.id);
  res.json(members);
});

router.get('/:id/sender-keys', auth, (req, res) => {
  const member = isRoomMember.get(req.params.id, req.userId);
  if (!member) return res.status(403).json({ error: 'Not a member of this room' });

  const pending = getPendingSenderKeyDistributionsForRecipientInRoom.all(req.userId, req.params.id);
  res.json(pending.map((entry) => ({
    id: entry.id,
    roomId: entry.room_id,
    fromUserId: entry.sender_user_id,
    distributionId: entry.distribution_id,
    envelope: entry.envelope,
    senderNpub: entry.sender_npub || null,
    createdAt: entry.created_at,
  })));
});

router.post('/:id/sender-keys/ack', auth, (req, res) => {
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.filter((value) => typeof value === 'string').slice(0, 100)
    : [];
  if (ids.length === 0) {
    return res.status(400).json({ error: 'Sender key IDs are required' });
  }

  const acknowledged = acknowledgeSenderKeyDistributions(req.userId, req.params.id, ids);
  res.json({ ok: true, acknowledged });
});

// Rename room (creator only)
router.put('/:id', auth, (req, res) => {
  const room = getRoomById.get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.created_by !== req.userId) {
    return res.status(403).json({ error: 'Only the room creator can rename it' });
  }

  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Room name is required' });
  }
  if (name.trim().length > 100) {
    return res.status(400).json({ error: 'Room name must be 100 characters or less' });
  }

  try {
    renameRoom.run(name.trim(), req.params.id);
    const updated = getRoomById.get(req.params.id);
    if (router._io) {
      router._io.to(`room:${req.params.id}`).emit('room:renamed', { roomId: req.params.id, name: name.trim() });
    }
    res.json(updated);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Room name already exists' });
    }
    throw err;
  }
});

// Delete room (creator only)
router.delete('/:id', auth, (req, res) => {
  const room = getRoomById.get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.created_by !== req.userId) {
    return res.status(403).json({ error: 'Only the room creator can delete it' });
  }

  // Get members before deletion so we can notify them
  const membersBeforeDelete = getRoomMembers.all(req.params.id);

  // Wrap in transaction to prevent partial deletion
  const deleteRoom = db.transaction((roomId) => {
    deleteRoomAttachments.run(roomId);
    deleteRoomMessages.run(roomId);
    deleteSenderKeyDistributionsForRoom.run(roomId);
    deleteRoomMembers.run(roomId);
    deleteRoomRow.run(roomId);
  });
  deleteRoom(req.params.id);

  if (router._io) {
    // Notify only former members (room socket room is gone after deleteRoomMembers)
    const memberIds = membersBeforeDelete.map(m => m.id);
    for (const memberId of memberIds) {
      router._io.to(`user:${memberId}`).emit('room:deleted', { roomId: req.params.id });
      router._io.to(`user:${memberId}`).emit('room:member_removed', {
        roomId: req.params.id,
        removedUserId: null,
        members: [],
      });
    }
  }
  res.json({ success: true });
});

module.exports = router;
