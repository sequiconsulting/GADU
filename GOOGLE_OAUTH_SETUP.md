# Guida Configurazione Google OAuth

## Panoramica

GADU utilizza autenticazione Google OAuth centralizzata per tutte le logge. Un singolo progetto Google OAuth serve tutte le istanze di loggia, con **verifica utente gestita per loggia nella tabella `app_settings.users` di Supabase**.

**Architettura:**
- ✅ Centralizzata: Un unico progetto Google OAuth per tutte le logge GADU
- ✅ Solo email: Solo l'email viene restituita al client (conforme GDPR)
- ✅ **Verifica per-loggia: Email verificata nella tabella `app_settings.users` della loggia**
- ✅ **Basata su privilegi: Privilegi utente caricati dal database e salvati in sessione**
- ✅ Sicura: Client secret mai esposto al frontend
- ✅ Basata su sessioni: Sessioni salvate in localStorage dopo la verifica

**Importante:** Gli utenti devono essere aggiunti all'array `app_settings.users` della loggia tramite AdminPanel prima di poter autenticarsi. Se l'email di un utente non è nel database, verrà mostrato: *"Utente xxx non abilitato per loggia xxx. Contattare il proprio Segretario."*

## Passi per Abilitare Google OAuth

### 1. Creare Progetto Google OAuth

1. Vai su [Google Cloud Console](https://console.cloud.google.com)
2. Crea un nuovo progetto: "GADU"
3. Abilita la **Google+ API**
4. Crea credenziali OAuth 2.0:
   - Tipo applicazione: **Applicazione web**
   - Nome: "GADU OAuth"
   - Origini JavaScript autorizzate:
     - `http://localhost:3000` (sviluppo)
     - `http://localhost:3001` (sviluppo)
     - `https://tuodominio.com` (produzione)
   - URI di reindirizzamento autorizzati:
     - `http://localhost:3000?glriNumber=*` (sviluppo)
     - `https://tuodominio.com?glriNumber=*` (produzione)

### 2. Ottenere le Credenziali

Dopo aver creato l'app OAuth:
- **Client ID**: Copia dalla Google Cloud Console (termina con `.apps.googleusercontent.com`)
- **Client Secret**: Copia dalla Google Cloud Console (da conservare solo sul backend)

### 3. Impostare le Variabili d'Ambiente

#### Sviluppo Locale (`.env.local`)

```dotenv
VITE_GOOGLE_CLIENT_ID="tuo-client-id.apps.googleusercontent.com"
VITE_GOOGLE_REDIRECT_URI="http://localhost:3000"
GOOGLE_CLIENT_SECRET="tuo-client-secret"
```

#### Produzione (Netlify)

Imposta su Netlify dashboard → Impostazioni sito → Build & deploy → Variabili d'ambiente:

```
VITE_GOOGLE_CLIENT_ID = "tuo-client-id.apps.googleusercontent.com"
VITE_GOOGLE_REDIRECT_URI = "https://tuodominio.com"
GOOGLE_CLIENT_SECRET = "tuo-client-secret"
```

## Come Funziona

### Flusso di Login

1. **L'utente accede all'URL della loggia**
   - Naviga su `/?glriNumber=1234`
   - L'app carica la configurazione della loggia dal registry

2. **L'utente clicca sul pulsante Google** su LoginInterface
   - Reindirizza alla schermata di consenso Google tramite `initiateGoogleLogin()`

3. **L'utente autorizza**
   - Google reindirizza con codice auth: `?code=xyz&glriNumber=1234`

4. **Scambio codice backend** (tramite `google-auth-callback.ts`)
   - Il frontend rileva il codice auth nell'URL
   - Chiama la funzione backend per scambiare il codice con token di accesso Google
   - Il backend recupera le informazioni utente (email, nome, foto)
   - **Restituisce solo email, nome, foto** (nessun token memorizzato per GDPR)

5. **Verifica utente** (in `emailAuthService.ts`)
   - `verifyEmailAndCreateSession()` interroga la tabella `app_settings` della loggia
   - Cerca l'email utente nell'array `data.users[]`
   - **Se non trovato**: genera errore *"Utente xxx non abilitato per loggia xxx. Contattare il proprio Segretario."*
   - **Se trovato**: carica i privilegi utente dal database
   - Crea oggetto sessione con email, nome, foto, **e privilegi**
   - Sessione salvata in localStorage

6. **App autenticata**
   - L'utente può ora accedere ai dati della loggia
   - La sessione persiste dopo il refresh della pagina (salvata in localStorage)
   - `currentUser.privileges` disponibile per il controllo degli accessi

7. **Logout**
   - Cancella la sessione da localStorage
   - Ritorna a LoginInterface

## Gestione Utenti

### Aggiungere Utenti (Segretario)

1. Login alla loggia come admin (con privilegio `AD`)
2. Vai su **Impostazioni** (AdminPanel)
3. Scorri fino a **Utenti Autorizzati**
4. Clicca **Aggiungi Utente**
5. Inserisci email e nome
6. Seleziona privilegi:
   - `AD` = Amministratore (configurazione e utenti)
   - `CR` = Craft - Lettura
   - `CW` = Craft - Scrittura
   - `MR` = Mark - Lettura
   - `MW` = Mark - Scrittura
   - `AR` = Chapter - Lettura
   - `AW` = Chapter - Scrittura
   - `RR` = RAM - Lettura
   - `RW` = RAM - Scrittura
7. Clicca **Salva**

L'utente potrà ora autenticarsi con la propria email Google.

## Risoluzione Problemi

### Errore "Utente xxx non abilitato per loggia xxx"
- L'email dell'utente deve essere aggiunta a `app_settings.users` dal Segretario della loggia
- Vai su AdminPanel → Utenti Autorizzati → Aggiungi utente con email corretta
- L'email deve corrispondere esattamente (case-sensitive)

### Reindirizzamento OAuth Non Funziona
- Verifica che `VITE_GOOGLE_REDIRECT_URI` corrisponda alle impostazioni in Google Cloud Console
- Assicurati che il parametro `glriNumber` sia presente nell'URL durante il redirect

### Rischio Esposizione Client Secret
- **Mai inserire `GOOGLE_CLIENT_SECRET` nel codice frontend**
- Viene usato solo in `netlify/functions/google-auth-callback.ts` (lato server)
- Le variabili d'ambiente sono sicure sul backend Netlify

## File Relativi a OAuth

| File | Scopo |
|------|-------|
| `utils/googleOAuthService.ts` | Flusso OAuth lato client (avvio, rilevamento callback, scambio codice) |
| `utils/emailAuthService.ts` | Verifica email e gestione sessione |
| `netlify/functions/google-auth-callback.ts` | Scambio sicuro codice-token sul backend |
| `components/LoginInterface.tsx` | UI di login con pulsante Google |
| `App.tsx` | Gestisce callback OAuth tramite stato `currentUser` |

## Test

### Test Locale

1. Imposta `.env.local` con credenziali Google OAuth di test
2. Esegui `npm run dev`
3. Vai su `http://localhost:3000?glriNumber=1234`
4. Clicca "Accedi con Google"
5. Autorizza con un account Google la cui email è presente in `app_settings.users`

### Test Produzione

1. Deploy su Netlify con variabili d'ambiente impostate
2. Testa su `https://tuodominio.com?glriNumber=1234`
3. Verifica che il flusso OAuth si completi senza errori CORS

## Note di Sicurezza

✅ **Cosa è Protetto:**
- Client secret memorizzato solo lato server (backend Netlify)
- Token Google mai restituiti al frontend
- Email verificata contro istanze Supabase per-loggia
- Sessioni memorizzate in localStorage (non esposte al server)

⚠️ **Importante:**
- Ogni loggia deve avere la propria configurazione utenti in `app_settings.users`
- Solo gli admin dovrebbero avere il privilegio `AD`
- Controlla regolarmente chi ha accesso tramite AdminPanel → Utenti Autorizzati
- Monitora i log di `netlify/functions/google-auth-callback.ts` per attività sospette

## Miglioramenti Futuri

- Aggiungere gestione refresh token (se necessarie sessioni lunghe)
- Supportare accesso multi-loggia (una email in più logge)
- Aggiungere SAML/SSO per aziende
- Implementare rate limiting sulla callback auth
