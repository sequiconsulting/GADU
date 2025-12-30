import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { SupabaseAuthUser } from '../types';
import {
  getAuthSchemaVersion,
  getCurrentUser,
  getSupabaseClient,
  getSupabaseToken,
  initializeSupabaseAuth,
  isAuthenticationEnabled,
  markAuthSchemaVersion,
  needsAuthSchemaMigration,
} from '../utils/authService';

interface AuthContextValue {
  user: SupabaseAuthUser | null;
  token: string | null;
  isEnabled: boolean;
  authSchemaVersion: number | null;
  needsMigration: boolean;
  refreshSchemaVersion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isEnabled: false,
  authSchemaVersion: null,
  needsMigration: false,
  refreshSchemaVersion: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isEnabled = isAuthenticationEnabled();
  const [user, setUser] = useState<SupabaseAuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authSchemaVersion, setAuthSchemaVersion] = useState<number | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);

  useEffect(() => {
    if (!isEnabled) return;
    initializeSupabaseAuth().then(() => {
      const currentUser = getCurrentUser();
      setUser(currentUser);
      const currentToken = getSupabaseToken();
      setToken(currentToken);
      const schemaVersion = getAuthSchemaVersion(currentUser);
      setAuthSchemaVersion(schemaVersion);
      setNeedsMigration(needsAuthSchemaMigration(currentUser));
    });
  }, [isEnabled]);

  const refreshSchemaVersion = useMemo(
    () => async () => {
      if (!isEnabled) return;
      await markAuthSchemaVersion();
      const refreshedUser = getCurrentUser();
      setUser(refreshedUser);
      const schemaVersion = getAuthSchemaVersion(refreshedUser);
      setAuthSchemaVersion(schemaVersion);
      setNeedsMigration(needsAuthSchemaMigration(refreshedUser));
    },
    [isEnabled]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: isEnabled ? user : null,
      token: isEnabled ? token : null,
      isEnabled,
      authSchemaVersion,
      needsMigration,
      refreshSchemaVersion,
    }),
    [isEnabled, user, token, authSchemaVersion, needsMigration, refreshSchemaVersion]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => useContext(AuthContext);

// Helper to access the Supabase client when the flag is on. Kept for future activation.
export const useSupabaseClient = () => {
  if (!isAuthenticationEnabled()) return null;
  return getSupabaseClient();
};
