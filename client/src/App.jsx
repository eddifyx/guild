import React, { useState, useCallback, useEffect, useRef, Component } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SecurityProvider, useSecurity } from './contexts/SecurityContext';
import { SocketProvider } from './contexts/SocketContext';
import { VoiceProvider } from './contexts/VoiceContext';
import { GuildProvider, useGuild } from './contexts/GuildContext';
import { OnlineUsersProvider } from './contexts/OnlineUsersContext';
import LoginScreen from './components/Auth/LoginScreen';
import MainLayout from './components/Layout/MainLayout';
import HashLock from './components/Auth/HashLock';
import SecureBlockedView from './components/Common/SecureBlockedView';
import ConfirmModal from './components/Common/ConfirmModal';
import GuildOnboardingScreen from './components/Guild/GuildOnboardingScreen';
import { hasRecoverableStoredAuthSync } from './utils/authStorage';
import { confirmLogout } from './utils/confirmLogout';
import { SECURITY_STATE } from './features/auth/secureStartupState.mjs';

function isLocalElectronDevRenderer() {
  if (typeof window === 'undefined' || !window.electronAPI) return false;
  const hostname = window.location?.hostname || '';
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function shouldPlayRecoverableTransition() {
  // Local Electron dev clients are our QA surface; skip the intro there so
  // relaunches do not look like a dead black window during testing.
  return !isLocalElectronDevRenderer();
}

function AppBootSplash({ title, message }) {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 30%, rgba(64, 255, 64, 0.03) 0%, #050705 72%)',
      padding: 24,
      color: '#d7e6d7',
    }}>
      <div style={{
        width: 420,
        maxWidth: '100%',
        background: '#080a08',
        border: '1px solid rgba(64, 255, 64, 0.08)',
        borderRadius: 16,
        padding: '28px 24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
      }}>
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#40FF40',
          marginBottom: 10,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: 'rgba(224, 232, 224, 0.74)',
        }}>
          {message}
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#ff4757', background: '#050705', height: '100%', fontFamily: 'monospace' }}>
          <h2 style={{ marginBottom: 16 }}>Render Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#e8e8e8' }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#787878', marginTop: 8, fontSize: 12 }}>{this.state.error.stack}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 20, padding: '8px 16px', background: '#40FF40', color: '#050705', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function GuildGate() {
  const { currentGuild, loading } = useGuild();

  if (loading) {
    return <AppBootSplash title="Loading /guild" message="Restoring your guild state and reconnecting the local test client." />;
  }

  // No guild - show onboarding screen
  if (!currentGuild) return <GuildOnboardingScreen />;

  // Guild selected - show main app scoped to this guild
  return (
    <ErrorBoundary>
      <VoiceProvider>
        <MainLayout />
      </VoiceProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const { user, logout } = useAuth();
  const { securityState, cryptoError, retryCryptoInitialization } = useSecurity();
  // Show intro for returning users with recoverable auth and fresh logins.
  const [showRain, setShowRain] = useState(() => shouldPlayRecoverableTransition() && hasRecoverableStoredAuthSync());
  const previousUserRef = useRef(user);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const logoutConfirmResolverRef = useRef(null);

  const handleLoginSuccess = useCallback(() => {
    setShowRain(shouldPlayRecoverableTransition());
  }, []);

  const handleRainComplete = useCallback(() => {
    setShowRain(false);
  }, []);

  useEffect(() => {
    const hadUser = Boolean(previousUserRef.current);
    const hasUser = Boolean(user);
    if (!hadUser && hasUser && !showRain && shouldPlayRecoverableTransition()) {
      setShowRain(true);
    }
    previousUserRef.current = user;
  }, [user, showRain]);

  const handleConfirmedLogout = useCallback(() => {
    void confirmLogout(logout);
  }, [logout]);

  useEffect(() => {
    const handleLogoutConfirmRequest = (event) => {
      logoutConfirmResolverRef.current = typeof event?.detail?.resolve === 'function'
        ? event.detail.resolve
        : null;
      setLogoutConfirmOpen(true);
    };

    window.addEventListener('guild:confirm-logout', handleLogoutConfirmRequest);
    return () => {
      window.removeEventListener('guild:confirm-logout', handleLogoutConfirmRequest);
    };
  }, []);

  const resolveLogoutConfirm = useCallback((confirmed) => {
    const resolver = logoutConfirmResolverRef.current;
    logoutConfirmResolverRef.current = null;
    setLogoutConfirmOpen(false);
    resolver?.(confirmed);
  }, []);

  // No user yet - show login
  if (!user) return <LoginScreen onLoginSuccess={handleLoginSuccess} />;

  // User is set but transition is playing - show ONLY HashLock
  if (showRain) return <HashLock onComplete={handleRainComplete} />;

  if (securityState === SECURITY_STATE.BOOTING) {
    return (
      <>
        <SecureBlockedView mode="booting" onLogout={handleConfirmedLogout} />
        <ConfirmModal
          open={logoutConfirmOpen}
          title="Log Out of /guild?"
          message="Your secure session will close on this device. You'll need to sign in again the next time you open the app."
          confirmLabel="Log Out"
          onConfirm={() => resolveLogoutConfirm(true)}
          onCancel={() => resolveLogoutConfirm(false)}
        />
      </>
    );
  }

  if (securityState === SECURITY_STATE.BLOCKED) {
    return (
      <>
        <SecureBlockedView
          mode="blocked"
          error={cryptoError}
          onRetry={retryCryptoInitialization}
          onLogout={handleConfirmedLogout}
        />
        <ConfirmModal
          open={logoutConfirmOpen}
          title="Log Out of /guild?"
          message="Your secure session will close on this device. You'll need to sign in again the next time you open the app."
          confirmLabel="Log Out"
          onConfirm={() => resolveLogoutConfirm(true)}
          onCancel={() => resolveLogoutConfirm(false)}
        />
      </>
    );
  }

  // Transition done - show guild gate (which shows selection or main app)
  return (
    <>
      <SocketProvider>
        <OnlineUsersProvider>
          <GuildProvider>
            <GuildGate />
          </GuildProvider>
        </OnlineUsersProvider>
      </SocketProvider>
      <ConfirmModal
        open={logoutConfirmOpen}
        title="Log Out of /guild?"
        message="Your secure session will close on this device. You'll need to sign in again the next time you open the app."
        confirmLabel="Log Out"
        onConfirm={() => resolveLogoutConfirm(true)}
        onCancel={() => resolveLogoutConfirm(false)}
      />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SecurityProvider>
        <AppContent />
      </SecurityProvider>
    </AuthProvider>
  );
}
