# Sistema di Autenticazione e Autorizzazioni (Preparato)

## Stato Attuale

Il sistema di autenticazione e autorizzazioni è **completamente preparato** ma **disattivato**. 

**Flag di attivazione:** `NETLIFY_AUTH_ENABLED` in `utils/authService.ts` (linea 10)

Per attivare quando pronto:
```typescript
const NETLIFY_AUTH_ENABLED = true; // Change to true when ready
```

## Struttura del Sistema

### 1. **Tipi di Dati** (`types.ts`)

**UserPrivilege** - 9 privilegi granulari:
- `AD` - Admin: accesso totale, gestione utenti, modifica impostazioni
- `CR` - Craft Read: lettura sola Craft
- `MR` - Mark Read: lettura sola Marchio
- `AR` - Ark Read: lettura sola Capitolo/Arco
- `RR` - RAM Read: lettura sola RAM
- `CW` - Craft Write: lettura e modifica Craft
- `MW` - Mark Write: lettura e modifica Marchio
- `AW` - Ark Write: lettura e modifica Capitolo/Arco
- `RW` - RAM Write: lettura e modifica RAM

**AppUser**:
```typescript
interface AppUser {
  id: string;
  email: string;
  name: string;
  privileges: UserPrivilege[];
  createdAt: string;
  updatedAt: string;
}
```

### 2. **Servizi di Autenticazione** (`utils/authService.ts`)

Gestisce l'integrazione con **Netlify Identity**:
- `initializeNetlifyAuth()` - Inizializza (se abilitato)
- `getCurrentUser()` - Ottiene utente loggato
- `openNetlifyLogin()` / `logoutNetlify()` - Gestione sessione
- `getNetlifyToken()` - Token JWT per API
- `isAuthenticationEnabled()` - Verifica se auth è attiva

### 3. **Servizi di Autorizzazione** (`utils/permissionChecker.ts`)

9 funzioni di controllo permessi:
- `canAdminister(user)` - Verifica privilegio AD
- `canReadBranch(user, branch)` - Verifica lettura ramo
- `canWriteBranch(user, branch)` - Verifica modifica ramo
- `canViewAdminPanel(user)` - Verifica accesso admin
- `canManageUsers(user)` - Verifica gestione utenti
- `canCreateMember(user)` - Verifica creazione anagrafica
- `canModifyMemberBranch(user, branch)` - Verifica modifica anagrafica per ramo
- `canDeleteMember(user)` - Verifica eliminazione anagrafica
- `canChangeRitual(user)` - Verifica modifica rituali
- `canViewReports(user)` - Verifica visualizzazione report
- `getReadableBranches(user)` - Lista rami leggibili
- `getWritableBranches(user)` - Lista rami modificabili
- `getPermissionSummary(user)` - Summary debug

### 4. **Gestione Utenti** (`components/UserManagement.tsx`)

Componente in `AdminPanel` per:
- Visualizzare lista utenti (sola lettura se non admin)
- Aggiungere nuovi utenti (solo admin)
- Modificare privilegi (solo admin)
- Eliminare utenti (solo admin)

Integrato in `AdminPanel.tsx` con tab "Gestione Utenti".

### 5. **AppSettings**

La tabella `settings/appSettings` su Firestore ora include:
```typescript
users?: AppUser[]; // Lista di utenti e privilegi
```

## Flusso di Attivazione

Quando `NETLIFY_AUTH_ENABLED = true`:

1. **Su App.tsx:**
   - Decomment import Auth0 e permissionChecker
   - Aggiungi guard iniziale: mostri LoginPage se nessun utente loggato
   - Passa user a componenti che ne hanno bisogno

2. **Su Componenti:**
   - MemberDetail: controlla `canModifyMemberBranch()` per ogni ramo
   - RoleAssignment: controlla `canWriteBranch()` per ramo attivo
   - AdminPanel: controlla `canModifyAdminSettings()`
   - Piedilista/RolesReport: nasconde rami non leggibili

3. **Su App.tsx BRANCHES rendering:**
   - Filtra BRANCHES basato su `getReadableBranches(currentUser)`
   - Nascondi tab RAM se user non ha RR/RW

## Esempio di Utilizzo (Quando Attivato)

```typescript
// In App.tsx
const currentUser: AppUser | null = getCurrentUser();
if (!currentUser && NETLIFY_AUTH_ENABLED) {
  return <LoginPage />;
}

// Nei componenti
if (!canWriteBranch(currentUser, 'CRAFT')) {
  return <div>Non hai permesso di modificare Craft</div>;
}

// Filtra branches visibili
const visibleBranches = BRANCHES.filter(b => 
  canReadBranch(currentUser, b.type)
);
```

## Esempio di Privilegi Utente

**Admin:**
- Privilegi: `['AD']`
- Accesso: tutto, gestisce utenti

**Manager Craft sola lettura:**
- Privilegi: `['CR']`
- Accesso: legge Craft, accede report

**Manager Marchio completo:**
- Privilegi: `['MW']`
- Accesso: legge e modifica Marchio, crea/modifica anagrafiche in Marchio

**Manager Multi-ramo:**
- Privilegi: `['CW', 'MR', 'AR']`
- Accesso: modifica Craft, legge Marchio e Capitolo, non vede RAM

## Prossimi Passi per Attivazione

1. Abilitare `NETLIFY_AUTH_ENABLED = true` in `authService.ts`
2. Configurare Netlify Identity (https://app.netlify.com/sites/[SITE]/identity)
3. Aggiungere form LoginPage che richiama Netlify
4. Aggiungere guard in App.tsx per redirigere a login
5. Passare `currentUser` a componenti che ne hanno bisogno
6. Testare permessi su ogni componente
7. Configurare Firestore rules per controllare accesso lato server

## File Coinvolti

**Nuovi file:**
- `utils/authService.ts` - Autenticazione Netlify
- `utils/permissionChecker.ts` - Controllo autorizzazioni
- `components/UserManagement.tsx` - Gestione utenti

**File Modificati:**
- `types.ts` - Aggiunti UserPrivilege, AppUser, NetlifyIdentityUser
- `components/AdminPanel.tsx` - Integrato UserManagement con tab

**File Da Modificare (quando attivare):**
- `App.tsx` - Aggiungi guard e passa user ai componenti
- `components/MemberDetail.tsx` - Controlla canModifyMemberBranch
- `components/RoleAssignment.tsx` - Controlla canWriteBranch
- `components/Piedilista.tsx` - Filtra branches leggibili
- `components/RolesReport.tsx` - Filtra branches leggibili
- Firestore rules - Controllo accesso server-side

## Note Importanti

- **Non attivo adesso:** Tutti i controlli sono preparati ma non applicati
- **Flag di controllo:** Unica modifica necessaria per attivare è `NETLIFY_AUTH_ENABLED`
- **Backwards compatible:** Senza autenticazione, funziona come adesso (accesso totale)
- **Database versioning:** Incrementare `DB_VERSION` quando aggiungere campo `users` a AppSettings
