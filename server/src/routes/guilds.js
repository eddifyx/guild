const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const auth = require('../middleware/authMiddleware');
const { broadcastPresenceUpdates } = require('../socket/presenceHandler');
const {
  db,
  createGuild, getGuildById, getAllPublicGuilds, getGuildByInviteCode,
  updateGuild, updateGuildMotd, deleteGuildRow, getUserCreatedGuildCount, updateGuildInviteCode,
  createGuildRank, getGuildRanks, getGuildRankById, updateGuildRank, deleteGuildRank, getLowestRank,
  addGuildMember, removeGuildMember, getGuildMembers, getUserGuilds,
  createRoom, addRoomMember, createVoiceChannel,
  addUserToGuildRooms, removeUserFromGuildRooms,
  isGuildMember, updateMemberRank, updatePublicNote, updateOfficerNote,
  updateMemberPermissionOverrides,
  getGuildMemberCount, deleteGuildMembers, deleteGuildRanks,
  getRoomsByGuild, getVoiceChannelsByGuild,
  deleteRoomAttachments, deleteRoomMessages, deleteRoomMembers, deleteRoomRow,
  clearChannelVoiceSessions, deleteVoiceChannel,
  DEFAULT_RANK_PERMISSIONS,
} = require('../db');

const router = express.Router();
router.use(auth);

// Validate image/banner URL Ã¢â‚¬â€ only allow http(s):// schemes (reject javascript:, data:, etc.)
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed.slice(0, 2048);
  if (/^\/uploads\/[a-f0-9-]+\.[a-z0-9]+$/i.test(trimmed)) return trimmed;
  return '';
}

function emitToGuildMembers(guildId, event, payload, extraUserIds = []) {
  if (!router._io || !guildId) return;
  const targetUserIds = new Set([
    ...getGuildMembers.all(guildId).map((member) => member.id),
    ...extraUserIds.filter(Boolean),
  ]);
  for (const userId of targetUserIds) {
    router._io.to(`user:${userId}`).emit(event, payload);
  }
}


// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

function getMemberWithPerms(guildId, userId) {
  const member = isGuildMember.get(guildId, userId);
  if (!member) return null;
  member._perms = JSON.parse(member.permissions || '{}');
  member._overrides = JSON.parse(member.permission_overrides || '{}');
  return member;
}

function hasPermission(member, permKey) {
  // Rank 0 (Guild Master) always has all permissions
  if (member.rank_order === 0) return true;
  // Per-member overrides take precedence over rank defaults
  if (member._overrides && member._overrides[permKey] !== undefined) {
    return !!member._overrides[permKey];
  }
  return !!member._perms[permKey];
}

function requireMember(req, res) {
  const member = getMemberWithPerms(req.params.id, req.userId);
  if (!member) {
    res.status(403).json({ error: 'Not a member of this guild' });
    return null;
  }
  return member;
}

// ---------------------------------------------------------------------------
// Guild CRUD
// ---------------------------------------------------------------------------

// GET /api/guilds Ã¢â‚¬â€ list user's guilds
router.get('/', (req, res) => {
  const guilds = getUserGuilds.all(req.userId);
  const result = guilds.map(g => ({
    ...g,
    memberCount: getGuildMemberCount.get(g.id).count,
    permissions: undefined, // Don't leak raw permissions JSON in list
  }));
  res.json(result);
});

// GET /api/guilds/public Ã¢â‚¬â€ browse public guilds
router.get('/public', (req, res) => {
  const guilds = getAllPublicGuilds.all();
  const result = guilds.map(g => ({
    ...g,
    memberCount: getGuildMemberCount.get(g.id).count,
  }));
  res.json(result);
});

// POST /api/guilds Ã¢â‚¬â€ create guild
router.post('/', (req, res) => {
  const { name, description, image_url, is_public } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Guild name is required' });
  if (name.trim().length > 100) return res.status(400).json({ error: 'Guild name must be 100 characters or less' });

  // Max 1 guild created per user
  const count = getUserCreatedGuildCount.get(req.userId);
  if (count.count >= 1) {
    return res.status(429).json({ error: 'You can only create one guild' });
  }

  // Single-guild model: leave current guild before creating
  const existingGuilds = getUserGuilds.all(req.userId);
  if (existingGuilds.length > 0) {
    for (const g of existingGuilds) {
      // Check if user is Guild Master of any guild
      const membership = isGuildMember.get(g.id, req.userId);
      if (membership && membership.rank_order === 0) {
        return res.status(403).json({ error: 'You must transfer Guild Master or disband your current guild before forming a new one' });
      }
      removeGuildMember.run(g.id, req.userId);
      removeUserFromGuildRooms(g.id, req.userId);
      emitToGuildMembers(g.id, 'guild:member_left', { guildId: g.id, userId: req.userId });
    }
  }

  const id = uuidv4();
  const inviteCode = crypto.randomBytes(8).toString('hex');

  try {
    const createGuildWithRanks = db.transaction(() => {
      createGuild.run(
        id, name.trim(), (description || '').slice(0, 500), sanitizeUrl(image_url),
        '', '#40FF40', '#080a08', req.userId, is_public ? 1 : 0, inviteCode
      );

      // Create default ranks
      const ranks = [
        { key: 'guildMaster', name: 'Guild Master', order: 0 },
        { key: 'officer', name: 'Officer', order: 1 },
        { key: 'veteran', name: 'Veteran', order: 2 },
        { key: 'member', name: 'Member', order: 3 },
        { key: 'initiate', name: 'Initiate', order: 4 },
      ];

      let gmRankId;
      for (const rank of ranks) {
        const rankId = `rank-${id}-${rank.order}`;
        createGuildRank.run(rankId, id, rank.name, rank.order, JSON.stringify(DEFAULT_RANK_PERMISSIONS[rank.key]));
        if (rank.order === 0) gmRankId = rankId;
      }

      // Add creator as Guild Master
      addGuildMember.run(id, req.userId, gmRankId);

      // Create default General text room and voice channel
      const roomId = uuidv4();
      createRoom.run(roomId, 'General', id, req.userId);
      addRoomMember.run(roomId, req.userId);

      const voiceId = uuidv4();
      createVoiceChannel.run(voiceId, 'General', id, req.userId);
    });

    createGuildWithRanks();
    const guild = getGuildById.get(id);
    if (router._io) {
      broadcastPresenceUpdates(router._io);
    }
    res.status(201).json({ ...guild, memberCount: 1 });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Guild name already exists' });
    }
    throw err;
  }
});

// GET /api/guilds/:id Ã¢â‚¬â€ get guild details
router.get('/:id', (req, res) => {
  const member = requireMember(req, res);
  if (!member) return;

  const guild = getGuildById.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });

  const ranks = getGuildRanks.all(req.params.id);
  const memberCount = getGuildMemberCount.get(req.params.id).count;

  res.json({
    ...guild,
    ranks,
    memberCount,
    myRank: { id: member.rank_id, name: member.rank_name, order: member.rank_order, permissions: member._perms },
  });
});

// PUT /api/guilds/:id Ã¢â‚¬â€ update guild info
router.put('/:id', (req, res) => {
  const member = requireMember(req, res);
  if (!member) return;
  if (!hasPermission(member, 'manage_theme')) {
    return res.status(403).json({ error: 'No permission to edit guild' });
  }

  const guild = getGuildById.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });

  const { name, description, image_url, banner_url, accent_color, bg_color, is_public } = req.body;
  const newName = (name || guild.name).trim();
  if (!newName) return res.status(400).json({ error: 'Guild name is required' });
  if (newName.length > 100) return res.status(400).json({ error: 'Guild name must be 100 characters or less' });

  try {
    updateGuild.run(
      newName,
      description !== undefined ? (description || '').slice(0, 500) : guild.description,
      image_url !== undefined ? sanitizeUrl(image_url) : guild.image_url,
      banner_url !== undefined ? sanitizeUrl(banner_url) : guild.banner_url,
      accent_color || guild.accent_color,
      bg_color || guild.bg_color,
      is_public !== undefined ? (is_public ? 1 : 0) : guild.is_public,
      req.params.id
    );
    const updatedGuild = getGuildById.get(req.params.id);
    emitToGuildMembers(req.params.id, 'guild:updated', { guildId: req.params.id });
    res.json(updatedGuild);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Guild name already exists' });
    }
    throw err;
  }
});

// DELETE /api/guilds/:id Ã¢â‚¬â€ disband guild
router.delete('/:id', (req, res) => {
  const member = requireMember(req, res);
  if (!member) return;
  if (member.rank_order !== 0) {
    return res.status(403).json({ error: 'Only the Guild Master can disband the guild' });
  }

  // Prevent deleting the default guild
  if (req.params.id === 'guild-byzantine-default') {
    return res.status(403).json({ error: 'Cannot delete the default guild' });
  }

  const memberIds = getGuildMembers.all(req.params.id).map((member) => member.id);
  const disbandGuild = db.transaction((guildId) => {
    // Delete all rooms and their data
    const rooms = getRoomsByGuild.all(guildId);
    for (const room of rooms) {
      deleteRoomAttachments.run(room.id);
      deleteRoomMessages.run(room.id);
      deleteRoomMembers.run(room.id);
      deleteRoomRow.run(room.id);
    }

    // Delete all voice channels
    const voiceChannels = getVoiceChannelsByGuild.all(guildId);
    for (const vc of voiceChannels) {
      clearChannelVoiceSessions.run(vc.id);
      deleteVoiceChannel.run(vc.id);
    }

    // Delete members, ranks, then guild
    deleteGuildMembers.run(guildId);
    deleteGuildRanks.run(guildId);
    deleteGuildRow.run(guildId);
  });

  disbandGuild(req.params.id);

  if (router._io) {
    for (const userId of memberIds) {
      router._io.to(`user:${userId}`).emit('guild:disbanded', { guildId: req.params.id });
    }
    broadcastPresenceUpdates(router._io);
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Join / Leave / Transfer
// ---------------------------------------------------------------------------

// POST /api/guilds/:id/join Ã¢â‚¬â€ join public guild
router.post('/:id/join', (req, res) => {
  const guild = getGuildById.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });
  if (!guild.is_public) return res.status(403).json({ error: 'This guild is invite-only' });

  const existing = isGuildMember.get(req.params.id, req.userId);
  if (existing) return res.status(409).json({ error: 'Already a member' });

  // Single-guild model: auto-leave current guild
  const currentGuilds = getUserGuilds.all(req.userId);
  for (const g of currentGuilds) {
    const membership = isGuildMember.get(g.id, req.userId);
    if (membership && membership.rank_order === 0) {
      return res.status(403).json({ error: 'You must transfer Guild Master or disband your current guild before switching guilds' });
    }
    removeGuildMember.run(g.id, req.userId);
      removeUserFromGuildRooms(g.id, req.userId);
    emitToGuildMembers(g.id, 'guild:member_left', { guildId: g.id, userId: req.userId });
  }

  // Join as lowest rank (Initiate)
  const lowest = getLowestRank.get(req.params.id);
  if (!lowest) return res.status(500).json({ error: 'Guild has no ranks' });

  addGuildMember.run(req.params.id, req.userId, lowest.id);
  addUserToGuildRooms(req.params.id, req.userId);

  emitToGuildMembers(req.params.id, 'guild:member_joined', { guildId: req.params.id, userId: req.userId });
  if (router._io) {
    broadcastPresenceUpdates(router._io);
  }
  res.json({ ok: true });
});

// POST /api/guilds/join/:inviteCode Ã¢â‚¬â€ join by invite code
router.post('/join/:inviteCode', (req, res) => {
  const guild = getGuildByInviteCode.get(req.params.inviteCode);
  if (!guild) return res.status(404).json({ error: 'Invalid invite code' });

  const existing = isGuildMember.get(guild.id, req.userId);
  if (existing) return res.status(409).json({ error: 'Already a member' });

  // Single-guild model: auto-leave current guild
  const currentGuilds = getUserGuilds.all(req.userId);
  for (const g of currentGuilds) {
    const membership = isGuildMember.get(g.id, req.userId);
    if (membership && membership.rank_order === 0) {
      return res.status(403).json({ error: 'You must transfer Guild Master or disband your current guild before switching guilds' });
    }
    removeGuildMember.run(g.id, req.userId);
      removeUserFromGuildRooms(g.id, req.userId);
    emitToGuildMembers(g.id, 'guild:member_left', { guildId: g.id, userId: req.userId });
  }

  const lowest = getLowestRank.get(guild.id);
  if (!lowest) return res.status(500).json({ error: 'Guild has no ranks' });

  addGuildMember.run(guild.id, req.userId, lowest.id);
  addUserToGuildRooms(guild.id, req.userId);

  emitToGuildMembers(guild.id, 'guild:member_joined', { guildId: guild.id, userId: req.userId });
  if (router._io) {
    broadcastPresenceUpdates(router._io);
  }
  res.json({ ok: true, guildId: guild.id, guildName: guild.name });
});

// POST /api/guilds/:id/leave Ã¢â‚¬â€ leave guild
router.post('/:id/leave', (req, res) => {
  const member = requireMember(req, res);
  if (!member) return;

  // Guild Master cannot leave Ã¢â‚¬â€ must transfer first
  if (member.rank_order === 0) {
    return res.status(403).json({ error: 'Guild Master must transfer leadership before leaving' });
  }

  removeGuildMember.run(req.params.id, req.userId);
  removeUserFromGuildRooms(req.params.id, req.userId);

  emitToGuildMembers(req.params.id, 'guild:member_left', { guildId: req.params.id, userId: req.userId });
  if (router._io) {
    broadcastPresenceUpdates(router._io);
  }
  res.json({ ok: true });
});

// POST /api/guilds/:id/transfer Ã¢â‚¬â€ transfer Guild Master
router.post('/:id/transfer', (req, res) => {
  const member = requireMember(req, res);
  if (!member) return;
  if (member.rank_order !== 0) {
    return res.status(403).json({ error: 'Only the Guild Master can transfer leadership' });
  }

  const { targetUserId } = req.body;
  if (!targetUserId) return res.status(400).json({ error: 'Target user ID required' });

  const target = isGuildMember.get(req.params.id, targetUserId);
  if (!target) return res.status(404).json({ error: 'Target user is not a member' });

  // Get rank IDs
  const gmRank = getGuildRanks.all(req.params.id).find(r => r.rank_order === 0);
  // Demote current GM to Officer (rank 1), or Member (rank 3) if no Officer rank
  const officerRank = getGuildRanks.all(req.params.id).find(r => r.rank_order === 1)
    || getGuildRanks.all(req.params.id).find(r => r.rank_order === 3);

  if (!gmRank || !officerRank) return res.status(500).json({ error: 'Guild rank structure is broken' });

  const transfer = db.transaction(() => {
    updateMemberRank.run(gmRank.id, req.params.id, targetUserId);
    updateMemberRank.run(officerRank.id, req.params.id, req.userId);
  });
  transfer();

  emitToGuildMembers(req.params.id, 'guild:leadership_transferred', { guildId: req.params.id, newLeaderId: targetUserId });
  res.json({ ok: true });
});

// POST /api/guilds/:id/invite Ã¢â‚¬â€ get invite info
router.post('/:id/invite', (req, res) => {
  const member = requireMember(req, res);
  if (!member) return;
  if (!hasPermission(member, 'invite_member')) {
    return res.status(403).json({ error: 'No permission to invite members' });
  }

  const guild = getGuildById.get(req.params.id);
  res.json({ inviteCode: guild.invite_code });
});

// POST /api/guilds/:id/regenerate-invite
router.post('/:id/regenerate-invite', (req, res) => {
  const member = requireMember(req, res);
  if (!member) return;
  if (!hasPermission(member, 'invite_member')) {
    return res.status(403).json({ error: 'No permission to manage invites' });
  }

  const newCode = crypto.randomBytes(8).toString('hex');
  updateGuildInviteCode.run(newCode, req.params.id);
  res.json({ inviteCode: newCode });
});

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

// GET /api/guilds/:id/members
router.get('/:id/members', (req, res) => {
  const member = requireMember(req, res);
  if (!member) return;

  const members = getGuildMembers.all(req.params.id);
  const canViewOfficerNotes = hasPermission(member, 'view_officer_note');

  const result = members.map(m => ({
    id: m.id,
    username: m.username,
    npub: m.npub,
    avatarColor: m.avatar_color,
    profilePicture: m.profile_picture,
    rankId: m.rank_id,
    rankName: m.rank_name,
    rankOrder: m.rank_order,
    publicNote: m.public_note,
    officerNote: canViewOfficerNotes ? m.officer_note : undefined,
    permissionOverrides: m.permission_overrides ? JSON.parse(m.permission_overrides) : {},
    joinedAt: m.joined_at,
    lastSeen: m.last_seen,
  }));
  res.json(result);
});

// PUT /api/guilds/:id/members/:userId/permissions Ã¢â‚¬â€ per-member permission overrides (GM only)
router.put('/:id/members/:userId/permissions', (req, res) => {
  const member = requireMember(req, res);
  if (!member) return;
  // Only Guild Master (rank_order 0) can set per-member overrides
  if (member.rank_order !== 0) {
    return res.status(403).json({ error: 'Only the Guild Master can set per-member permissions' });
  }

  const target = isGuildMember.get(req.params.id, req.params.userId);
  if (!target) return res.status(404).json({ error: 'User is not a member' });
  // Cannot set overrides on yourself (GM)
  if (req.params.userId === req.userId) {
    return res.status(400).json({ error: 'Cannot set permission overrides on yourself' });
  }

  const { overrides } = req.body;
  if (!overrides || typeof overrides !== 'object') {
    return res.status(400).json({ error: 'overrides object required' });
  }

  // disband_guild can NEVER be delegated
  if (overrides.disband_guild !== undefined) {
    delete overrides.disband_guild;
  }

  // Only allow known permission keys
  const VALID_KEYS = new Set([
    'invite_member', 'remove_member', 'promote_demote', 'manage_applications',
    'guild_chat_speak', 'guild_chat_listen', 'officer_chat', 'modify_motd',
    'create_delete_events', 'edit_public_note', 'edit_officer_note', 'view_officer_note',
    'view_asset_dump', 'upload_files', 'download_files', 'delete_files', 'manage_storage',
    'modify_rank_names', 'set_permissions', 'manage_rooms', 'manage_theme',
    'transfer_leadership',
  ]);
  const cleaned = {};
  for (const [key, val] of Object.entries(overrides)) {
    if (VALID_KEYS.has(key)) cleaned[key] = !!val;
  }

  updateMemberPermissionOverrides.run(JSON.stringify(cleaned), req.params.id, req.params.userId);
  res.json({ success: true, overrides: cleaned });
});

// PUT /api/guilds/:id/members/:userId/rank Ã¢â‚¬â€ promote/demote
router.put('/:id/members/:userId/rank', (req, res) => {
  const member = requireMember(req, res);
  if (!member) return;
  if (!hasPermission(member, 'promote_demote')) {
    return res.status(403).json({ error: 'No permission to change ranks' });
  }

  const target = isGuildMember.get(req.params.id, req.params.userId);
  if (!target) return res.status(404).json({ error: 'User is not a member' });

  const targetPerms = JSON.parse(target.permissions || '{}');
  // Cannot affect someone at same rank or higher
  if (target.rank_order <= member.rank_order) {
    return res.status(403).json({ error: 'Cannot change rank of someone at or above your rank' });
  }

  const { rankId } = req.body;
  if (!rankId) return res.status(400).json({ error: 'Rank ID required' });

  const newRank = getGuildRankById.get(rankId);
  if (!newRank || newRank.guild_id !== req.params.id) {
    return res.status(404).json({ error: 'Rank not found in this guild' });
  }

  // Cannot promote to your own rank or above
  if (newRank.rank_order <= member.rank_order) {
    return res.status(403).json({ error: 'Cannot promote someone to your rank or above' });
  }

  updateMemberRank.run(rankId, req.params.id, req.params.userId);

  emitToGuildMembers(req.params.id, 'guild:member_rank_changed', {
    guildId: req.params.id, userId: req.params.userId, rankId, rankName: newRank.name,
  });
  res.json({ ok: true });
});

// PUT /api/guilds/:id/members/:userId/note
router.put('/:id/members/:userId/note', (req, res) => {
  const member = requireMember(req, res);
  if (!member) return;

  const { publicNote, officerNote } = req.body;

  if (publicNote !== undefined) {
    // Members can always edit their own public note; editing others requires permission
    if (req.params.userId !== req.userId) {
      if (!hasPermission(member, 'edit_public_note')) {
        return res.status(403).json({ error: 'No permission to edit public notes' });
      }
    }
    updatePublicNote.run((publicNote || '').slice(0, 200), req.params.id, req.params.userId);
  }

  if (officerNote !== undefined) {
    if (!hasPermission(member, 'edit_officer_note')) {
      return res.status(403).json({ error: 'No permission to edit officer notes' });
    }
    updateOfficerNote.run((officerNote || '').slice(0, 500), req.params.id, req.params.userId);
  }

  res.json({ ok: true });
});

// DELETE /api/guilds/:id/members/:userId Ã¢â‚¬â€ kick member
router.delete('/:id/members/:userId', (req, res) => {
  const member = requireMember(req, res);
  if (!member) return;
  if (!hasPermission(member, 'remove_member')) {
    return res.status(403).json({ error: 'No permission to kick members' });
  }

  const target = isGuildMember.get(req.params.id, req.params.userId);
  if (!target) return res.status(404).json({ error: 'User is not a member' });

  if (target.rank_order <= member.rank_order) {
    return res.status(403).json({ error: 'Cannot kick someone at or above your rank' });
  }

  removeGuildMember.run(req.params.id, req.params.userId);
  removeUserFromGuildRooms(req.params.id, req.params.userId);

  emitToGuildMembers(req.params.id, 'guild:member_kicked', { guildId: req.params.id, userId: req.params.userId }, [req.params.userId]);
  if (router._io) {
    broadcastPresenceUpdates(router._io);
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Ranks
// ---------------------------------------------------------------------------

// GET /api/guilds/:id/ranks
router.get('/:id/ranks', (req, res) => {
  const member = requireMember(req, res);
  if (!member) return;

  const ranks = getGuildRanks.all(req.params.id).map(r => ({
    ...r,
    permissions: JSON.parse(r.permissions || '{}'),
  }));
  res.json(ranks);
});

// POST /api/guilds/:id/ranks Ã¢â‚¬â€ create new rank
router.post('/:id/ranks', (req, res) => {
  const member = requireMember(req, res);
  if (!member) return;
  if (!hasPermission(member, 'set_permissions')) {
    return res.status(403).json({ error: 'No permission to manage ranks' });
  }

  const { name, permissions } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Rank name required' });
  if (name.trim().length > 50) return res.status(400).json({ error: 'Rank name must be 50 characters or less' });

  // New rank goes above lowest (but below existing lowest)
  const lowest = getLowestRank.get(req.params.id);
  const newOrder = lowest ? lowest.rank_order + 1 : 1;

  // Limit total ranks
  const existingRanks = getGuildRanks.all(req.params.id);
  if (existingRanks.length >= 20) {
    return res.status(429).json({ error: 'Maximum 20 ranks per guild' });
  }

  const rankId = `rank-${uuidv4()}`;
  const perms = permissions || DEFAULT_RANK_PERMISSIONS.initiate;

  try {
    createGuildRank.run(rankId, req.params.id, name.trim(), newOrder, JSON.stringify(perms));
    res.status(201).json({ id: rankId, name: name.trim(), rank_order: newOrder, permissions: perms });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Rank order conflict' });
    }
    throw err;
  }
});

// PUT /api/guilds/:id/ranks/:rankId Ã¢â‚¬â€ update rank name/permissions
router.put('/:id/ranks/:rankId', (req, res) => {
  const member = requireMember(req, res);
  if (!member) return;

  const rank = getGuildRankById.get(req.params.rankId);
  if (!rank || rank.guild_id !== req.params.id) {
    return res.status(404).json({ error: 'Rank not found' });
  }

  // Cannot edit rank 0 permissions (Guild Master always has all)
  if (rank.rank_order === 0) {
    return res.status(403).json({ error: 'Cannot edit Guild Master rank permissions' });
  }

  // Can only edit ranks below yours
  if (rank.rank_order <= member.rank_order) {
    return res.status(403).json({ error: 'Cannot edit a rank at or above your own' });
  }

  const { name, permissions } = req.body;

  if (name !== undefined && !hasPermission(member, 'modify_rank_names')) {
    return res.status(403).json({ error: 'No permission to rename ranks' });
  }
  if (permissions !== undefined && !hasPermission(member, 'set_permissions')) {
    return res.status(403).json({ error: 'No permission to set permissions' });
  }

  const newName = name !== undefined ? (name || '').trim().slice(0, 50) || rank.name : rank.name;
  const newPerms = permissions !== undefined ? JSON.stringify(permissions) : rank.permissions;

  updateGuildRank.run(newName, newPerms, req.params.rankId);
  res.json({ ok: true });
});

// DELETE /api/guilds/:id/ranks/:rankId Ã¢â‚¬â€ delete rank
router.delete('/:id/ranks/:rankId', (req, res) => {
  const member = requireMember(req, res);
  if (!member) return;
  if (!hasPermission(member, 'set_permissions')) {
    return res.status(403).json({ error: 'No permission to manage ranks' });
  }

  const rank = getGuildRankById.get(req.params.rankId);
  if (!rank || rank.guild_id !== req.params.id) {
    return res.status(404).json({ error: 'Rank not found' });
  }
  if (rank.rank_order === 0) {
    return res.status(403).json({ error: 'Cannot delete Guild Master rank' });
  }
  if (rank.rank_order <= member.rank_order) {
    return res.status(403).json({ error: 'Cannot delete a rank at or above your own' });
  }

  // Reassign members of this rank to the next lower rank
  const allRanks = getGuildRanks.all(req.params.id);
  const lowerRanks = allRanks.filter(r => r.rank_order > rank.rank_order);
  const higherRanks = allRanks.filter(r => r.rank_order < rank.rank_order && r.rank_order > 0);
  const reassignTo = lowerRanks[0] || higherRanks[higherRanks.length - 1];

  if (!reassignTo) {
    return res.status(400).json({ error: 'Cannot delete the only non-GM rank' });
  }

  const deleteRankTx = db.transaction(() => {
    // Move all members from deleted rank to the reassignment rank
    db.prepare('UPDATE guild_members SET rank_id = ? WHERE guild_id = ? AND rank_id = ?')
      .run(reassignTo.id, req.params.id, req.params.rankId);
    deleteGuildRank.run(req.params.rankId);
  });
  deleteRankTx();

  res.json({ ok: true, reassignedTo: reassignTo.name });
});

// ---------------------------------------------------------------------------
// Message of the Day
// ---------------------------------------------------------------------------

// GET /api/guilds/:id/motd
router.get('/:id/motd', (req, res) => {
  const member = requireMember(req, res);
  if (!member) return;

  const guild = getGuildById.get(req.params.id);
  res.json({ motd: guild.motd || '' });
});

// PUT /api/guilds/:id/motd
router.put('/:id/motd', (req, res) => {
  const member = requireMember(req, res);
  if (!member) return;
  if (!hasPermission(member, 'modify_motd')) {
    return res.status(403).json({ error: 'No permission to modify Message of the Day' });
  }

  const { motd } = req.body;
  updateGuildMotd.run((motd || '').slice(0, 500), req.params.id);

  emitToGuildMembers(req.params.id, 'guild:motd_updated', { guildId: req.params.id, motd: (motd || '').slice(0, 500) });
  res.json({ ok: true });
});

module.exports = router;
