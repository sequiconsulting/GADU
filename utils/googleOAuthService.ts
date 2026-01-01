/**
 * Google OAuth Service
 * Centralized OAuth flow for all lodges
 * Returns only email (no token storage for GDPR compliance)
 */

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

export interface GoogleAuthResponse {
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
}

/**
 * Initiates Google OAuth flow
 * Redirects user to Google login consent screen
 */
export function initiateGoogleLogin(redirectUri: string): void {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID not configured');
  }
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent'
  });
  
  window.location.href = `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Exchanges authorization code for user info
 * This should be called from a backend function (netlify function)
 * to avoid exposing client secret
 */
export async function exchangeCodeForEmail(
  code: string,
  lodgeUrl: string
): Promise<GoogleAuthResponse> {
  // Call our backend function to exchange code
  // This keeps the client secret safe
  const response = await fetch(`${lodgeUrl}/.netlify/functions/google-auth-callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  
  if (!response.ok) {
    throw new Error(`Auth exchange failed: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Google auth error: ${data.error}`);
  }
  
  return data as GoogleAuthResponse;
}

/**
 * Check if current URL contains an auth code from Google redirect
 */
export function getAuthCodeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('code');
}

/**
 * Clean auth code from URL (prevent resubmission)
 */
export function cleanAuthCodeFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  params.delete('code');
  params.delete('state');
  
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', newUrl);
}
