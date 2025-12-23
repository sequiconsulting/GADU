import { AppUser, UserPrivilege, NetlifyIdentityUser } from '../types';

/**
 * Authentication Service for Netlify Identity
 * FEATURE FLAG: Set NETLIFY_AUTH_ENABLED to true to activate authentication
 */

const NETLIFY_AUTH_ENABLED = false; // Feature flag - set to true to enable Netlify authentication

interface NetlifyIdentity {
  currentUser(): NetlifyIdentityUser | null;
  open(): void;
  close(): void;
  logout(): Promise<void>;
  on(event: string, callback: (user: NetlifyIdentityUser) => void): void;
}

let netlifyIdentity: NetlifyIdentity | null = null;

/**
 * Initialize Netlify Identity (only if enabled)
 */
export const initializeNetlifyAuth = async (): Promise<void> => {
  if (!NETLIFY_AUTH_ENABLED) {
    console.log('[Auth] Netlify authentication disabled (NETLIFY_AUTH_ENABLED = false)');
    return;
  }

  try {
    if ('netlifyIdentity' in window) {
      netlifyIdentity = (window as any).netlifyIdentity;
      netlifyIdentity?.on('login', (user) => {
        console.log('[Auth] User logged in:', user.email);
      });
      netlifyIdentity?.on('logout', () => {
        console.log('[Auth] User logged out');
      });
    }
  } catch (error) {
    console.error('[Auth] Failed to initialize Netlify Identity:', error);
  }
};

/**
 * Get currently logged-in user
 */
export const getCurrentUser = (): NetlifyIdentityUser | null => {
  if (!NETLIFY_AUTH_ENABLED) return null;
  return netlifyIdentity?.currentUser() || null;
};

/**
 * Open Netlify Identity login modal
 */
export const openNetlifyLogin = (): void => {
  if (!NETLIFY_AUTH_ENABLED) {
    console.warn('[Auth] Netlify authentication is disabled');
    return;
  }
  netlifyIdentity?.open();
};

/**
 * Logout current user
 */
export const logoutNetlify = async (): Promise<void> => {
  if (!NETLIFY_AUTH_ENABLED) return;
  await netlifyIdentity?.logout();
};

/**
 * Get JWT token for API calls
 */
export const getNetlifyToken = (): string | null => {
  if (!NETLIFY_AUTH_ENABLED) return null;
  const user = getCurrentUser();
  return user?.token?.access_token || null;
};

/**
 * Check if authentication is enabled
 */
export const isAuthenticationEnabled = (): boolean => {
  return NETLIFY_AUTH_ENABLED;
};

/**
 * Parse privileges from user app_metadata
 * Privileges are stored as a comma-separated string in app_metadata.privileges
 */
export const getUserPrivileges = (user: AppUser | null): UserPrivilege[] => {
  if (!user) return [];
  return user.privileges || [];
};

/**
 * Find user by email in user list
 */
export const findUserByEmail = (email: string, users: AppUser[]): AppUser | null => {
  return users.find(u => u.email === email) || null;
};

/**
 * Create a new user with privileges (Admin only)
 */
export const createUser = (email: string, name: string, privileges: UserPrivilege[]): AppUser => {
  return {
    id: `user_${Date.now()}`,
    email,
    name,
    privileges,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Update user privileges (Admin only)
 */
export const updateUserPrivileges = (user: AppUser, privileges: UserPrivilege[]): AppUser => {
  return {
    ...user,
    privileges,
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Delete user (Admin only)
 */
export const deleteUser = (userId: string, users: AppUser[]): AppUser[] => {
  return users.filter(u => u.id !== userId);
};
