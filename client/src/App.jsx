import { useState, useCallback, Component } from 'react';
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
import GuildOnboardingScreen from './components/Guild/GuildOnboardingScreen';

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

  if (loading) return null;

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
  // Show intro for returning users (auth already in localStorage) and fresh logins
  const [showRain, setShowRain] = useState(() => !!localStorage.getItem('auth'));

  const handleLoginSuccess = useCallback(() => {
    setShowRain(true);
  }, []);

  const handleRainComplete = useCallback(() => {
    setShowRain(false);
  }, []);

  // No user yet - show login
  if (!user) return <LoginScreen onLoginSuccess={handleLoginSuccess} />;

  // User is set but transition is playing - show ONLY HashLock
  if (showRain) return <HashLock onComplete={handleRainComplete} />;

  if (securityState === 'booting') {
    return <SecureBlockedView mode="booting" onLogout={logout} />;
  }

  if (securityState === 'blocked') {
    return (
      <SecureBlockedView
        mode="blocked"
        error={cryptoError}
        onRetry={retryCryptoInitialization}
        onLogout={logout}
      />
    );
  }

  // Transition done - show guild gate (which shows selection or main app)
  return (
    <SocketProvider>
      <OnlineUsersProvider>
        <GuildProvider>
          <GuildGate />
        </GuildProvider>
      </OnlineUsersProvider>
    </SocketProvider>
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
