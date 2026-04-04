function attachGuildMemberRoutes({
  router,
  requireMember,
  hasPermission,
  sendFlowError,
  deps = {},
} = {}) {
  const {
    getGuildMembers,
    buildGuildMembersResponse,
    isGuildMember,
    buildMemberPermissionOverrideUpdate,
    updateMemberPermissionOverrides,
    getGuildRankById,
    buildRankAssignmentPlan,
    updateMemberRank,
    emitGuildRankChangedEvent,
    buildMemberNoteUpdate,
    updatePublicNote,
    updateOfficerNote,
    buildMemberRemovalPlan,
    removeGuildMember,
    removeUserFromGuildRooms,
    emitGuildMemberKickedEvent,
    broadcastPresenceIfAvailable,
    broadcastPresenceUpdates,
  } = deps;
  const {
    buildGuildMemberPermissionUpdateResponse,
    buildGuildRankCreateResponse,
    buildGuildAdminOkResponse,
    buildGuildMotdResponse,
  } = require('../domain/guild/guildAdminRouteRuntime');

  router.get('/:id/members', (req, res) => {
    const member = requireMember(req, res);
    if (!member) return;
    res.json(buildGuildMembersResponse({
      members: getGuildMembers.all(req.params.id),
      includeOfficerNote: hasPermission(member, 'view_officer_note'),
    }));
  });

  router.put('/:id/members/:userId/permissions', (req, res) => {
    const member = requireMember(req, res);
    if (!member) return;

    const target = isGuildMember.get(req.params.id, req.params.userId);
    const overrideUpdate = buildMemberPermissionOverrideUpdate({
      actorMember: member,
      actorUserId: req.userId,
      targetUserId: req.params.userId,
      targetMember: target,
      overrides: req.body.overrides,
    });
    if (sendFlowError(res, overrideUpdate)) return;

    updateMemberPermissionOverrides.run(
      JSON.stringify(overrideUpdate.normalizedOverrides),
      req.params.id,
      req.params.userId,
    );
    res.json(buildGuildMemberPermissionUpdateResponse({
      overrides: overrideUpdate.normalizedOverrides,
    }));
  });

  router.put('/:id/members/:userId/rank', (req, res) => {
    const member = requireMember(req, res);
    if (!member) return;

    const target = isGuildMember.get(req.params.id, req.params.userId);
    const { rankId } = req.body;
    const newRank = getGuildRankById.get(rankId);
    const rankAssignment = buildRankAssignmentPlan({
      actorMember: member,
      canPromoteDemote: hasPermission(member, 'promote_demote'),
      targetMember: target,
      rankId,
      newRank,
      guildId: req.params.id,
    });
    if (sendFlowError(res, rankAssignment)) return;

    updateMemberRank.run(rankId, req.params.id, req.params.userId);

    emitGuildRankChangedEvent({
      io: router._io,
      guildId: req.params.id,
      userId: req.params.userId,
      rankId,
      rankName: rankAssignment.rankName,
      listGuildMemberIdsFn: (guildId) => getGuildMembers.all(guildId).map((memberState) => memberState.id),
    });
    res.json(buildGuildAdminOkResponse());
  });

  router.put('/:id/members/:userId/note', (req, res) => {
    const member = requireMember(req, res);
    if (!member) return;

    const noteUpdate = buildMemberNoteUpdate({
      actorUserId: req.userId,
      targetUserId: req.params.userId,
      publicNote: req.body.publicNote,
      officerNote: req.body.officerNote,
      canEditPublicNote: hasPermission(member, 'edit_public_note'),
      canEditOfficerNote: hasPermission(member, 'edit_officer_note'),
    });
    if (sendFlowError(res, noteUpdate)) return;

    if (noteUpdate.publicNote !== undefined) {
      updatePublicNote.run(noteUpdate.publicNote, req.params.id, req.params.userId);
    }

    if (noteUpdate.officerNote !== undefined) {
      updateOfficerNote.run(noteUpdate.officerNote, req.params.id, req.params.userId);
    }

    res.json(buildGuildAdminOkResponse());
  });

  router.delete('/:id/members/:userId', (req, res) => {
    const member = requireMember(req, res);
    if (!member) return;

    const target = isGuildMember.get(req.params.id, req.params.userId);
    const removalPlan = buildMemberRemovalPlan({
      actorMember: member,
      canRemoveMember: hasPermission(member, 'remove_member'),
      targetMember: target,
    });
    if (sendFlowError(res, removalPlan)) return;

    removeGuildMember.run(req.params.id, req.params.userId);
    removeUserFromGuildRooms(req.params.id, req.params.userId);

    emitGuildMemberKickedEvent({
      io: router._io,
      guildId: req.params.id,
      userId: req.params.userId,
      listGuildMemberIdsFn: (guildId) => getGuildMembers.all(guildId).map((memberState) => memberState.id),
    });
    broadcastPresenceIfAvailable({
      io: router._io,
      broadcastPresenceUpdatesFn: broadcastPresenceUpdates,
    });
    res.json(buildGuildAdminOkResponse());
  });
}

function attachGuildRankRoutes({
  router,
  requireMember,
  hasPermission,
  sendFlowError,
  deps = {},
} = {}) {
  const {
    uuidv4,
    db,
    getGuildRanks,
    toGuildRankResponse,
    buildGuildRanksResponse,
    buildRankCreateInput,
    getLowestRank,
    createGuildRank,
    getGuildRankById,
    buildRankUpdateInput,
    updateGuildRank,
    buildRankDeletionPlan,
    runGuildRankDeletionFlow,
    deleteGuildRank,
  } = deps;

  router.get('/:id/ranks', (req, res) => {
    const member = requireMember(req, res);
    if (!member) return;

    res.json(buildGuildRanksResponse({
      ranks: getGuildRanks.all(req.params.id),
      toGuildRankResponseFn: toGuildRankResponse,
    }));
  });

  router.post('/:id/ranks', (req, res) => {
    const member = requireMember(req, res);
    if (!member) return;
    const existingRanks = getGuildRanks.all(req.params.id);
    const rankCreate = buildRankCreateInput({
      canSetPermissions: hasPermission(member, 'set_permissions'),
      name: req.body.name,
      permissions: req.body.permissions,
      lowestRank: getLowestRank.get(req.params.id),
      existingRanksCount: existingRanks.length,
    });
    if (sendFlowError(res, rankCreate)) return;

    const rankId = `rank-${uuidv4()}`;

    try {
      createGuildRank.run(
        rankId,
        req.params.id,
        rankCreate.name,
        rankCreate.rankOrder,
        JSON.stringify(rankCreate.permissions),
      );
      res.status(201).json(buildGuildRankCreateResponse({
        rankId,
        name: rankCreate.name,
        rankOrder: rankCreate.rankOrder,
        permissions: rankCreate.permissions,
      }));
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Rank order conflict' });
      }
      throw err;
    }
  });

  router.put('/:id/ranks/:rankId', (req, res) => {
    const member = requireMember(req, res);
    if (!member) return;

    const rank = getGuildRankById.get(req.params.rankId);
    const rankUpdate = buildRankUpdateInput({
      actorMember: member,
      rank,
      guildId: req.params.id,
      name: req.body.name,
      permissions: req.body.permissions,
      canRenameRanks: hasPermission(member, 'modify_rank_names'),
      canSetPermissions: hasPermission(member, 'set_permissions'),
    });
    if (sendFlowError(res, rankUpdate)) return;

    updateGuildRank.run(rankUpdate.name, JSON.stringify(rankUpdate.permissions), req.params.rankId);
    res.json(buildGuildAdminOkResponse());
  });

  router.delete('/:id/ranks/:rankId', (req, res) => {
    const member = requireMember(req, res);
    if (!member) return;
    const rank = getGuildRankById.get(req.params.rankId);
    const allRanks = getGuildRanks.all(req.params.id);
    const rankDelete = buildRankDeletionPlan({
      actorMember: member,
      canSetPermissions: hasPermission(member, 'set_permissions'),
      rank,
      guildId: req.params.id,
      allRanks,
    });
    if (sendFlowError(res, rankDelete)) return;

    runGuildRankDeletionFlow({
      db,
      guildId: req.params.id,
      rankId: req.params.rankId,
      reassignToRankId: rankDelete.reassignTo.id,
      deleteGuildRank,
    });

    res.json(buildGuildAdminOkResponse({ reassignedTo: rankDelete.reassignTo.name }));
  });
}

function attachGuildMotdRoutes({
  router,
  requireMember,
  hasPermission,
  sendFlowError,
  deps = {},
} = {}) {
  const {
    getGuildById,
    buildMotdUpdate,
    updateGuildMotd,
    emitGuildMotdUpdatedEvent,
    getGuildMembers,
  } = deps;

  router.get('/:id/motd', (req, res) => {
    const member = requireMember(req, res);
    if (!member) return;

    const guild = getGuildById.get(req.params.id);
    res.json(buildGuildMotdResponse({ motd: guild.motd }));
  });

  router.put('/:id/motd', (req, res) => {
    const member = requireMember(req, res);
    if (!member) return;
    const motdUpdate = buildMotdUpdate({
      canModifyMotd: hasPermission(member, 'modify_motd'),
      motd: req.body.motd,
    });
    if (sendFlowError(res, motdUpdate)) return;

    updateGuildMotd.run(motdUpdate.motd, req.params.id);

    emitGuildMotdUpdatedEvent({
      io: router._io,
      guildId: req.params.id,
      motd: motdUpdate.motd,
      listGuildMemberIdsFn: (guildId) => getGuildMembers.all(guildId).map((memberState) => memberState.id),
    });
    res.json(buildGuildAdminOkResponse());
  });
}

module.exports = {
  attachGuildMemberRoutes,
  attachGuildRankRoutes,
  attachGuildMotdRoutes,
};
