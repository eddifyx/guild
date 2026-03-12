import { useOnlineUsers } from '../../hooks/useOnlineUsers';

export default function Header({ conversation, conversationName }) {
  const { onlineIds } = useOnlineUsers();

  const headerBase = {
    padding: '12px 20px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  };

  if (!conversation) return (
    <div style={{ ...headerBase, height: 'auto', minHeight: 52 }} />
  );

  const isOnline = conversation.type === 'dm' && onlineIds.has(conversation.id);

  return (
    <div style={{
      ...headerBase,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      height: 'auto',
      minHeight: 52,
    }}>
      {conversation.type === 'assets' ? (
        <>
          <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 8v13H3V3h12l6 5z" />
              <path d="M14 3v6h6" />
            </svg>
          </span>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
            Asset Dumping Grounds
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Files expire after 5 days
          </span>
        </>
      ) : conversation.type === 'room' ? (
        <>
          <span style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 500 }}>#</span>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
            {conversationName}
          </span>
        </>
      ) : (
        <>
          <span style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: isOnline ? 'var(--success)' : 'var(--text-muted)',
            boxShadow: isOnline ? '0 0 6px rgba(0, 214, 143, 0.4)' : 'none',
            flexShrink: 0,
          }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>{conversationName}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </>
      )}
    </div>
  );
}
