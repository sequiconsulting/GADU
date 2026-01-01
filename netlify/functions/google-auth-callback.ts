/**
 * Google OAuth Callback Handler (v2.0)
 * Securely exchanges authorization code for user info
 * Keeps client secret safe on the server
 */

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token: string;
}

interface UserInfoResponse {
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  sub: string;
}

export default async (request: Request) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  
  try {
    const { code } = await request.json() as any;
    
    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization code' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.VITE_GOOGLE_REDIRECT_URI;
    
    if (!clientId || !clientSecret || !redirectUri) {
      console.error('[GOOGLE_AUTH] Missing OAuth configuration');
      return new Response(
        JSON.stringify({ error: 'Server misconfigured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Step 1: Exchange code for tokens
    console.log('[GOOGLE_AUTH] Exchanging code for tokens...');
    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }).toString()
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('[GOOGLE_AUTH] Token exchange failed:', error);
      return new Response(
        JSON.stringify({ error: 'Token exchange failed' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const tokens = await tokenResponse.json() as TokenResponse;
    
    // Step 2: Get user info (email, name, picture)
    console.log('[GOOGLE_AUTH] Fetching user info...');
    const userInfoResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    
    if (!userInfoResponse.ok) {
      console.error('[GOOGLE_AUTH] User info fetch failed');
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user info' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const userInfo = await userInfoResponse.json() as UserInfoResponse;
    
    console.log('[GOOGLE_AUTH] Authentication successful for:', userInfo.email);
    
    // Return only email and public info (no token storage)
    return new Response(
      JSON.stringify({
        email: userInfo.email,
        email_verified: userInfo.email_verified,
        name: userInfo.name,
        picture: userInfo.picture
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('[GOOGLE_AUTH] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
