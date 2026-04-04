import React, { createContext, useContext } from 'react';
import { useAuthProviderController } from '../features/auth/useAuthProviderController.mjs';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const value = useAuthProviderController();

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
