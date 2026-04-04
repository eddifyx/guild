import type { MobileSessionUser } from '../session/mobileSessionTypes';
import type {
  MobileDmConversation,
  MobileGuildDetail,
  MobileGuildMember,
  MobileGuildSummary,
  MobileMessage,
  MobileRoom,
} from './mobileWorkspaceTypes';

function buildHeaders(session: MobileSessionUser) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.token}`,
  };
}

async function requestJson<T>(session: MobileSessionUser, path: string, options?: RequestInit) {
  const response = await fetch(`${session.serverUrl}${path}`, {
    headers: {
      ...buildHeaders(session),
      ...(options?.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : response.statusText || 'Request failed';
    throw new Error(message);
  }

  return payload as T;
}

export function fetchGuilds(session: MobileSessionUser) {
  return requestJson<MobileGuildSummary[]>(session, '/api/guilds');
}

export function fetchPublicGuilds(session: MobileSessionUser) {
  return requestJson<MobileGuildSummary[]>(session, '/api/guilds/public');
}

export function fetchGuildDetail(session: MobileSessionUser, guildId: string) {
  return requestJson<MobileGuildDetail>(session, `/api/guilds/${guildId}`);
}

export function fetchGuildMembers(session: MobileSessionUser, guildId: string) {
  return requestJson<MobileGuildMember[]>(session, `/api/guilds/${guildId}/members`);
}

export function joinGuild(session: MobileSessionUser, guildId: string) {
  return requestJson<{ success: boolean }>(session, `/api/guilds/${guildId}/join`, {
    method: 'POST',
  });
}

export function joinGuildByInvite(session: MobileSessionUser, inviteCode: string) {
  return requestJson<unknown>(session, `/api/guilds/join/${inviteCode}`, {
    method: 'POST',
  });
}

export function fetchRooms(session: MobileSessionUser, guildId: string) {
  return requestJson<MobileRoom[]>(session, `/api/rooms?guildId=${encodeURIComponent(guildId)}`);
}

export function fetchDmConversations(session: MobileSessionUser) {
  return requestJson<MobileDmConversation[]>(session, '/api/dm/conversations');
}

export function fetchRoomMessages(session: MobileSessionUser, roomId: string) {
  return requestJson<MobileMessage[]>(session, `/api/messages/room/${roomId}`);
}

export function fetchDmMessages(session: MobileSessionUser, otherUserId: string) {
  return requestJson<MobileMessage[]>(session, `/api/messages/dm/${otherUserId}`);
}
