import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { api } from '../api';
import { useSocket } from './SocketContext';
import { rememberUsers } from '../crypto/identityDirectory.js';

const GuildContext = createContext(null);

export function GuildProvider({ children }) {
  const { socket, connected } = useSocket();
  const [myGuild, setMyGuild] = useState(null); // The single guild object (or null)
  const [currentGuildData, setCurrentGuildData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Derived: guild ID for backward compat with all components
  const currentGuild = myGuild?.id || null;

  const fetchGuildDetails = useCallback(async (guildId) => {
    try {
      const [data, members] = await Promise.all([
        api(`/api/guilds/${guildId}`),
        api(`/api/guilds/${guildId}/members`),
      ]);
      const next = { ...data, members };
      rememberUsers(members);
      setCurrentGuildData(next);
      return next;
    } catch (err) {
      console.error('Failed to fetch guild details:', err);
      return null;
    }
  }, []);

  const fetchMyGuild = useCallback(async () => {
    try {
      const data = await api('/api/guilds');
      const guild = data.length > 0 ? data[0] : null;
      setMyGuild(guild);
      if (guild) {
        await fetchGuildDetails(guild.id);
      }
      return guild;
    } catch (err) {
      console.error('Failed to fetch guild:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchGuildDetails]);

  // Clear guild state (used after disband/kick/leave)
  const clearGuild = useCallback(() => {
    setMyGuild(null);
    setCurrentGuildData(null);
  }, []);

  // Fetch guild on mount and auto-enter
  useEffect(() => {
    fetchMyGuild();
  }, [fetchMyGuild]);

  // Fresh profiles can occasionally land on onboarding before their guild
  // membership hydrates. Once the socket is up, retry the guild bootstrap if
  // we still look guild-less.
  useEffect(() => {
    if (!connected || loading || currentGuild) return;
    fetchMyGuild();
  }, [connected, loading, currentGuild, fetchMyGuild]);

  // Listen for guild socket events
  useEffect(() => {
    if (!socket) return;

    const onDisbanded = ({ guildId }) => {
      if (currentGuild === guildId) {
        clearGuild();
      }
    };

    const onKicked = ({ guildId }) => {
      if (currentGuild === guildId) {
        clearGuild();
      }
    };

    const onMemberJoined = ({ guildId }) => {
      if (currentGuild === guildId) fetchGuildDetails(guildId);
    };

    const onMemberLeft = ({ guildId }) => {
      if (currentGuild === guildId) fetchGuildDetails(guildId);
    };

    const onGuildUpdated = ({ guildId }) => {
      if (currentGuild === guildId) fetchGuildDetails(guildId);
    };

    socket.on('guild:disbanded', onDisbanded);
    socket.on('guild:member_kicked', onKicked);
    socket.on('guild:member_joined', onMemberJoined);
    socket.on('guild:member_left', onMemberLeft);
    socket.on('guild:updated', onGuildUpdated);
    return () => {
      socket.off('guild:disbanded', onDisbanded);
      socket.off('guild:member_kicked', onKicked);
      socket.off('guild:member_joined', onMemberJoined);
      socket.off('guild:member_left', onMemberLeft);
      socket.off('guild:updated', onGuildUpdated);
    };
  }, [socket, currentGuild, fetchGuildDetails, clearGuild]);

  // Apply guild theme when currentGuildData changes
  useEffect(() => {
    if (currentGuildData) {
      document.documentElement.style.setProperty('--accent', currentGuildData.accent_color || '#40FF40');
      document.documentElement.style.setProperty('--bg-primary', currentGuildData.bg_color || '#080a08');
    } else {
      // Reset to defaults
      document.documentElement.style.setProperty('--accent', '#40FF40');
      document.documentElement.style.setProperty('--bg-primary', '#080a08');
    }
  }, [currentGuildData]);

  const value = useMemo(() => ({
    myGuild,
    currentGuild,
    currentGuildData,
    loading,
    clearGuild,
    fetchMyGuild,
    fetchGuildDetails,
  }), [
    myGuild,
    currentGuild,
    currentGuildData,
    loading,
    clearGuild,
    fetchMyGuild,
    fetchGuildDetails,
  ]);

  return (
    <GuildContext.Provider value={value}>
      {children}
    </GuildContext.Provider>
  );
}

export function useGuild() {
  const ctx = useContext(GuildContext);
  if (!ctx) throw new Error('useGuild must be inside GuildProvider');
  return ctx;
}
