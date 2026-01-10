import { SupabaseClient } from '@supabase/supabase-js';
import { UserPrivilege } from '../types';
import { getCachedSupabaseClient } from './supabaseClientCache';

export interface AuthSession {
  email: string;
  name: string;
  userId?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  privileges: UserPrivilege[];
  mustChangePassword?: boolean;
}

const STORAGE_KEY = 'gadu_auth_session';

export function createAuthClient(supabaseUrl: string, supabaseAnonKey: string): SupabaseClient {
  return getCachedSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

async function fetchUserPrivilegesFromMetadata(userId: string, email: string, userMetadata?: any): Promise<{ name?: string; privileges: UserPrivilege[] } | null> {
  // Privileges are now stored in Supabase user_metadata
  if (!userMetadata) return null;
  
  const privileges = userMetadata.privileges || [];
  const name = userMetadata.name || email;
  
  console.log(`[EMAIL_AUTH] User ${email} has privileges:`, privileges);
  return { name, privileges };
}

/**
 * Signs in a user with email and password
 * Checks if user exists in app_settings.users before allowing login
 */
export async function signInWithPassword(
  email: string,
  password: string,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<AuthSession> {
  const client = createAuthClient(supabaseUrl, supabaseAnonKey);

  // Attempt login
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('[EMAIL_AUTH] Login error:', error);
    throw new Error('Email o password errati');
  }

  if (!data.session || !data.user?.email) {
    throw new Error('Nessuna sessione creata');
  }

  // Check if user has privileges in metadata
  let privilegesInfo: { name?: string; privileges: UserPrivilege[] } | null = null;
  try {
    privilegesInfo = await fetchUserPrivilegesFromMetadata(
      data.user.id,
      data.user.email,
      data.user.user_metadata
    );
  } catch (err) {
    console.error('[EMAIL_AUTH] Privilege lookup failed:', err);
    await client.auth.signOut();
    throw new Error('Impossibile verificare i privilegi utente');
  }

  if (!privilegesInfo || !privilegesInfo.privileges?.length) {
    // Permetti login per utente demo della loggia 9999 anche senza privilegi
    // (verranno ripristinati automaticamente dopo il login)
    if (email.toLowerCase() !== 'demo@demo.app') {
      await client.auth.signOut();
      throw new Error('Utente non autorizzato: nessun privilegio configurato');
    }
    // Utente demo senza privilegi: imposta array vuoto temporaneo
    privilegesInfo = { name: email, privileges: [] };
  }

  const authSession: AuthSession = {
    email: data.user.email,
    name: privilegesInfo.name || data.user.email,
    userId: data.user.id,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at ? data.session.expires_at * 1000 : undefined,
    privileges: privilegesInfo.privileges,
    mustChangePassword: data.user.user_metadata?.mustChangePassword || false,
  };

  saveSession(authSession);
  return authSession;
}

/**
 * Cambia la password dell'utente autenticato
 */
export async function changePassword(
  newPassword: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
  userId: string
): Promise<AuthSession> {
  // Validazione input ESPLICITA
  if (!newPassword || newPassword.length < 8) {
    throw new Error('La password deve essere di almeno 8 caratteri');
  }

  if (!supabaseUrl || !supabaseAnonKey || !userId) {
    throw new Error('Parametri di autenticazione mancanti');
  }

  const client = createAuthClient(supabaseUrl, supabaseAnonKey);

  // Update password
  const { data, error } = await client.auth.updateUser({
    password: newPassword,
    data: {
      mustChangePassword: false,
    },
  });

  if (error) {
    console.error('[EMAIL_AUTH] Password change error:', error);
    
    // Errori specifici da Supabase con messaggi actionable in italiano
    const errorMsg = error.message?.toLowerCase() || '';
    
    if (errorMsg.includes('same') || errorMsg.includes('same password') || errorMsg.includes('uguale')) {
      throw new Error('La nuova password non può essere uguale a quella precedente');
    }
    
    if (errorMsg.includes('weak')) {
      throw new Error('Password troppo debole: usa almeno 8 caratteri con maiuscole, minuscole e numeri');
    }
    
    // Errore generico fallback con codice per debug
    throw new Error(`Errore durante il cambio password: ${error.message}`);
  }

  if (!data.user?.email) {
    throw new Error('Utente non valido dopo cambio password');
  }

  const { data: sessionData } = await client.auth.getSession();
  const session = sessionData?.session;

  // Get updated session with privileges
  let privilegesInfo: { name?: string; privileges: UserPrivilege[] } | null = null;
  try {
    privilegesInfo = await fetchUserPrivilegesFromMetadata(
      data.user.id,
      data.user.email,
      data.user.user_metadata
    );
  } catch (err) {
    console.error('[EMAIL_AUTH] Privilege lookup failed:', err);
    throw new Error('Impossibile verificare i privilegi utente');
  }

  if (!privilegesInfo || !privilegesInfo.privileges?.length) {
    throw new Error('Utente non autorizzato: nessun privilegio configurato');
  }

  const authSession: AuthSession = {
    email: data.user.email,
    name: privilegesInfo.name || data.user.email,
    userId: data.user.id,
    accessToken: session?.access_token || '',
    refreshToken: session?.refresh_token,
    expiresAt: session?.expires_at ? session.expires_at * 1000 : undefined,
    privileges: privilegesInfo.privileges,
    mustChangePassword: false,
  };

  saveSession(authSession);
  return authSession;
}

export async function loadActiveSession(
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<AuthSession | null> {
  const client = createAuthClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await client.auth.getSession();

  if (error) {
    console.error('[EMAIL_AUTH] Failed to read session:', error);
    return null;
  }

  const session = data.session;
  if (!session || !session.user?.email) {
    return null;
  }

  let privilegesInfo: { name?: string; privileges: UserPrivilege[] } | null = null;
  try {
    privilegesInfo = await fetchUserPrivilegesFromMetadata(
      session.user.id,
      session.user.email,
      session.user.user_metadata
    );
  } catch (err) {
    console.error('[EMAIL_AUTH] Privilege lookup failed:', err);
    privilegesInfo = null;
  }

  if (!privilegesInfo || !privilegesInfo.privileges?.length) {
    await client.auth.signOut();
    return null;
  }

  const authSession: AuthSession = {
    email: session.user.email,
    name: privilegesInfo.name || session.user.email,
    userId: session.user.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ? session.expires_at * 1000 : undefined,
    privileges: privilegesInfo.privileges,
    mustChangePassword: session.user.user_metadata?.mustChangePassword || false,
  };

  saveSession(authSession);
  return authSession;
}

export async function clearSupabaseSession(
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<void> {
  const client = createAuthClient(supabaseUrl, supabaseAnonKey);
  await client.auth.signOut();
  clearSession();
}

export function saveSession(session: AuthSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    console.error('[EMAIL_AUTH] Failed to save session:', err);
  }
}

export function getStoredSession(): AuthSession | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as AuthSession;
  } catch (err) {
    console.error('[EMAIL_AUTH] Failed to retrieve session:', err);
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('[EMAIL_AUTH] Failed to clear session:', err);
  }
}
