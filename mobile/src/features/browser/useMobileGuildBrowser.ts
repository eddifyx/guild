import { useCallback, useEffect, useState } from 'react';

import {
  DmConversation,
  GuildDetail,
  GuildListEntry,
  Message,
  Room,
} from './browserTypes';
import {
  fetchDmConversations,
  fetchDmMessages,
  fetchGuildDetail,
  fetchGuilds,
  fetchRoomMessages,
  fetchRooms,
  isUnauthorizedBrowserApiError,
} from './browserApi';

type SelectedThread =
  | { kind: 'room'; id: string }
  | { kind: 'dm'; id: string }
  | null;

export function useMobileGuildBrowser({
  serverUrl,
  token,
  enabled,
  onUnauthorized = () => {},
}: {
  serverUrl: string;
  token: string | null;
  enabled: boolean;
  onUnauthorized?: () => void;
}) {
  const [guilds, setGuilds] = useState<GuildListEntry[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);
  const [guildDetail, setGuildDetail] = useState<GuildDetail | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dmConversations, setDmConversations] = useState<DmConversation[]>([]);
  const [selectedThread, setSelectedThread] = useState<SelectedThread>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const run = useCallback(async <T,>(key: string, action: () => Promise<T>) => {
    setLoadingKey(key);
    setError('');
    try {
      return await action();
    } catch (err) {
      if (isUnauthorizedBrowserApiError(err)) {
        onUnauthorized();
      }
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setLoadingKey(null);
    }
  }, [onUnauthorized]);

  const refreshOverview = useCallback(async () => {
    if (!enabled || !token) {
      setGuilds([]);
      setGuildDetail(null);
      setRooms([]);
      setDmConversations([]);
      setMessages([]);
      setSelectedThread(null);
      return;
    }

    const [guildList, dmList] = await Promise.all([
      run('overview:guilds', () => fetchGuilds(serverUrl, token)),
      run('overview:dms', () => fetchDmConversations(serverUrl, token)),
    ]);

    if (guildList) {
      setGuilds(guildList);
      setSelectedGuildId((current) => {
        if (current && guildList.some((guild) => guild.id === current)) {
          return current;
        }
        return guildList[0]?.id || null;
      });
    } else {
      setGuilds([]);
      setSelectedGuildId(null);
      setSelectedThread(null);
    }

    if (dmList) {
      setDmConversations(dmList);
    } else {
      setDmConversations([]);
    }
  }, [enabled, run, serverUrl, token]);

  useEffect(() => {
    void refreshOverview();
  }, [refreshOverview]);

  useEffect(() => {
    if (!enabled || !token || !selectedGuildId) {
      setGuildDetail(null);
      setRooms([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const [detail, roomList] = await Promise.all([
        run('guild:detail', () => fetchGuildDetail(serverUrl, token, selectedGuildId)),
        run('guild:rooms', () => fetchRooms(serverUrl, token, selectedGuildId)),
      ]);

      if (cancelled) {
        return;
      }
      if (detail) {
        setGuildDetail(detail);
      }
      if (roomList) {
        setRooms(roomList);
        setSelectedThread((current) => {
          if (current?.kind === 'dm') {
            return current;
          }
          if (current?.kind === 'room' && roomList.some((room) => room.id === current.id)) {
            return current;
          }
          return roomList[0] ? { kind: 'room', id: roomList[0].id } : null;
        });
      } else {
        setRooms([]);
        setSelectedThread((current) => (current?.kind === 'room' ? null : current));
      }
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [enabled, run, selectedGuildId, serverUrl, token]);

  useEffect(() => {
    if (!enabled || !token || !selectedThread) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const nextMessages = selectedThread.kind === 'room'
        ? await run('messages:room', () => fetchRoomMessages(serverUrl, token, selectedThread.id))
        : await run('messages:dm', () => fetchDmMessages(serverUrl, token, selectedThread.id));

      if (cancelled) {
        return;
      }

      if (nextMessages) {
        setMessages(nextMessages);
      } else {
        setMessages([]);
      }
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [enabled, run, selectedThread, serverUrl, token]);

  const selectGuild = useCallback((guildId: string) => {
    setSelectedGuildId(guildId);
  }, []);

  const selectRoom = useCallback((roomId: string) => {
    setSelectedThread({ kind: 'room', id: roomId });
  }, []);

  const selectDm = useCallback((otherUserId: string) => {
    setSelectedThread({ kind: 'dm', id: otherUserId });
  }, []);

  const refreshMessages = useCallback(async () => {
    if (!enabled || !token || !selectedThread) {
      return;
    }

    const nextMessages = selectedThread.kind === 'room'
      ? await run('messages:room', () => fetchRoomMessages(serverUrl, token, selectedThread.id))
      : await run('messages:dm', () => fetchDmMessages(serverUrl, token, selectedThread.id));

    if (nextMessages) {
      setMessages(nextMessages);
    }
  }, [enabled, run, selectedThread, serverUrl, token]);

  return {
    guilds,
    selectedGuildId,
    guildDetail,
    rooms,
    dmConversations,
    selectedThread,
    messages,
    loadingKey,
    error,
    selectGuild,
    selectRoom,
    selectDm,
    refreshOverview,
    refreshMessages,
  };
}
