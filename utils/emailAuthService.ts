import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserPrivilege } from '../types';

export interface AuthSession {
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  expiresIn: number;
  privileges: UserPrivilege[];
}

/**
 * Verifies email in a lodge's Supabase and creates authenticated session
 * Checks if user exists in app_settings.users table and retrieves privileges
 */
export async function verifyEmailAndCreateSession(
  email: string,
  googleName: string,
  googlePicture: string | undefined,
  supabaseUrl: string,
  supabaseAnonKey: string,
  lodgeName: string,
  lodgeNumber: string
): Promise<AuthSession> {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Get app_settings to check users list
    const { data, error } = await supabase
      .from('app_settings')
      .select('data')
      .eq('id', 'app')
      .maybeSingle();
    
    if (error) {
      console.error('[EMAIL_AUTH] Error fetching app_settings:', error);
      throw new Error('Errore verifica utenti');
    }
    
    if (!data || !data.data) {
      console.error('[EMAIL_AUTH] No app_settings found');
      throw new Error('Configurazione loggia non trovata');
    }
    
    const appSettings = data.data;
    const users = appSettings.users || [];
    
    // Find user by email in users array
    const user = users.find((u: any) => u.email === email);
    
    if (!user) {
      console.warn(`[EMAIL_AUTH] User ${email} not found in lodge ${lodgeNumber}`);
      throw new Error(
        `Utente ${email} non abilitato per la loggia ${lodgeName} n. ${lodgeNumber}.\n\nContattare il proprio Segretario per richiedere l'accesso.`
      );
    }
    
    // User exists - create session with privileges
    const session: AuthSession = {
      email,
      name: user.name || googleName,
      picture: googlePicture,
      accessToken: supabaseAnonKey, // Use anon key as bearer token
      expiresIn: 86400 * 365, // 1 year
      privileges: user.privileges || []
    };
    
    console.log('[EMAIL_AUTH] Session created for:', email, 'with privileges:', user.privileges);
    return session;
  } catch (err: any) {
    console.error('[EMAIL_AUTH] Verification failed:', err);
    throw err;
  }
}

/**
 * Checks if current session is valid
 */
export function isSessionValid(session: AuthSession | null): boolean {
  if (!session) return false;
  if (!session.email || !session.accessToken) return false;
  return true;
}

/**
 * Stores session in localStorage
 */
export function saveSession(session: AuthSession): void {
  try {
    localStorage.setItem('gadu_auth_session', JSON.stringify(session));
    console.log('[EMAIL_AUTH] Session saved');
  } catch (err) {
    console.error('[EMAIL_AUTH] Failed to save session:', err);
  }
}

/**
 * Retrieves session from localStorage
 */
export function getStoredSession(): AuthSession | null {
  try {
    const stored = localStorage.getItem('gadu_auth_session');
    if (!stored) return null;
    return JSON.parse(stored) as AuthSession;
  } catch (err) {
    console.error('[EMAIL_AUTH] Failed to retrieve session:', err);
    return null;
  }
}

/**
 * Clears session from localStorage
 */
export function clearSession(): void {
  try {
    localStorage.removeItem('gadu_auth_session');
    console.log('[EMAIL_AUTH] Session cleared');
  } catch (err) {
    console.error('[EMAIL_AUTH] Failed to clear session:', err);
  }
}
