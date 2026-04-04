import React, { useState, useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';

export default function TypingIndicator({ conversation }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState({});

  useEffect(() => {
    if (!socket || !conversation) return;

    const onStart = ({ userId, username, roomId, toUserId }) => {
      if (userId === user.userId) return;
      const matches =
        (conversation.type === 'room' && roomId === conversation.id) ||
        (conversation.type === 'dm' && userId === conversation.id);
      if (matches) {
        setTypingUsers(prev => ({ ...prev, [userId]: username }));
      }
    };

    const onStop = ({ userId }) => {
      setTypingUsers(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    socket.on('typing:start', onStart);
    socket.on('typing:stop', onStop);

    return () => {
      socket.off('typing:start', onStart);
      socket.off('typing:stop', onStop);
      setTypingUsers({});
    };
  }, [socket, conversation, user]);

  const names = Object.values(typingUsers);
  if (!names.length) return null;

  const text = names.length === 1
    ? `${names[0]} is typing`
    : `${names.join(', ')} are typing`;

  return (
    <div style={{
      position: 'absolute',
      top: -20,
      left: 0,
      right: 0,
      padding: '2px 16px',
      fontSize: 11,
      color: 'var(--text-muted)',
      fontStyle: 'italic',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      pointerEvents: 'none',
    }}>
      <span>{text}</span>
      <span className="typing-dots">
        <span>.</span><span>.</span><span>.</span>
      </span>
      <style>{`
        .typing-dots span {
          animation: blink 1.4s infinite both;
        }
        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
    </div>
  );
}
