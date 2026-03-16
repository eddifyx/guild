import { useState, useCallback, useMemo } from 'react';
import { api } from '../api';
import { rememberUsers } from '../crypto/identityDirectory.js';

export function useGuilds() {
  const [publicGuilds, setPublicGuilds] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPublicGuilds = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('/api/guilds/public');
      setPublicGuilds(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch public guilds:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createGuild = useCallback(async ({ name, description, image_url, is_public }) => {
    const guild = await api('/api/guilds', {
      method: 'POST',
      body: JSON.stringify({ name, description, image_url, is_public }),
    });
    return guild;
  }, []);

  const joinGuild = useCallback(async (guildId) => {
    await api(`/api/guilds/${guildId}/join`, { method: 'POST' });
  }, []);

  const joinByInviteCode = useCallback(async (inviteCode) => {
    const result = await api(`/api/guilds/join/${inviteCode}`, { method: 'POST' });
    return result;
  }, []);

  const leaveGuild = useCallback(async (guildId) => {
    await api(`/api/guilds/${guildId}/leave`, { method: 'POST' });
  }, []);

  const updateGuild = useCallback(async (guildId, updates) => {
    const guild = await api(`/api/guilds/${guildId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return guild;
  }, []);

  const disbandGuild = useCallback(async (guildId) => {
    await api(`/api/guilds/${guildId}`, { method: 'DELETE' });
  }, []);

  const transferLeadership = useCallback(async (guildId, targetUserId) => {
    await api(`/api/guilds/${guildId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  }, []);

  const getInviteCode = useCallback(async (guildId) => {
    const result = await api(`/api/guilds/${guildId}/invite`, { method: 'POST' });
    return result.inviteCode;
  }, []);

  const regenerateInvite = useCallback(async (guildId) => {
    const result = await api(`/api/guilds/${guildId}/regenerate-invite`, { method: 'POST' });
    return result.inviteCode;
  }, []);

  // Member management
  const fetchMembers = useCallback(async (guildId) => {
    const members = await api(`/api/guilds/${guildId}/members`);
    rememberUsers(members);
    return members;
  }, []);

  const changeMemberRank = useCallback(async (guildId, userId, rankId) => {
    await api(`/api/guilds/${guildId}/members/${userId}/rank`, {
      method: 'PUT',
      body: JSON.stringify({ rankId }),
    });
  }, []);

  const kickMember = useCallback(async (guildId, userId) => {
    await api(`/api/guilds/${guildId}/members/${userId}`, { method: 'DELETE' });
  }, []);

  const updateNote = useCallback(async (guildId, userId, { publicNote, officerNote }) => {
    await api(`/api/guilds/${guildId}/members/${userId}/note`, {
      method: 'PUT',
      body: JSON.stringify({ publicNote, officerNote }),
    });
  }, []);

  // Rank management
  const fetchRanks = useCallback(async (guildId) => {
    return api(`/api/guilds/${guildId}/ranks`);
  }, []);

  const createRank = useCallback(async (guildId, { name, permissions }) => {
    return api(`/api/guilds/${guildId}/ranks`, {
      method: 'POST',
      body: JSON.stringify({ name, permissions }),
    });
  }, []);

  const updateRank = useCallback(async (guildId, rankId, { name, permissions }) => {
    await api(`/api/guilds/${guildId}/ranks/${rankId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, permissions }),
    });
  }, []);

  const deleteRank = useCallback(async (guildId, rankId) => {
    return api(`/api/guilds/${guildId}/ranks/${rankId}`, { method: 'DELETE' });
  }, []);

  // MotD
  const getMotd = useCallback(async (guildId) => {
    const result = await api(`/api/guilds/${guildId}/motd`);
    return result.motd;
  }, []);

  const updateMotd = useCallback(async (guildId, motd) => {
    await api(`/api/guilds/${guildId}/motd`, {
      method: 'PUT',
      body: JSON.stringify({ motd }),
    });
  }, []);

  const updateMemberPermissions = useCallback(async (guildId, userId, overrides) => {
    await api(`/api/guilds/${guildId}/members/${userId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ overrides }),
    });
  }, []);

  return useMemo(() => ({
    publicGuilds,
    loading,
    fetchPublicGuilds,
    createGuild,
    joinGuild,
    joinByInviteCode,
    leaveGuild,
    updateGuild,
    disbandGuild,
    transferLeadership,
    getInviteCode,
    regenerateInvite,
    fetchMembers,
    changeMemberRank,
    kickMember,
    updateNote,
    fetchRanks,
    createRank,
    updateRank,
    deleteRank,
    getMotd,
    updateMotd,
    updateMemberPermissions,
  }), [
    publicGuilds,
    loading,
    fetchPublicGuilds,
    createGuild,
    joinGuild,
    joinByInviteCode,
    leaveGuild,
    updateGuild,
    disbandGuild,
    transferLeadership,
    getInviteCode,
    regenerateInvite,
    fetchMembers,
    changeMemberRank,
    kickMember,
    updateNote,
    fetchRanks,
    createRank,
    updateRank,
    deleteRank,
    getMotd,
    updateMotd,
    updateMemberPermissions,
  ]);
}
