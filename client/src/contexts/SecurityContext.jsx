import { createContext, useContext } from 'react';
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

  return (
    <SecurityContext.Provider value={{
      securityState,
      cryptoError,
      retryCryptoInitialization,
    }}>
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error('useSecurity must be inside SecurityProvider');
  return ctx;
}
