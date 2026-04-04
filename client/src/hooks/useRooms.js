import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useSocket } from '../contexts/SocketContext';
import {
  BOARDS_DISABLED,
  createBoardsDisabledError,
} from '../features/messaging/boardAvailability.mjs';

export function useRooms(guildId) {
  const { socket } = useSocket();
  const [rooms, setRooms] = useState([]);
  const [myRooms, setMyRooms] = useState([]);

  const fetchRooms = useCallback(async () => {
    if (BOARDS_DISABLED) {
      setRooms([]);
      setMyRooms([]);
      return [];
    }

    try {
      const query = guildId ? `?guildId=${guildId}` : '';
      const [all, mine] = await Promise.all([
        api(`/api/rooms${query}`),
        api('/api/rooms/mine'),
      ]);
      setRooms(all);
      // Filter myRooms to current guild if scoped
      setMyRooms(guildId ? mine.filter(r => r.guild_id === guildId) : mine);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  }, [guildId]);

  useEffect(() => {
    if (BOARDS_DISABLED) {
      setRooms([]);
      setMyRooms([]);
      return;
    }
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    if (BOARDS_DISABLED || !socket) return;

    const onCreated = (room) => {
      // Only add rooms belonging to the current guild
      if (guildId && room.guild_id !== guildId) return;
      setRooms(prev => {
        if (prev.some(r => r.id === room.id)) return prev;
        return [...prev, room];
      });
      setMyRooms(prev => {
        if (prev.some(r => r.id === room.id)) return prev;
        return [...prev, room];
      });
    };

    const onRenamed = ({ roomId, name }) => {
      setRooms(prev => prev.map(r => r.id === roomId ? { ...r, name } : r));
      setMyRooms(prev => prev.map(r => r.id === roomId ? { ...r, name } : r));
    };

    const onDeleted = ({ roomId }) => {
      setRooms(prev => prev.filter(r => r.id !== roomId));
      setMyRooms(prev => prev.filter(r => r.id !== roomId));
    };

    socket.on('room:created', onCreated);
    socket.on('room:renamed', onRenamed);
    socket.on('room:deleted', onDeleted);
    return () => {
      socket.off('room:created', onCreated);
      socket.off('room:renamed', onRenamed);
      socket.off('room:deleted', onDeleted);
    };
  }, [socket, guildId]);

  const createRoom = useCallback(async (name) => {
    if (BOARDS_DISABLED) {
      throw createBoardsDisabledError();
    }
    const room = await api('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ name, guildId }),
    });
    setRooms(prev => prev.some(r => r.id === room.id) ? prev : [...prev, room]);
    setMyRooms(prev => prev.some(r => r.id === room.id) ? prev : [...prev, room]);
    if (socket) socket.emit('room:join', { roomId: room.id });
    return room;
  }, [socket, guildId]);

  const joinRoom = useCallback(async (roomId) => {
    if (BOARDS_DISABLED) {
      throw createBoardsDisabledError();
    }
    await api(`/api/rooms/${roomId}/join`, { method: 'POST' });
    if (socket) socket.emit('room:join', { roomId });
    await fetchRooms();
  }, [socket, fetchRooms]);

  const leaveRoom = useCallback(async (roomId) => {
    if (BOARDS_DISABLED) {
      throw createBoardsDisabledError();
    }
    await api(`/api/rooms/${roomId}/leave`, { method: 'POST' });
    if (socket) socket.emit('room:leave', { roomId });
    setMyRooms(prev => prev.filter(r => r.id !== roomId));
  }, [socket]);

  const renameRoom = useCallback(async (roomId, name) => {
    if (BOARDS_DISABLED) {
      throw createBoardsDisabledError();
    }
    await api(`/api/rooms/${roomId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }, []);

  const deleteRoom = useCallback(async (roomId) => {
    if (BOARDS_DISABLED) {
      throw createBoardsDisabledError();
    }
    await api(`/api/rooms/${roomId}`, { method: 'DELETE' });
  }, []);

  return {
    rooms: BOARDS_DISABLED ? [] : rooms,
    myRooms: BOARDS_DISABLED ? [] : myRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    renameRoom,
    deleteRoom,
    refreshRooms: fetchRooms,
  };
}
