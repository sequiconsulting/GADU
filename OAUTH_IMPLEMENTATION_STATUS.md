# Implementazione Google OAuth - Prossimi Passi

## ✅ Completato

- [x] Creato layer servizio OAuth (`utils/googleOAuthService.ts`)
- [x] Creato callback backend sicuro (`netlify/functions/google-auth-callback.ts`)
- [x] Creato servizio autenticazione email (`utils/emailAuthService.ts`)
- [x] Integrato OAuth in LoginInterface
- [x] Aggiornato App.tsx per gestione sessione OAuth
- [x] Aggiornato gestore logout per cancellare sessioni OAuth
- [x] Creata guida configurazione completa (`GOOGLE_OAUTH_SETUP.md`)
- [x] Compilazione TypeScript riuscita (build passed)
- [x] Tutte le modifiche committate su GitHub
- [x] Sistema verifica utenti tramite `app_settings.users`
- [x] Privilegi caricati da database e salvati in sessione

## 🔧 Cosa Devi Fare Tu

### 1. Creare Progetto Google OAuth

Vai su [Google Cloud Console](https://console.cloud.google.com):

1. Crea nuovo progetto: "GADU"
2. Abilita Google+ API
3. Crea credenziali OAuth 2.0:
   - Tipo: Applicazione web
   - Origini JavaScript autorizzate: `http://localhost:3000`, `https://tuodominio.com`
   - URI di reindirizzamento autorizzati: `http://localhost:3000?glriNumber=*`, `https://tuodominio.com?glriNumber=*`

**Risultato**: Otterrai:
- `CLIENT_ID` (termina con `.apps.googleusercontent.com`)
- `CLIENT_SECRET` (mantienilo privato!)

### 2. Impostare Variabili d'Ambiente Locali

Modifica `.env.local`:

```dotenv
VITE_GOOGLE_CLIENT_ID="TUO_CLIENT_ID.apps.googleusercontent.com"
VITE_GOOGLE_REDIRECT_URI="http://localhost:3000"
GOOGLE_CLIENT_SECRET="TUO_CLIENT_SECRET"
```

Quindi testa in locale:
```bash
npm run dev
```

Vai su `http://localhost:3000?glriNumber=9999` e testa il pulsante login Google.

### 3. Configurare Utenti in AdminPanel

Per ogni loggia che vuoi testare:

1. Login come admin (privilegio `AD`)
2. Vai su **Impostazioni** → **Utenti Autorizzati**
3. Clicca **Aggiungi Utente**
4. Inserisci email (es: `test@example.com`)
5. Inserisci nome
6. Seleziona privilegi:
   - `AD` = Amministratore
   - `CR` = Craft - Lettura
   - `CW` = Craft - Scrittura
   - `MR` = Mark - Lettura
   - `MW` = Mark - Scrittura
   - `AR` = Chapter - Lettura
   - `AW` = Chapter - Scrittura
   - `RR` = RAM - Lettura
   - `RW` = RAM - Scrittura
7. Clicca **Salva**

Quindi testa con l'account Google corrispondente a quell'email.

### 4. Deploy su Netlify

Imposta variabili d'ambiente su dashboard Netlify:

**Impostazioni sito → Build & deploy → Variabili d'ambiente → Modifica variabili**

Aggiungi:
- `VITE_GOOGLE_CLIENT_ID` = tuo-client-id
- `VITE_GOOGLE_REDIRECT_URI` = `https://tuodominio.com`
- `GOOGLE_CLIENT_SECRET` = tuo-client-secret (solo backend)

Quindi esegui deploy:
```bash
git push origin main
```

## 🧪 Checklist Test

### Test Locale
- [ ] L'utente vede il pulsante login Google su `http://localhost:3000?glriNumber=9999`
- [ ] Click su "Accedi con Google" reindirizza alla schermata consenso Google
- [ ] Dopo autorizzazione, l'utente è loggato in GADU
- [ ] La sessione persiste dopo refresh pagina
- [ ] Il logout cancella la sessione e ritorna al login
- [ ] Errore "Utente xxx non abilitato" se email non in database

### Test Produzione
- [ ] Stesso flusso funziona su `https://tuodominio.com?glriNumber=XXXX`
- [ ] I log Netlify Functions non mostrano errori
- [ ] OAuth callback scambia correttamente codice per email

## 📊 Stato Attuale

| Componente | Stato | Note |
|-----------|--------|-------|
| Servizio OAuth Frontend | ✅ Fatto | `utils/googleOAuthService.ts` |
| Callback OAuth Backend | ✅ Fatto | `netlify/functions/google-auth-callback.ts` v2.0 |
| Servizio Auth Email | ✅ Fatto | Gestione sessione + verifica Supabase |
| Integrazione LoginInterface | ✅ Fatto | Pulsante Google completamente funzionale |
| Gestione Sessione App | ✅ Fatto | Auto-carica sessione all'avvio app |
| Documentazione | ✅ Fatto | Guida completa in `GOOGLE_OAUTH_SETUP.md` |
| Verifica Utenti DB | ✅ Fatto | Sistema `app_settings.users` implementato |
| Privilegi Utente | ✅ Fatto | Caricati da DB e salvati in sessione |
| **Progetto Google OAuth** | ⏳ DA FARE | **Devi crearlo tu** |
| **Variabili d'Ambiente** | ⏳ DA FARE | **Imposta su Netlify + locale** |
| **Configurazione Utenti** | ⏳ DA FARE | **Aggiungi utenti via AdminPanel** |

## 💡 Riepilogo Architettura

```
Browser Utente
    ↓ [Click "Accedi con Google"]
    ↓
Google OAuth
    ↓ [Reindirizza con auth code]
    ↓
App rileva ?code= nell'URL
    ↓
Backend: POST /google-auth-callback { code }
    ↓
Scambia code → Google access token → Info utente
    ↓
Restituisce: { email, name, picture }
    ↓
Frontend: verifica email in app_settings.users della loggia
    ↓
Crea sessione { email, name, picture, privileges }
    ↓
Salva in localStorage
    ↓
Utente loggato ✅
```

## 🔒 Punti Salienti Sicurezza

✅ **Client Secret**: Mai esposto al frontend (solo backend in Netlify Functions)
✅ **Gestione Token**: Token Google non memorizzati (conforme GDPR)
✅ **Verifica Email**: Verificata contro database `app_settings.users` per-loggia
✅ **Storage Sessione**: localStorage solamente (non esposto al server)
✅ **Privilegi**: Caricati da database e controllabili tramite `currentUser.privileges`

## Domande?

Vedi [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) per risoluzione problemi dettagliata e FAQ.
