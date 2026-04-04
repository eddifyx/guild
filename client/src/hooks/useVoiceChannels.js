import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../api';
import { rememberUsers } from '../crypto/identityDirectory.js';

export function useVoiceChannels(guildId) {
  const { socket } = useSocket();
  const [voiceChannels, setVoiceChannels] = useState([]);
  const voiceChannelsRef = useRef([]);

  const setVoiceChannelsState = useCallback((nextValue) => {
    setVoiceChannels((prev) => {
      const next = typeof nextValue === 'function' ? nextValue(prev) : nextValue;
      voiceChannelsRef.current = next;
      return next;
    });
  }, []);

  const refreshVoiceChannels = useCallback(async () => {
    if (!guildId) {
      setVoiceChannelsState([]);
      return [];
    }

    const data = await api(`/api/voice/channels?guildId=${guildId}`);
    rememberUsers(data.flatMap(ch => ch.participants || []));
    setVoiceChannelsState(data);
    return data;
  }, [guildId, setVoiceChannelsState]);

  useEffect(() => {
    let cancelled = false;

    refreshVoiceChannels()
      .then((data) => {
        if (cancelled) return;
        setVoiceChannelsState(data);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshVoiceChannels, setVoiceChannelsState]);

  useEffect(() => {
    if (!socket) return;

    const handleUpdate = ({ channelId, participants }) => {
      rememberUsers(participants || []);
      if (!voiceChannelsRef.current.some(ch => ch.id === channelId)) {
        refreshVoiceChannels().catch(console.error);
        return;
      }

      setVoiceChannelsState(prev => prev.map(ch => (
        ch.id === channelId
          ? { ...ch, participants: Array.isArray(participants) ? participants : [] }
          : ch
      )));
    };

    const handleCreated = (channel) => {
      rememberUsers(channel.participants || []);
      if (guildId && channel.guild_id === guildId) {
        refreshVoiceChannels().catch(console.error);
      }
    };

    const handleDeleted = ({ channelId }) => {
      setVoiceChannelsState(prev => prev.filter(ch => ch.id !== channelId));
    };

    const handleRenamed = ({ channelId, name }) => {
      setVoiceChannelsState(prev => prev.map(ch => (
        ch.id === channelId
          ? { ...ch, name }
          : ch
      )));
    };

    socket.on('voice:channel-update', handleUpdate);
    socket.on('voice:channel-created', handleCreated);
    socket.on('voice:channel-deleted', handleDeleted);
    socket.on('voice:channel-renamed', handleRenamed);
    return () => {
      socket.off('voice:channel-update', handleUpdate);
      socket.off('voice:channel-created', handleCreated);
      socket.off('voice:channel-deleted', handleDeleted);
      socket.off('voice:channel-renamed', handleRenamed);
    };
  }, [socket, guildId, refreshVoiceChannels, setVoiceChannelsState]);

  useEffect(() => {
    if (!socket || !guildId) return;

    const handleConnect = () => {
      refreshVoiceChannels().catch(console.error);
    };

    socket.on('connect', handleConnect);
    return () => {
      socket.off('connect', handleConnect);
    };
  }, [socket, guildId, refreshVoiceChannels]);

  const createVoiceChannel = useCallback(async (name) => {
    const channel = await api('/api/voice/channels', {
      method: 'POST',
      body: JSON.stringify({ name, guildId }),
    });
    await refreshVoiceChannels().catch(console.error);
    return channel;
  }, [guildId, refreshVoiceChannels]);

  const deleteVoiceChannel = useCallback(async (id) => {
    await api(`/api/voice/channels/${id}`, { method: 'DELETE' });
    setVoiceChannelsState(prev => prev.filter(ch => ch.id !== id));
  }, [setVoiceChannelsState]);

  const renameVoiceChannel = useCallback(async (id, name) => {
    const updated = await api(`/api/voice/channels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
    setVoiceChannelsState(prev => prev.map(ch => (
      ch.id === id
        ? { ...ch, name: updated.name }
        : ch
    )));
    return updated;
  }, [setVoiceChannelsState]);

  return { voiceChannels, createVoiceChannel, renameVoiceChannel, deleteVoiceChannel };
}
