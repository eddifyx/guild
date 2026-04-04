function attachGuildCrudRoutes({
  router,
  requireMember,
  hasPermission,
  sendFlowError,
  deps = {},
} = {}) {
  const {
    db,
    uuidv4,
    createInviteCodeFn = () => '',
    getUserGuilds,
    getAllPublicGuilds,
    getGuildById,
    getGuildRanks,
    getGuildMemberCount,
    getUserCreatedGuildCount,
    getGuildMembers,
    isGuildMember,
    buildGuildCreateInput,
    buildGuildUpdateInput,
    resolveGuildSwitchPlan,
    toGuildListEntry,
    buildGuildListResponse,
    buildGuildDetailResponse,
    buildGuildCreateResponse,
    toGuildRankResponse,
    toGuildSelfRank,
    runGuildCreateFlow,
    createGuild,
    createGuildRank,
    addGuildMember,
    createRoom,
    addRoomMember,
    createVoiceChannel,
    removeGuildMember,
    removeUserFromGuildRooms,
    updateGuild,
    emitGuildMemberLeftEvents,
    emitGuildUpdatedEvent,
    broadcastPresenceIfAvailable,
    broadcastPresenceUpdates,
  } = deps;

  router.get('/', (req, res) => {
    const guilds = getUserGuilds.all(req.userId);
    res.json(buildGuildListResponse({
      guilds,
      getGuildMemberCountFn: (guildId) => getGuildMemberCount.get(guildId),
      toGuildListEntryFn: toGuildListEntry,
    }));
  });

  router.get('/public', (req, res) => {
    const guilds = getAllPublicGuilds.all();
    res.json(buildGuildListResponse({
      guilds,
      getGuildMemberCountFn: (guildId) => getGuildMemberCount.get(guildId),
      toGuildListEntryFn: toGuildListEntry,
      hideRawPermissions: false,
    }));
  });

  router.post('/', (req, res) => {
    const createInput = buildGuildCreateInput(req.body);
    if (sendFlowError(res, createInput)) return;

    const count = getUserCreatedGuildCount.get(req.userId);
    if (count.count >= 1) {
      return res.status(429).json({ error: 'You can only create one guild' });
    }

    const existingGuilds = getUserGuilds.all(req.userId);
    const guildSwitchPlan = resolveGuildSwitchPlan({
      userGuilds: existingGuilds,
      guildMasterError: 'You must transfer Guild Master or disband your current guild before forming a new one',
      getMembership: (guildId) => isGuildMember.get(guildId, req.userId),
    });
    const { guilds: guildsToLeave, error: guildSwitchError } = guildSwitchPlan;
    if (guildSwitchError) {
      return res.status(403).json({ error: guildSwitchError });
    }

    const id = uuidv4();
    const inviteCode = createInviteCodeFn();

    try {
      runGuildCreateFlow({
        db,
        guildId: id,
        inviteCode,
        userId: req.userId,
        createInput,
        guildsToLeave,
        createIdFn: uuidv4,
        createGuild,
        createGuildRank,
        addGuildMember,
        createRoom,
        addRoomMember,
        createVoiceChannel,
        removeGuildMember,
        removeUserFromGuildRooms,
      });
      emitGuildMemberLeftEvents({
        io: router._io,
        guildIds: guildsToLeave.map((guild) => guild.id),
        userId: req.userId,
        listGuildMemberIdsFn: (guildId) => getGuildMembers.all(guildId).map((memberState) => memberState.id),
      });
      const guild = getGuildById.get(id);
      broadcastPresenceIfAvailable({
        io: router._io,
        broadcastPresenceUpdatesFn: broadcastPresenceUpdates,
      });
      res.status(201).json(buildGuildCreateResponse({ guild, memberCount: 1 }));
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Guild name already exists' });
      }
      throw err;
    }
  });

  router.get('/:id', (req, res) => {
    const member = requireMember(req, res);
    if (!member) return;

    const guild = getGuildById.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    res.json(buildGuildDetailResponse({
      guild,
      member,
      ranks: getGuildRanks.all(req.params.id),
      memberCount: getGuildMemberCount.get(req.params.id).count,
      toGuildRankResponseFn: toGuildRankResponse,
      toGuildSelfRankFn: toGuildSelfRank,
    }));
  });

  router.put('/:id', (req, res) => {
    const member = requireMember(req, res);
    if (!member) return;
    if (!hasPermission(member, 'manage_theme')) {
      return res.status(403).json({ error: 'No permission to edit guild' });
    }

    const guild = getGuildById.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const updateInput = buildGuildUpdateInput({ guild, input: req.body });
    if (sendFlowError(res, updateInput)) return;

    try {
      updateGuild.run(
        updateInput.name,
        updateInput.description,
        updateInput.imageUrl,
        updateInput.bannerUrl,
        updateInput.accentColor,
        updateInput.backgroundColor,
        updateInput.isPublic ? 1 : 0,
        req.params.id,
      );
      const updatedGuild = getGuildById.get(req.params.id);
      emitGuildUpdatedEvent({
        io: router._io,
        guildId: req.params.id,
        listGuildMemberIdsFn: (guildId) => getGuildMembers.all(guildId).map((memberState) => memberState.id),
      });
      res.json(updatedGuild);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Guild name already exists' });
      }
      throw err;
    }
  });
}

module.exports = {
  attachGuildCrudRoutes,
};
