import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';

import type { MobileSessionUser } from '../session/mobileSessionTypes';
import type {
  MobileConversation,
  MobileDmConversation,
  MobileGuildDetail,
  MobileGuildSummary,
  MobileMessage,
  MobileRoom,
} from './mobileWorkspaceTypes';
import {
  fetchDmConversations,
  fetchDmMessages,
  fetchGuildDetail,
  fetchGuildMembers,
  fetchGuilds,
  fetchPublicGuilds,
  fetchRoomMessages,
  fetchRooms,
  joinGuild,
  joinGuildByInvite,
} from './mobileWorkspaceApi';

function dedupeMessages(messages: MobileMessage[]) {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (!message?.id || seen.has(message.id)) {
      return false;
    }
    seen.add(message.id);
    return true;
  }).sort((left, right) => {
    const leftTime = left.created_at ? Date.parse(left.created_at) : 0;
    const rightTime = right.created_at ? Date.parse(right.created_at) : 0;
    return leftTime - rightTime;
  });
}

function matchesConversation(message: MobileMessage, conversation: MobileConversation) {
  if (conversation.type === 'room') {
    return message.room_id === conversation.id;
  }

  return message.dm_partner_id === conversation.id || message.sender_id === conversation.id;
}

export function useMobileWorkspace({
  session,
  socket,
}: {
  session: MobileSessionUser | null;
  socket: Socket | null;
}) {
  const [guilds, setGuilds] = useState<MobileGuildSummary[]>([]);
  const [publicGuilds, setPublicGuilds] = useState<MobileGuildSummary[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<MobileConversation | null>(null);
  const [guildDetail, setGuildDetail] = useState<MobileGuildDetail | null>(null);
  const [rooms, setRooms] = useState<MobileRoom[]>([]);
  const [dmConversations, setDmConversations] = useState<MobileDmConversation[]>([]);
  const [messages, setMessages] = useState<MobileMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState('');
  const joinedRoomIdRef = useRef<string | null>(null);

  const refreshGuilds = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError('');

    try {
      const nextGuilds = await fetchGuilds(session);
      setGuilds(nextGuilds);

      if (nextGuilds.length === 0) {
        setSelectedGuildId(null);
        setGuildDetail(null);
        setRooms([]);
        setDmConversations([]);
        setMessages([]);
        setSelectedConversation(null);
        setPublicGuilds(await fetchPublicGuilds(session));
      } else {
        setPublicGuilds([]);
        setSelectedGuildId((current) => (
          current && nextGuilds.some((guild) => guild.id === current)
            ? current
            : nextGuilds[0]?.id || null
        ));
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  }, [session]);

  const refreshGuildView = useCallback(async () => {
    if (!session || !selectedGuildId) return;

    setLoading(true);
    setError('');

    try {
      const [detail, members, nextRooms, nextDms] = await Promise.all([
        fetchGuildDetail(session, selectedGuildId),
        fetchGuildMembers(session, selectedGuildId),
        fetchRooms(session, selectedGuildId),
        fetchDmConversations(session),
      ]);

      setGuildDetail({ ...detail, members });
      setRooms(nextRooms);
      setDmConversations(nextDms);

      setSelectedConversation((current) => {
        if (current?.type === 'room' && nextRooms.some((room) => room.id === current.id)) {
          return current;
        }
        if (current?.type === 'dm' && nextDms.some((dm) => dm.other_user_id === current.id)) {
          return current;
        }
        return nextRooms[0]
          ? { id: nextRooms[0].id, type: 'room', title: nextRooms[0].name }
          : nextDms[0]
            ? { id: nextDms[0].other_user_id, type: 'dm', title: nextDms[0].other_username || 'Direct message' }
            : null;
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  }, [selectedGuildId, session]);

  const refreshMessages = useCallback(async () => {
    if (!session || !selectedConversation) {
      setMessages([]);
      return;
    }

    setMessagesLoading(true);
    setError('');
    try {
      const nextMessages = selectedConversation.type === 'room'
        ? await fetchRoomMessages(session, selectedConversation.id)
        : await fetchDmMessages(session, selectedConversation.id);
      setMessages(dedupeMessages(nextMessages));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setMessagesLoading(false);
    }
  }, [selectedConversation, session]);

  useEffect(() => {
    if (!session) {
      setGuilds([]);
      setPublicGuilds([]);
      setSelectedGuildId(null);
      setSelectedConversation(null);
      setGuildDetail(null);
      setRooms([]);
      setDmConversations([]);
      setMessages([]);
      setError('');
      return;
    }

    void refreshGuilds();
  }, [refreshGuilds, session]);

  useEffect(() => {
    void refreshGuildView();
  }, [refreshGuildView]);

  useEffect(() => {
    void refreshMessages();
  }, [refreshMessages]);

  useEffect(() => {
    if (!socket || !selectedConversation) return;

    const previousRoomId = joinedRoomIdRef.current;
    if (selectedConversation.type === 'room' && selectedConversation.id !== previousRoomId) {
      if (previousRoomId) {
        socket.emit('room:leave', { roomId: previousRoomId });
      }
      joinedRoomIdRef.current = selectedConversation.id;
      socket.emit('room:join', { roomId: selectedConversation.id });
    }

    if (selectedConversation.type !== 'room' && previousRoomId) {
      socket.emit('room:leave', { roomId: previousRoomId });
      joinedRoomIdRef.current = null;
    }

    return () => {
      if (joinedRoomIdRef.current && selectedConversation.type !== 'room') {
        socket.emit('room:leave', { roomId: joinedRoomIdRef.current });
        joinedRoomIdRef.current = null;
      }
    };
  }, [selectedConversation, socket]);

  useEffect(() => {
    if (!socket) return;

    const handleIncomingMessage = (incoming: MobileMessage) => {
      setMessages((current) => {
        if (!selectedConversation || !matchesConversation(incoming, selectedConversation)) {
          return current;
        }
        return dedupeMessages([...current, incoming]);
      });
      void refreshGuildView();
    };

    const refreshGuildOnly = () => {
      void refreshGuildView();
    };

    socket.on('room:message', handleIncomingMessage);
    socket.on('dm:message', handleIncomingMessage);
    socket.on('room:created', refreshGuildOnly);
    socket.on('room:renamed', refreshGuildOnly);
    socket.on('room:deleted', refreshGuildOnly);
    socket.on('guild:updated', refreshGuildOnly);
    socket.on('guild:member_joined', refreshGuildOnly);
    socket.on('guild:member_left', refreshGuildOnly);

    return () => {
      socket.off('room:message', handleIncomingMessage);
      socket.off('dm:message', handleIncomingMessage);
      socket.off('room:created', refreshGuildOnly);
      socket.off('room:renamed', refreshGuildOnly);
      socket.off('room:deleted', refreshGuildOnly);
      socket.off('guild:updated', refreshGuildOnly);
      socket.off('guild:member_joined', refreshGuildOnly);
      socket.off('guild:member_left', refreshGuildOnly);
    };
  }, [refreshGuildView, selectedConversation, socket]);

  const joinPublicGuild = useCallback(async (guildId: string) => {
    if (!session) return false;
    setLoading(true);
    setError('');

    try {
      await joinGuild(session, guildId);
      await refreshGuilds();
      return true;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      return false;
    } finally {
      setLoading(false);
    }
  }, [refreshGuilds, session]);

  const joinViaInviteCode = useCallback(async (inviteCode: string) => {
    if (!session) return false;
    const normalizedInviteCode = inviteCode.trim();
    if (!normalizedInviteCode) {
      setError('Add an invite code before joining.');
      return false;
    }
    setLoading(true);
    setError('');

    try {
      await joinGuildByInvite(session, normalizedInviteCode);
      await refreshGuilds();
      return true;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      return false;
    } finally {
      setLoading(false);
    }
  }, [refreshGuilds, session]);

  return useMemo(() => ({
    guilds,
    publicGuilds,
    selectedGuildId,
    setSelectedGuildId,
    selectedConversation,
    setSelectedConversation,
    guildDetail,
    rooms,
    dmConversations,
    messages,
    loading,
    messagesLoading,
    error,
    refreshGuilds,
    refreshGuildView,
    refreshMessages,
    joinPublicGuild,
    joinViaInviteCode,
  }), [
    dmConversations,
    error,
    guildDetail,
    guilds,
    joinPublicGuild,
    joinViaInviteCode,
    loading,
    messages,
    messagesLoading,
    publicGuilds,
    refreshGuildView,
    refreshGuilds,
    refreshMessages,
    rooms,
    selectedConversation,
    selectedGuildId,
  ]);
}
