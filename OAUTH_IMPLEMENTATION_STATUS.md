# Google OAuth Implementation - Next Steps

## ✅ Completed

- [x] Created OAuth service layer (`utils/googleOAuthService.ts`)
- [x] Created secure backend callback (`netlify/functions/google-auth-callback.ts`)
- [x] Created email authentication service (`utils/emailAuthService.ts`)
- [x] Integrated OAuth into LoginInterface
- [x] Updated App.tsx for OAuth session management
- [x] Updated logout handler to clear OAuth sessions
- [x] Created comprehensive setup guide (`GOOGLE_OAUTH_SETUP.md`)
- [x] TypeScript compilation successful (build passed)
- [x] All changes committed to GitHub

## 🔧 What You Need To Do

### 1. Create Google OAuth Project

Go to [Google Cloud Console](https://console.cloud.google.com):

1. Create new project: "GADU"
2. Enable Google+ API
3. Create OAuth 2.0 credentials:
   - Type: Web application
   - Authorized JavaScript origins: `http://localhost:3000`, `https://yourdomain.com`
   - Authorized redirect URIs: `http://localhost:3000?glriNumber=*`, `https://yourdomain.com?glriNumber=*`

**Result**: You'll get:
- `CLIENT_ID` (ends with `.apps.googleusercontent.com`)
- `CLIENT_SECRET` (keep this private!)

### 2. Set Local Environment Variables

Edit `.env.local`:

```dotenv
VITE_GOOGLE_CLIENT_ID="YOUR_CLIENT_ID.apps.googleusercontent.com"
VITE_GOOGLE_REDIRECT_URI="http://localhost:3000"
GOOGLE_CLIENT_SECRET="YOUR_CLIENT_SECRET"
```

Then test locally:
```bash
npm run dev
```

Go to `http://localhost:3000?glriNumber=9999` and test the Google login button.

### 3. Configure Supabase Verified Emails

For each lodge you want to test:

**Option A: Via Supabase Dashboard**
1. Go to Authentication → Users
2. Add user → Email: `test@example.com`
3. Check "Auto confirm user"

**Option B: Via SQL (in Supabase SQL Editor)**
```sql
INSERT INTO auth.users (email, email_confirmed_at)
VALUES ('test@example.com', NOW());
```

Then test with the corresponding Google account that has this email.

### 4. Deploy to Netlify

Set production environment variables on Netlify dashboard:

**Site settings → Build & deploy → Environment → Edit variables**

Add:
- `VITE_GOOGLE_CLIENT_ID` = your-client-id
- `VITE_GOOGLE_REDIRECT_URI` = `https://yourdomain.com`
- `GOOGLE_CLIENT_SECRET` = your-client-secret (backend only)

Then deploy:
```bash
git push origin main
```

## 🧪 Testing Checklist

### Local Testing
- [ ] User can see Google login button at `http://localhost:3000?glriNumber=9999`
- [ ] Click "Accedi con Google" redirects to Google consent screen
- [ ] After authorizing, user is logged into GADU
- [ ] Session persists after page refresh
- [ ] Logout clears session and returns to login
- [ ] "Email not found" error shows if email not in Supabase

### Production Testing
- [ ] Same flow works at `https://yourdomain.com?glriNumber=XXXX`
- [ ] Netlify Functions logs show no errors
- [ ] OAuth callback correctly exchanges code for email

## 📊 Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend OAuth Service | ✅ Done | `utils/googleOAuthService.ts` |
| Backend OAuth Callback | ✅ Done | `netlify/functions/google-auth-callback.ts` v2.0 |
| Email Auth Service | ✅ Done | Session management + Supabase verification |
| LoginInterface Integration | ✅ Done | Google button fully functional |
| App Session Management | ✅ Done | Auto-loads session on app start |
| Documentation | ✅ Done | Complete setup guide in `GOOGLE_OAUTH_SETUP.md` |
| **Google OAuth Project** | ⏳ TODO | **You must create this** |
| **Environment Variables** | ⏳ TODO | **Set on Netlify + local** |
| **Supabase User Setup** | ⏳ TODO | **Create verified emails for testing** |

## 💡 Architecture Summary

```
User Browser
    ↓ [Click "Accedi con Google"]
    ↓
Google OAuth
    ↓ [Redirect with auth code]
    ↓
App detected ?code= in URL
    ↓
Backend: POST /google-auth-callback { code }
    ↓
Exchange code → Google access token → User info
    ↓
Return: { email, name, picture }
    ↓
Frontend: verify email in lodge's Supabase
    ↓
Create session { email, name, picture, accessToken }
    ↓
Store in localStorage
    ↓
User logged in ✅
```

## 🔒 Security Highlights

✅ **Client Secret**: Never exposed to frontend (backend-only in Netlify Functions)
✅ **Token Handling**: Google tokens not stored (GDPR compliant)
✅ **Email Verification**: Verified against per-lodge Supabase auth
✅ **Session Storage**: localStorage only (not httpOnly, but standard for SPAs)
✅ **Encryption**: Registry encrypted with AES-256-GCM on Netlify Blobs

## Questions?

See [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) for detailed troubleshooting and FAQs.
