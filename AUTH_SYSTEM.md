# Sistema di Autenticazione e Autorizzazioni (Supabase – Preparato)

## Stato Attuale

Il sistema di autenticazione/autorizzazione è pronto ma **disattivato**.

- **Feature flag:** `SUPABASE_AUTH_ENABLED` in `utils/authService.ts`
- **Versione schema auth:** `SUPABASE_AUTH_SCHEMA_VERSION` (gestisce il campo `gadu_schema_version` su Supabase user_metadata)
- **Env richieste (quando si attiva):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Struttura del Sistema

### 1. Tipi di Dati (`types.ts`)

- `UserPrivilege` (9 privilegi granulari: AD, CR, CW, MR, MW, AR, AW, RR, RW)
- `AppUser` (gestito in Supabase dentro `app_settings.data.users`)
- `SupabaseAuthUser` (forma minima letta da Supabase, include `app_metadata`/`user_metadata` con `gadu_schema_version`)

### 2. Servizio di Autenticazione (`utils/authService.ts`)

- Supabase client lazy, **disattivato** se `SUPABASE_AUTH_ENABLED = false`
- `initializeSupabaseAuth()` – inizializza listener e cache di sessione
- `getCurrentUser()`, `getSupabaseToken()` – leggono utente/token solo se il flag è attivo
- Schema tracking: `getAuthSchemaVersion()`, `needsAuthSchemaMigration()`, `markAuthSchemaVersion()` (scrive `gadu_schema_version` su user_metadata)
- Helper flag: `isAuthenticationEnabled()`
- Helper utente locale: `createUser`, `updateUserPrivileges`, `deleteUser`, `findUserByEmail`, `getUserPrivileges`

### 3. Servizi di Autorizzazione (`utils/permissionChecker.ts`)

Funzioni per verificare lettura/scrittura per ramo, amministrazione, gestione utenti e rituali. Nessun controllo è applicato finché l’auth resta disattivata.

### 4. Gestione Utenti (`components/UserManagement.tsx`)

UI per CRUD utenti memorizzati in Supabase (`AppSettings.users`). Mostra changelog locale e supporta privilegi granulari.

### 5. Auth Context (`contexts/AuthContext.tsx`)

Provider React preparato che legge user/token/schema quando il flag è attivo. Attualmente non montato in `App.tsx`.

## Flusso di Attivazione (quando pronto)

1. Impostare `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
2. Impostare `SUPABASE_AUTH_ENABLED = true` in `utils/authService.ts`.
3. Montare `AuthProvider` in `index.tsx`/`App.tsx` e aggiungere una pagina di login (email OTP/OAuth a scelta).
4. Passare `user`/`token` ai componenti che devono proteggere le operazioni.
5. Applicare i check di `permissionChecker` in MemberDetail/RoleAssignment/AdminPanel/Report.
6. Eseguire `markAuthSchemaVersion()` dopo eventuali migrazioni di metadata utenti.
7. Aggiornare le policy RLS di Supabase se si abilita l’auth lato backend.

## Note

- **Disattivato di default:** nessun blocco viene applicato finché il flag resta false.
- **Compatibilità:** il resto dell’app continua a funzionare senza Supabase.
- **Versioning:** tenere `SUPABASE_AUTH_SCHEMA_VERSION` allineato quando cambiano le claim utente; `DB_VERSION` resta per lo schema applicativo su Supabase.
