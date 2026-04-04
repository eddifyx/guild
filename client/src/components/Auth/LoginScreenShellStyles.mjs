export const styles = {
  page: (isCreateView) => ({
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: isCreateView ? 'flex-start' : 'center',
    background: 'radial-gradient(circle at 50% 40%, rgba(64, 255, 64, 0.03) 0%, #050705 70%)',
    position: 'relative',
    overflowX: 'hidden',
    overflowY: 'auto',
    padding: isCreateView ? '28px 24px 40px' : '24px',
    boxSizing: 'border-box',
    WebkitAppRegion: 'drag',
  }),
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 8,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    WebkitAppRegion: 'no-drag',
    transition: 'background 0.15s, color 0.15s',
  },
  card: (isCreateView) => ({
    background: '#080a08',
    padding: isCreateView ? '52px 40px 36px' : '48px 40px',
    borderRadius: 16,
    width: 'min(100%, 540px)',
    border: '1px solid rgba(64, 255, 64, 0.07)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 80px rgba(64, 255, 64, 0.03)',
    WebkitAppRegion: 'no-drag',
    animation: 'fadeIn 0.4s ease-out',
    position: 'relative',
    zIndex: 1,
    margin: isCreateView ? '18px 0' : '0',
    maxHeight: isCreateView ? 'calc(100vh - 68px)' : 'none',
    overflowY: isCreateView ? 'auto' : 'visible',
    boxSizing: 'border-box',
  }),
};

export const loginScreenKeyframesCss = `
  .login-input::placeholder {
    color: rgba(255, 255, 255, 0.3) !important;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
