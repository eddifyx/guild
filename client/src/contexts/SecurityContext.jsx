import { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';

const SecurityContext = createContext(null);

export function SecurityProvider({ children }) {
  const { user, cryptoStatus, cryptoError, retryCryptoInitialization } = useAuth();

  const securityState = !user
    ? 'signed_out'
    : cryptoStatus === 'ready'
      ? 'crypto_ready'
      : cryptoStatus === 'blocked'
        ? 'blocked'
        : 'booting';

  const value = useMemo(() => ({
    securityState,
    cryptoError,
    retryCryptoInitialization,
  }), [securityState, cryptoError, retryCryptoInitialization]);

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error('useSecurity must be inside SecurityProvider');
  return ctx;
}
