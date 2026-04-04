import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGuild } from '../contexts/GuildContext';
import { useSocket } from '../contexts/SocketContext';
import { hasGuildPermission } from '../features/guild/capabilities';
import { presentMessagingNotification } from '../features/messaging/notificationPolicy';
import { readNotificationMutePreferences } from '../features/messaging/notificationPreferenceRuntime.mjs';
import { shouldRecordGuildChatMentionNotification } from '../features/messaging/guildChatState.mjs';
import {
  buildGuildChatMotdEntry,
  clearGuildChatUnreadMentions,
  createGuildChatMentionNotificationHandler,
  markGuildChatUnreadMention,
} from '../features/messaging/guildChatNotificationFlow.mjs';
import {
  createGuildChatRealtimeHandlers,
  registerGuildChatRealtimeSubscriptions,
} from '../features/messaging/guildChatRealtimeFlow.mjs';
import {
  createGuildChatSendAction,
  emitGuildChatTypingState,
  joinGuildChatSession,
} from '../features/messaging/guildChatTransportFlow.mjs';
import { isAppWindowForegrounded } from '../utils/systemNotifications';

const TYPING_TTL_MS = 3500;

export function useGuildChat({ visible = false } = {}) {
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const { currentGuild, currentGuildData } = useGuild();
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [lastError, setLastError] = useState('');
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [motdText, setMotdText] = useState('');
  const [unreadMentionCount, setUnreadMentionCount] = useState(0);
  const typingTimeoutsRef = useRef(new Map());
  const visibleRef = useRef(visible);
  const recentMentionNotificationIdsRef = useRef(new Map());
  const unreadMentionIdsRef = useRef(new Set());

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const myMember = useMemo(() => (
    currentGuildData?.members?.find((member) => member.id === user?.userId) || null
  ), [currentGuildData?.members, user?.userId]);
  const permissionsReady = !currentGuild || Array.isArray(currentGuildData?.members);
  const canListen = useMemo(() => (
    permissionsReady ? hasGuildPermission(myMember, 'guild_chat_listen', { optimisticIfMissing: true }) : true
  ), [permissionsReady, myMember]);
  const canSpeak = useMemo(() => (
    permissionsReady ? hasGuildPermission(myMember, 'guild_chat_speak', { optimisticIfMissing: true }) : true
  ), [permissionsReady, myMember]);

  const clearTypingTimeout = useCallback((userId) => {
    const timeoutId = typingTimeoutsRef.current.get(userId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      typingTimeoutsRef.current.delete(userId);
    }
  }, []);

  const clearAllTypingTimeouts = useCallback(() => {
    typingTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    typingTimeoutsRef.current.clear();
  }, []);

  const shouldNotifyMention = useCallback((message) => {
    const messageId = typeof message?.id === 'string' ? message.id : '';
    return shouldRecordGuildChatMentionNotification(
      recentMentionNotificationIdsRef.current,
      messageId,
      { now: Date.now() }
    );
  }, []);

  const resetSession = useCallback(() => {
    setMessages([]);
    setTypingUsers({});
    setLastError('');
    unreadMentionIdsRef.current.clear();
    setUnreadMentionCount(0);
    clearAllTypingTimeouts();
  }, [clearAllTypingTimeouts]);

  const clearUnreadMentions = useCallback(() => {
    setUnreadMentionCount(clearGuildChatUnreadMentions(unreadMentionIdsRef.current));
  }, []);

  const markUnreadMention = useCallback((message) => {
    setUnreadMentionCount(markGuildChatUnreadMention(unreadMentionIdsRef.current, message));
  }, []);

  const handleMentionNotification = useMemo(() => createGuildChatMentionNotificationHandler({
    currentGuild,
    currentUserId: user?.userId,
    isGuildChatVisible: () => visibleRef.current,
    shouldNotifyMention,
    markUnreadMention,
    getNotificationContext: ({ storage = null } = {}) => ({
      currentGuild,
      guildChatVisible: visibleRef.current,
      appForegrounded: isAppWindowForegrounded(),
      ...readNotificationMutePreferences(storage),
    }),
    presentNotification: presentMessagingNotification,
  }), [currentGuild, markUnreadMention, shouldNotifyMention, user?.userId]);

  useEffect(() => {
    setMotdText(currentGuildData?.motd || '');
  }, [currentGuildData?.motd, currentGuild]);

  useEffect(() => {
    if (!currentGuild) {
      resetSession();
      setSessionStartedAt(null);
      return;
    }
    resetSession();
    setSessionStartedAt(Date.now());
  }, [currentGuild, resetSession]);

  useEffect(() => {
    if (!connected || !currentGuild || sessionStartedAt) return;
    setSessionStartedAt(Date.now());
  }, [connected, currentGuild, sessionStartedAt]);

  useEffect(() => {
    if (!visible || !currentGuild || typeof document === 'undefined') return undefined;

    const clearIfForegrounded = () => {
      if (isAppWindowForegrounded()) {
        clearUnreadMentions();
      }
    };

    clearIfForegrounded();
    document.addEventListener('visibilitychange', clearIfForegrounded);
    window.addEventListener('focus', clearIfForegrounded);
    return () => {
      document.removeEventListener('visibilitychange', clearIfForegrounded);
      window.removeEventListener('focus', clearIfForegrounded);
    };
  }, [visible, currentGuild, clearUnreadMentions]);

  useEffect(() => {
    return joinGuildChatSession({
      socket,
      connected,
      currentGuild,
      canListen,
      setLastError,
    });
  }, [socket, connected, currentGuild, canListen]);

  useEffect(() => {
    if (!socket || !currentGuild) return undefined;
    const handlers = createGuildChatRealtimeHandlers({
      currentGuild,
      currentUserId: user?.userId,
      setMessages,
      setTypingUsers,
      setMotdText,
      clearTypingTimeout,
      typingTimeouts: typingTimeoutsRef.current,
      handleMentionNotification,
      typingTtlMs: TYPING_TTL_MS,
    });

    const unsubscribe = registerGuildChatRealtimeSubscriptions(socket, handlers);

    return () => {
      unsubscribe();
      clearAllTypingTimeouts();
      setTypingUsers({});
    };
  }, [socket, currentGuild, user?.userId, clearTypingTimeout, clearAllTypingTimeouts, handleMentionNotification]);

  const sendMessage = useMemo(() => createGuildChatSendAction({
    socket,
    connected,
    currentGuild,
    currentMembers: currentGuildData?.members,
    user,
    myMember,
    setLastError,
    setMessages,
  }), [
    socket,
    connected,
    currentGuild,
    currentGuildData?.members,
    user,
    myMember,
  ]);

  const emitTyping = useCallback((typing) => {
    emitGuildChatTypingState({
      socket,
      connected,
      currentGuild,
      typing,
    });
  }, [socket, connected, currentGuild]);

  const motdEntry = useMemo(() => {
    return buildGuildChatMotdEntry({
      motdText,
      sessionStartedAt,
      currentGuild,
    });
  }, [motdText, sessionStartedAt, currentGuild]);

  return {
    messages,
    typingUsers: Object.entries(typingUsers).map(([userId, username]) => ({ userId, username })),
    motdEntry,
    lastError,
    connected,
    canListen,
    canSpeak,
    hasUnreadMention: unreadMentionCount > 0,
    unreadMentionCount,
    clearUnreadMentions,
    sendMessage,
    emitTyping,
  };
}
