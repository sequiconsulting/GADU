import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface AuthSession {
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  expiresIn: number;
}

/**
 * Verifies email in a lodge's Supabase and creates authenticated session
 */
export async function verifyEmailAndCreateSession(
  email: string,
  googleName: string,
  googlePicture: string | undefined,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<AuthSession> {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // First check if user exists in auth
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('[EMAIL_AUTH] Error listing users:', listError);
      throw new Error('Errore verifica utenti');
    }
    
    const user = users?.find((u: any) => u.email === email);
    
    if (!user) {
      console.warn(`[EMAIL_AUTH] Email not found: ${email}`);
      throw new Error(`Email ${email} non autorizzata in questa loggia`);
    }
    
    if (!user.email_confirmed_at) {
      console.warn(`[EMAIL_AUTH] Email not verified: ${email}`);
      throw new Error(`Email ${email} non verificata. Contatta il Segretario.`);
    }
    
    // User exists and verified - create anonymous session with email claim
    // (Since we're using anon key, we can't create a real session, but we store verified info)
    const session: AuthSession = {
      email,
      name: googleName,
      picture: googlePicture,
      accessToken: supabaseAnonKey, // Use anon key as bearer token
      expiresIn: 86400 * 365 // 1 year
    };
    
    console.log('[EMAIL_AUTH] Session created for:', email);
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
