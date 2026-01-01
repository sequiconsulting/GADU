# Google OAuth Setup Guide

## Overview

GADU utilizes centralized Google OAuth authentication for all lodges. A single Google OAuth Project serves all lodge instances, with email verification handled per lodge in Supabase.

**Architecture:**
- ✅ Centralized: One Google OAuth project for all GADU lodges
- ✅ Email-only: Only email returned to client (GDPR compliant)
- ✅ Per-lodge verification: Email verified against each lodge's Supabase auth users
- ✅ Secure: Client secret never exposed to frontend
- ✅ Session-based: Sessions stored in localStorage after verification

## Steps to Enable Google OAuth

### 1. Create Google OAuth Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project: "GADU"
3. Enable the **Google+ API**
4. Create OAuth 2.0 credentials:
   - Application type: **Web application**
   - Name: "GADU OAuth"
   - Authorized JavaScript origins:
     - `http://localhost:3000` (dev)
     - `http://localhost:3001` (dev)
     - `https://yourdomain.com` (production)
   - Authorized redirect URIs:
     - `http://localhost:3000?glriNumber=*` (dev)
     - `https://yourdomain.com?glriNumber=*` (production)

### 2. Get Credentials

After creating the OAuth app:
- **Client ID**: Copy from Google Cloud Console (ends with `.apps.googleusercontent.com`)
- **Client Secret**: Copy from Google Cloud Console (safe to store on backend only)

### 3. Set Environment Variables

#### Local Development (`.env.local`)

```dotenv
VITE_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
VITE_GOOGLE_REDIRECT_URI="http://localhost:3000"
GOOGLE_CLIENT_SECRET="your-client-secret"
```

#### Production (Netlify)

Set on Netlify dashboard → Site settings → Build & deploy → Environment:

```
VITE_GOOGLE_CLIENT_ID = "your-client-id.apps.googleusercontent.com"
VITE_GOOGLE_REDIRECT_URI = "https://yourdomain.com"
GOOGLE_CLIENT_SECRET = "your-client-secret"
```

### 4. Verify Lodge Admin Accounts

For each lodge in Supabase:

```sql
-- As Supabase admin, run in SQL editor:
INSERT INTO auth.users (email, email_confirmed_at, raw_user_meta_data)
VALUES (
  'segretario@loggia.it',
  NOW(),
  '{"preferred_role": "admin"}'
);
```

Or use Supabase Dashboard → Authentication → Add user → Set email as verified.

## How It Works

### Login Flow

1. **User clicks Google button** on LoginInterface
   - Redirects to Google consent screen via `initiateGoogleLogin()`

2. **User authorizes**
   - Google redirects back with auth code: `?code=xyz&glriNumber=1234`

3. **Backend code exchange** (via `google-auth-callback.ts`)
   - Frontend detects auth code in URL
   - Calls backend function to exchange code for Google access token
   - Backend fetches user info (email, name, picture)
   - **Returns only email, name, picture** (no token stored for GDPR)

4. **Email verification** (in `emailAuthService.ts`)
   - `verifyEmailAndCreateSession()` checks if email exists in lodge's Supabase
   - Verifies email is confirmed in Supabase auth
   - Creates session object with email + Google profile
   - Session saved to localStorage

5. **App authenticated**
   - User can now access lodge data
   - Session persists across page refreshes (stored in localStorage)

6. **Logout**
   - Clears session from localStorage
   - Returns to LoginInterface

## Troubleshooting

### "Email not found" Error
- Check that user's email is created in Supabase auth for that lodge
- Verify email is marked as "Email Confirmed" in Supabase

### "Email not verified" Error
- In Supabase Dashboard, go to Authentication → Users
- Click on user email → Mark email as confirmed

### OAuth Redirect Not Working
- Verify `VITE_GOOGLE_REDIRECT_URI` matches Google Cloud Console settings
- Ensure `glriNumber` parameter is in URL during redirect

### Client Secret Exposure Risk
- **Never put `GOOGLE_CLIENT_SECRET` in frontend code**
- It's only used in `netlify/functions/google-auth-callback.ts` (server-side)
- Environment variables are safe on Netlify backend

## Files Related to OAuth

| File | Purpose |
|------|---------|
| `utils/googleOAuthService.ts` | Client-side OAuth flow (initiate, callback detection, code exchange) |
| `utils/emailAuthService.ts` | Email verification & session management |
| `netlify/functions/google-auth-callback.ts` | Secure backend code-to-token exchange |
| `components/LoginInterface.tsx` | Login UI with Google button |
| `App.tsx` | Handles OAuth callback via `currentUser` state |

## Testing

### Local Testing

1. Set `.env.local` with test Google OAuth credentials
2. Run `npm run dev`
3. Go to `http://localhost:3000?glriNumber=1234`
4. Click "Accedi con Google"
5. Authorize with a Google account that has corresponding email in Supabase

### Production Testing

1. Deploy to Netlify with environment variables set
2. Test at `https://yourdomain.com?glriNumber=1234`
3. Verify OAuth flow completes without CORS errors

## Security Notes

✅ **What's Protected:**
- Client secret stored server-side only (Netlify backend)
- Google tokens never returned to frontend
- Email verified against per-lodge Supabase instances
- Sessions stored in localStorage (not exposed to server)

⚠️ **Important:**
- Each lodge must have its own Supabase auth setup
- Only admins should have verified emails in Supabase
- Regularly audit who has verified emails in each lodge's auth
- Monitor `netlify/functions/google-auth-callback.ts` logs for suspicious activity

## Future Enhancements

- Add token refresh handling (if long sessions needed)
- Support multi-lodge access (one email in multiple lodges)
- Add SAML/SSO for enterprises
- Implement rate limiting on auth callback
