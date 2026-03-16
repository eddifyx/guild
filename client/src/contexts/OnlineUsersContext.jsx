import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useSocket } from './SocketContext';
import { rememberUsers } from '../crypto/identityDirectory.js';

const AUTH_USER_UPDATED_EVENT = 'guild:auth-user-updated';
const OnlineUsersContext = createContext(null);

export function OnlineUsersProvider({ children }) {
  const { socket } = useSocket();
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!socket) {
      setOnlineUsers([]);
      return;
    }

    const handlePresenceUpdate = ({ onlineUsers: list }) => {
      const nextUsers = Array.isArray(list) ? list : [];
      rememberUsers(nextUsers);
      setOnlineUsers(nextUsers);
    };

    const requestPresence = () => {
      socket.emit('presence:request');
    };

    socket.on('presence:update', handlePresenceUpdate);
    socket.on('connect', requestPresence);

    if (socket.connected) requestPresence();

    return () => {
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('connect', requestPresence);
    };
  }, [socket]);

  useEffect(() => {
    const handleAuthUserUpdated = (event) => {
      const nextUser = event?.detail;
      if (!nextUser?.userId) return;

      setOnlineUsers((current) => current.map((entry) => (
        entry.userId === nextUser.userId
          ? {
            ...entry,
            username: nextUser.username || entry.username,
            avatarColor: nextUser.avatarColor || entry.avatarColor,
            npub: nextUser.npub || entry.npub,
            profilePicture: nextUser.profilePicture ?? entry.profilePicture,
          }
          : entry
      )));
    };

    window.addEventListener(AUTH_USER_UPDATED_EVENT, handleAuthUserUpdated);
    return () => window.removeEventListener(AUTH_USER_UPDATED_EVENT, handleAuthUserUpdated);
  }, []);

  const onlineIds = useMemo(() => new Set(onlineUsers.map((user) => user.userId)), [onlineUsers]);
  const value = useMemo(() => ({ onlineUsers, onlineIds }), [onlineUsers, onlineIds]);

  return (
    <OnlineUsersContext.Provider value={value}>
      {children}
    </OnlineUsersContext.Provider>
  );
}

export function useOnlineUsersContext() {
  const context = useContext(OnlineUsersContext);
  if (!context) {
    throw new Error('useOnlineUsers must be used within OnlineUsersProvider');
  }
  return context;
}
