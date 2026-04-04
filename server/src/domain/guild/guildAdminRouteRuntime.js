function buildGuildMemberPermissionUpdateResponse({ overrides } = {}) {
  return { success: true, overrides };
}

function buildGuildRankCreateResponse({
  rankId,
  name,
  rankOrder,
  permissions,
} = {}) {
  return {
    id: rankId,
    name,
    rank_order: rankOrder,
    permissions,
  };
}

function buildGuildAdminOkResponse(extra = {}) {
  return {
    ok: true,
    ...extra,
  };
}

function buildGuildMotdResponse({ motd } = {}) {
  return {
    motd: motd || '',
  };
}

module.exports = {
  buildGuildMemberPermissionUpdateResponse,
  buildGuildRankCreateResponse,
  buildGuildAdminOkResponse,
  buildGuildMotdResponse,
};
