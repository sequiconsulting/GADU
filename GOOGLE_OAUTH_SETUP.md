# Google OAuth Setup Guide

## Overview

GADU utilizes centralized Google OAuth authentication for all lodges. A single Google OAuth Project serves all lodge instances, with **user verification handled per lodge in Supabase `app_settings.users` table**.

**Architecture:**
- ✅ Centralized: One Google OAuth project for all GADU lodges
- ✅ Email-only: Only email returned to client (GDPR compliant)
- ✅ **Per-lodge verification: Email verified against lodge's `app_settings.users` table**
- ✅ **Privilege-based: User privileges loaded from database and stored in session**
- ✅ Secure: Client secret never exposed to frontend
- ✅ Session-based: Sessions stored in localStorage after verification

**Important:** Users must be added to the lodge's `app_settings.users` array via AdminPanel before they can authenticate. If a user's email is not in the database, they will see: *"Utente xxx non abilitato per loggia xxx. Contattare il proprio Segretario."*

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

1. **User accesses lodge URL**
   - Navigate to `/?glriNumber=1234`
   - App loads lodge config from registry

2. **User clicks Google button** on LoginInterface
   - Redirects to Google consent screen via `initiateGoogleLogin()`

3. **User authorizes**
   - Google redirects back with auth code: `?code=xyz&glriNumber=1234`

4. **Backend code exchange** (via `google-auth-callback.ts`)
   - Frontend detects auth code in URL
   - Calls backend function to exchange code for Google access token
   - Backend fetches user info (email, name, picture)
   - **Returns only email, name, picture** (no token stored for GDPR)

5. **User verification** (in `emailAuthService.ts`)
   - `verifyEmailAndCreateSession()` queries lodge's `app_settings` table
   - Searches for user email in `data.users[]` array
   - **If not found**: throws error *"Utente xxx non abilitato per loggia xxx. Contattare il proprio Segretario."*
   - **If found**: loads user privileges (AD, CR, MR, etc.) from database
   - Creates session object with email, name, picture, **and privileges**
   - Session saved to localStorage

6. **App authenticated**
   - User can now access lodge data
   - Session persists across page refreshes (stored in localStorage)
   - `currentUser.privileges` available for access control

7. **Logout**
   - Clears session from localStorage
   - Returns to LoginInterface

## User Management

### Adding Users (Segretario)

1. Login to lodge as admin (with `AD` privilege)
2. Go to **Impostazioni** (AdminPanel)
3. Scroll to **Utenti Autorizzati**
4. Click **Aggiungi Utente**
5. Enter email and name
6. Select privileges (AD, CR, MR, AR, RR, CW, MW, AW, RW)
7. Click **Salva**

User will now be able to authenticate with their Google email.

## Troubleshooting

### "Utente xxx non abilitato per loggia xxx" Error
- User's email must be added to `app_settings.users` by lodge Segretario
- Go to AdminPanel → Utenti Autorizzati → Add user with correct email
- Email must match exactly (case-sensitive)

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
