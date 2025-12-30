import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { AppUser, SupabaseAuthUser, UserPrivilege } from '../types';

/**
 * Supabase Authentication (prepared, disabled by default)
 * - Toggle SUPABASE_AUTH_ENABLED to true to activate once infrastructure is ready
 * - Tracks auth metadata schema via SUPABASE_AUTH_SCHEMA_VERSION
 */

const SUPABASE_AUTH_ENABLED = false; // Feature flag - keep false until Supabase is configured
const SUPABASE_AUTH_SCHEMA_VERSION = 1; // Increment when auth metadata format changes
const AUTH_SCHEMA_KEY = 'gadu_schema_version';

let supabase: SupabaseClient | null = null;
let cachedSession: Session | null = null;

const cacheSession = (session: Session | null) => {
  cachedSession = session;
};

const getEnvConfig = (): { url?: string; anonKey?: string } => ({
  url: (import.meta as any)?.env?.VITE_SUPABASE_URL,
  anonKey: (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY,
});

const ensureSupabaseClient = (): SupabaseClient | null => {
  if (!SUPABASE_AUTH_ENABLED) return null;
  if (supabase) return supabase;
  const { url, anonKey } = getEnvConfig();
  if (!url || !anonKey) {
    console.warn('[Auth] Missing Supabase environment variables (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)');
    return null;
  }
  supabase = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return supabase;
};

/**
 * Initialize Supabase Auth listeners (no-op while disabled)
 */
export const initializeSupabaseAuth = async (): Promise<void> => {
  if (!SUPABASE_AUTH_ENABLED) {
    console.log('[Auth] Supabase authentication disabled (SUPABASE_AUTH_ENABLED = false)');
    return;
  }

  const client = ensureSupabaseClient();
  if (!client) return;

  const { data, error } = await client.auth.getSession();
  if (error) {
    console.error('[Auth] Failed to fetch Supabase session:', error.message);
  }
  cacheSession(data?.session ?? null);

  client.auth.onAuthStateChange((_event, session) => {
    cacheSession(session);
    const userSchema = getAuthSchemaVersion(session?.user ?? null);
    if (userSchema !== null && userSchema !== SUPABASE_AUTH_SCHEMA_VERSION) {
      console.warn(`[Auth] Supabase auth schema mismatch (user=${userSchema}, app=${SUPABASE_AUTH_SCHEMA_VERSION}). Run markAuthSchemaVersion() after migrating claims.`);
    }
  });
};

/**
 * Current Supabase user (null if disabled or not signed in)
 */
export const getCurrentUser = (): SupabaseAuthUser | null => {
  if (!SUPABASE_AUTH_ENABLED) return null;
  return (cachedSession?.user as SupabaseAuthUser | null) ?? null;
};

/**
 * Get current access token for API calls
 */
export const getSupabaseToken = (): string | null => {
  if (!SUPABASE_AUTH_ENABLED) return null;
  return cachedSession?.access_token ?? null;
};

/**
 * Stub login helper (UI not wired yet)
 */
export const openSupabaseLogin = (): void => {
  console.warn('[Auth] Supabase login UI not wired. Implement sign-in flow before enabling auth.');
};

/**
 * Logout current Supabase user
 */
export const logoutSupabase = async (): Promise<void> => {
  if (!SUPABASE_AUTH_ENABLED) return;
  const client = ensureSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
  cacheSession(null);
};

/**
 * Check if authentication feature flag is active
 */
export const isAuthenticationEnabled = (): boolean => SUPABASE_AUTH_ENABLED;

/**
 * Extract current auth schema version from Supabase user metadata
 */
export const getAuthSchemaVersion = (user: SupabaseAuthUser | null): number | null => {
  if (!user) return null;
  const fromMeta = (user.user_metadata?.[AUTH_SCHEMA_KEY] ?? user.app_metadata?.[AUTH_SCHEMA_KEY]);
  return typeof fromMeta === 'number' ? fromMeta : null;
};

/**
 * Returns true if the user's stored schema version differs from the app's expected one
 */
export const needsAuthSchemaMigration = (user: SupabaseAuthUser | null): boolean => {
  const current = getAuthSchemaVersion(user);
  return current !== null && current !== SUPABASE_AUTH_SCHEMA_VERSION;
};

/**
 * Writes the expected schema version into Supabase user metadata (client-side)
 */
export const markAuthSchemaVersion = async (): Promise<void> => {
  if (!SUPABASE_AUTH_ENABLED) {
    console.warn('[Auth] markAuthSchemaVersion skipped because auth is disabled');
    return;
  }
  const client = ensureSupabaseClient();
  if (!client) return;
  const { data, error } = await client.auth.updateUser({ data: { [AUTH_SCHEMA_KEY]: SUPABASE_AUTH_SCHEMA_VERSION } });
  if (error) {
    console.error('[Auth] Failed to update Supabase auth schema version:', error.message);
    return;
  }
  cacheSession(data?.session ?? cachedSession);
};

/**
 * Privilege helpers (client-side AppUser records; Supabase auth is disabled by default)
 */
export const getUserPrivileges = (user: AppUser | null): UserPrivilege[] => {
  if (!user) return [];
  return user.privileges || [];
};

export const findUserByEmail = (email: string, users: AppUser[]): AppUser | null => {
  return users.find(u => u.email === email) || null;
};

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

export const updateUserPrivileges = (user: AppUser, privileges: UserPrivilege[]): AppUser => {
  return {
    ...user,
    privileges,
    updatedAt: new Date().toISOString(),
  };
};

export const deleteUser = (userId: string, users: AppUser[]): AppUser[] => {
  return users.filter(u => u.id !== userId);
};

/**
 * Internal helper to surface the Supabase client for future use (kept disabled until flag flips)
 */
export const getSupabaseClient = (): SupabaseClient | null => {
  return ensureSupabaseClient();
};
