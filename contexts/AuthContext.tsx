/**
 * Auth0 Context - PREPARED FOR FUTURE IMPLEMENTATION
 * 
 * This context will be used when Auth0 authentication is enabled.
 * Currently NOT ACTIVE - the app runs without authentication.
 * 
 * To activate:
 * 1. Install: npm install @auth0/auth0-react
 * 2. Uncomment the Auth0Provider wrapper in index.tsx
 * 3. Wrap App component with useAuth0() hook in components that need user info
 * 4. Remove or modify the bypass in App.tsx (currently hardcoded to skip auth guard)
 * 
 * Environment variables needed in .env.local:
 * VITE_AUTH0_DOMAIN=your-tenant.auth0.com
 * VITE_AUTH0_CLIENT_ID=your_client_id
 * VITE_AUTH0_REDIRECT_URI=http://localhost:3000
 */

import React, { createContext, useContext } from 'react';
import { Auth0User } from '../types';

interface AuthContextType {
  user: Auth0User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (options?: any) => void;
  logout: (options?: any) => void;
  getIdTokenClaims: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Hook to access Auth0 context
 * Will be used by components that need user information or permission checks
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an Auth0Provider');
  }
  return context;
};

/**
 * Provider component for Auth0
 * Currently a placeholder - will be replaced with Auth0Provider when activated
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // TODO: Replace with actual Auth0Provider implementation
  const value: AuthContextType = {
    user: null,
    isLoading: false,
    isAuthenticated: false,
    login: () => {},
    logout: () => {},
    getIdTokenClaims: async () => ({}),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
