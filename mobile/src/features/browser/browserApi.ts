import {
  DmConversation,
  GuildDetail,
  GuildListEntry,
  Message,
  Room,
} from './browserTypes';

function normalizeBaseUrl(rawUrl: string) {
  return rawUrl.trim().replace(/\/+$/, '');
}

class BrowserApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function requestJson<T>(serverUrl: string, token: string, path: string) {
  const response = await fetch(`${normalizeBaseUrl(serverUrl)}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && typeof payload.error === 'string'
        ? payload.error
        : response.statusText || 'Request failed';
    throw new BrowserApiError(response.status, message);
  }

  return payload as T;
}

export function isUnauthorizedBrowserApiError(error: unknown) {
  return error instanceof BrowserApiError && error.status === 401;
}

export function fetchGuilds(serverUrl: string, token: string) {
  return requestJson<GuildListEntry[]>(serverUrl, token, '/api/guilds');
}

export function fetchGuildDetail(serverUrl: string, token: string, guildId: string) {
  return requestJson<GuildDetail>(serverUrl, token, `/api/guilds/${guildId}`);
}

export function fetchRooms(serverUrl: string, token: string, guildId: string) {
  return requestJson<Room[]>(serverUrl, token, `/api/rooms?guildId=${encodeURIComponent(guildId)}`);
}

export function fetchDmConversations(serverUrl: string, token: string) {
  return requestJson<DmConversation[]>(serverUrl, token, '/api/dm/conversations');
}

export function fetchRoomMessages(serverUrl: string, token: string, roomId: string) {
  return requestJson<Message[]>(serverUrl, token, `/api/messages/room/${encodeURIComponent(roomId)}`);
}

export function fetchDmMessages(serverUrl: string, token: string, otherUserId: string) {
  return requestJson<Message[]>(serverUrl, token, `/api/messages/dm/${encodeURIComponent(otherUserId)}`);
}
