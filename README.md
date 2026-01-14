# GADU - Gestione Associazioni Decisamente User-friendly

<div align="center">

![GADU](https://img.shields.io/badge/GADU-Masonic%20Lodge%20Management-gold?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-96.3%25-3178c6?style=flat-square)
![React](https://img.shields.io/badge/React-19.2.0-61dafb?style=flat-square)
![Supabase](https://img.shields.io/badge/Supabase-2.48.0-3ecf8e?style=flat-square)
![Vite](https://img.shields.io/badge/Vite-6.2.0-646cff?style=flat-square)

Sistema moderno multi-tenant per la gestione di logge massoniche, con supporto per più rami (Azzurra, Marca, Capitolo, R.A.M.), ruoli, gradi e reportistica.

[Funzionalità](#-funzionalità) • [Quick Start](#-quick-start) • [Multi-Tenant](#-multi-tenant) • [Autenticazione](#-autenticazione)

</div>

---

## 📖 Panoramica

**GADU** è un sistema completo di gestione associativa per logge massoniche. Permette di:

- Gestire membri su quattro rami (Craft Lodge, Mark, Chapter, Royal Arch Mariner)
- Tracciare gradi, status e storia dei membri
- Assegnare ruoli (cariche) per anno massonico e rituale
- Generare report (piedilista, organigramma, relazione annuale)
- Gestire tornate/convocazioni per ramo
- Modalità multi-tenant: ogni loggia ha il proprio database Supabase isolato

---

## ✨ Funzionalità

### 👥 Gestione Membri
- Database completo con dati anagrafici e numero matricola
- Tracking gradi e status per ogni ramo
- Storico eventi (iniziazione, elevazione, esaltazione, passaggi di grado)
- Ricerca e filtri per nome, matricola, ramo, stato
- Membri attivi/inattivi per anno

### 🏢 Struttura Organizzativa
- Supporto 4 rami: Azzurra, Marca, Capitolo, R.A.M.
- Gestione cariche (ruoli) con rituale specifico (Emulation/RSAA/altro)
- Report ruoli per ramo e anno massonico
- Storico completo gradi e cariche

### 📊 Report e Statistiche
- Dashboard con overview membri per ramo
- Piedilista dettagliato per grado
- Organigramma cariche
- Relazione annuale
- Supporto stampa per tutti i report

### ⚙️ Amministrazione
- Configurazione loggia (nome, numero, provincia)
- Gestione utenti con privilegi granulari (9 tipi: lettura/scrittura per membri/admin/report/ruoli, gestione rituali)
- Legenda gradi e UI
- Import/export dati

### 📱 UX
- Responsive (desktop, tablet, mobile)
- Navigazione sidebar dark
- Interfaccia accessibile e keyboard-friendly

---

## 🚀 Quick Start

### Prerequisiti
- Node.js 18+
- npm 8+ (o yarn/pnpm)
- Account Supabase (o modalità demo locale)

### Installazione

```bash
git clone https://github.com/sequiconsulting/GADU.git
cd GADU
npm install
```

### Setup Supabase

1. Crea un progetto Supabase
2. Esegui `supabase-schema.sql` nell'editor SQL di Supabase
3. Configura le variabili d'ambiente (vedi sotto)
4. Avvia l'app: al primo lancio, i dati demo vengono auto-seed se le tabelle sono vuote

**Tabelle**:
- `app_settings` (singleton): configurazione, versioni DB/schema, utenti
- `members` (JSONB): ogni membro con dati per tutti i rami
- `convocazioni` (JSONB): tornate/meeting per ramo e anno

---

## 🏛️ Multi-Tenant

GADU supporta **multi-tenant**: ogni loggia ha il proprio database Supabase isolato, accessibile tramite numero loggia.

### Architettura

- **Frontend** – Interfaccia unica per tutte le logge
- **Netlify Functions** – Backend serverless per lookup logge e setup
- **Netlify Blobs** – Registry cifrato che mappa numero loggia → config Supabase
- **Supabase** – Database dedicato per ogni loggia (URL e anon key separati)

### Login Flow

1. Utente inserisce **numero loggia**
2. Frontend chiama `/.netlify/functions/get-lodge-config?number=XXX`
3. Backend restituisce URL Supabase + anon key
4. Frontend inizializza `dataService.initializeLodge(config)`
5. Login con link magico Supabase
6. App caricata con dati della loggia

### Deployment Netlify

1. Push repo su GitHub/GitLab
2. Connetti a Netlify
3. **Genera chiavi quantistiche e master key**:
  ```bash
  npx tsx scripts/generate-quantum-keys.ts
  ```
  - Carica in automatico su Netlify le env: `KYBER_PUBLIC_KEY`, `RSA_PUBLIC_KEY_B64`, `QUANTUM_MASTER_KEY`
  - Crea/aggiorna il blob `quantum-keys/private-keys` (chiavi private cifrate con master key)
4. Abilita **Netlify Blobs** (Site settings → Integrations → Netlify Blobs → Enable)
5. **Cifra e carica il registry demo (loggia 9999)**:
  ```bash
  npx tsx scripts/migrate-registry-to-prod.ts
  netlify blobs:set gadu-registry lodges --input .netlify/registry-encrypted.txt
  ```
  (in alternativa: `npx tsx scripts/upload-registry-blob.ts .netlify/registry-encrypted.txt` con `REGISTRY_UPLOAD_TOKEN` + `SITE_URL`)
6. Deploy!

**Nota sulla cifratura**: In produzione il registry usa cifratura ibrida post-quantum (ML-KEM-768 + RSA-4096 + AES-256-GCM) in formato `v2:kyber_ciphertext:rsa_encrypted_key:iv:authTag:aes_data`. In sviluppo locale (`NETLIFY_DEV`) il registry resta in chiaro nel file `.netlify/registry.json` (gitignored).

### 🔒 Cifratura registry (produzione)
- **Chiavi pubbliche**: `KYBER_PUBLIC_KEY`, `RSA_PUBLIC_KEY_B64` (env Netlify)
- **Chiavi private**: blob `quantum-keys/private-keys` cifrato con `QUANTUM_MASTER_KEY` (AES-256-GCM)
- **Registry cifrato**: blob `gadu-registry/lodges` in formato v2 (quantum-hybrid)
- **Script utili**:
  - `scripts/generate-quantum-keys.ts` → genera chiavi, aggiorna env, carica blob chiavi private
  - `scripts/migrate-registry-to-prod.ts` → cifra il registry locale (solo loggia 9999 di default)
  - `scripts/upload-registry-blob.ts` → upload del registry cifrato via HTTP function
- **Locale**: cifratura disabilitata, usa `.netlify/registry.json` in chiaro; le chiavi sono in `.netlify/quantum-keys.json` (gitignored)

### Funzioni Backend

- **`get-lodge-config`** – Restituisce config Supabase per numero loggia
- **`setup-lodge`** – Registra nuova loggia nel registry cifrato
- **`initialize-schema`** – Inizializza schema Supabase per nuova loggia
- **`manage-supabase-users`** – CRUD utenti (da implementare con Auth)

---

## 🔐 Autenticazione

GADU utilizza **autenticazione email + password Supabase** con privilegi memorizzati in **user_metadata**:

- L'utente inserisce email e password nel form di login.
- Se le credenziali sono valide e l'utente ha privilegi configurati in `user_metadata`, l'accesso è consentito.
- I privilegi GADU (`AD`, `CR`, `CW`, etc.) sono salvati in `user.user_metadata.privileges`.
- Le sessioni si auto-rinfrescano con i token Supabase e vengono salvate nel browser.
- **Single source of truth**: solo Supabase Auth users, nessun doppione in `app_settings`.

### Gestione Utenti

Gli utenti vengono creati tramite **Supabase Admin API** (service key):
- Netlify Function `manage-supabase-users` con actions:
  - `create`: Crea utente con email, password, nome e privilegi
  - `updatePassword`: Modifica password utente esistente
  - `updatePrivileges`: Modifica nome e privilegi utente
  - `delete`: Elimina utente

### Struttura user_metadata

```json
{
  "name": "Mario Rossi",
  "privileges": ["AD", "CR", "CW"]
}
```

Requisiti:
- Variabili per ogni loggia nel registry Netlify: `supabaseUrl`, `supabaseAnonKey`.
- **SECURITY**: `supabaseServiceKey` e `databasePassword` esistono SOLO nel registry backend (Netlify Blobs), mai esposti al client.

---

#### Solo Frontend (senza Netlify Functions)

Se usi `npm run dev` (Vite diretto), le Netlify Functions non saranno disponibili.
Per simulare il registry in locale, viene usato un file `.netlify/registry.json`:

```json
{
  "9999": {
    "glriNumber": "9999",
    "lodgeName": "Loggia Demo",
    "province": "DEMO",
    "supabaseUrl": "https://your-demo-project.supabase.co",
    "supabaseAnonKey": "your_anon_key"
  }
}
```

Questo file viene letto automaticamente in locale dalle Netlify Functions quando non sei su Netlify.
Per aggiungere altre logge di test, aggiungi semplicemente altri oggetti nel registry.

**Nota**: Il file `.netlify/registry.json` è locale e non viene commitato (è in `.gitignore`). In produzione, il registry usa Netlify Blobs cifrato.

---

## 🔐 Autenticazione

Il sistema di autenticazione Supabase è **preparato ma disattivato** di default.

### Componenti

- **`utils/authService.ts`** – Client Supabase lazy, feature flag `SUPABASE_AUTH_ENABLED`
- **`utils/permissionChecker.ts`** – Controlli lettura/scrittura per membri/admin/report/ruoli/rituali
- **`contexts/AuthContext.tsx`** – Provider React (non montato)
- **`components/UserManagement.tsx`** – UI gestione utenti con privilegi granulari

### Privilegi (9 tipi)

| Codice | Significato |
|--------|-------------|
| `AD` | Amministratore (configurazione loggia e utenti) |
| `CR` | Craft - Lettura (visualizza membri Craft) |
| `CW` | Craft - Scrittura (modifica membri Craft) |
| `MR` | Mark - Lettura (visualizza membri Mark) |
| `MW` | Mark - Scrittura (modifica membri Mark) |
| `AR` | Chapter - Lettura (visualizza membri Chapter) |
| `AW` | Chapter - Scrittura (modifica membri Chapter) |
| `RR` | RAM - Lettura (visualizza membri Royal Ark Mariner) |
| `RW` | RAM - Scrittura (modifica membri Royal Ark Mariner) |

### Attivazione (quando pronto)

1. Imposta env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
2. Crea utenti con Netlify Function `manage-supabase-users` (usa service key server-side)
3. Login con email + password tramite `LoginInterface.tsx`
4. Le sessioni vengono gestite automaticamente da Supabase Auth
5. I privilegi sono verificati in `app_settings.users` dopo il login
6. (Opzionale) Aggiorna policy RLS Supabase per restrizioni lato backend

---

## 🛠️ Sviluppo

### Comandi

```bash
npm run dev       # Dev server Vite (porta 3000)
npm run build     # Compila per produzione
npm run preview   # Preview build locale
netlify dev       # Dev server con Netlify Functions
```

### Struttura Progetto

```
.
├── components/           # UI components (MemberDetail, RolesReport, ecc.)
├── contexts/             # React contexts (Auth)
├── netlify/functions/    # Backend serverless
├── services/             # Data layer (dataService, lodgeRegistry)
├── types/                # TypeScript types
├── utils/                # Auth e permission checkers
├── App.tsx               # Main app (9 views, navigation, state)
├── types.ts              # Domain model
├── constants.ts          # Branch config, gradi, ruoli
├── supabase-schema.sql   # Bootstrap SQL
└── .env.local            # Variabili locali (gitignored)
```

### Versioning

Ogni modifica al codice richiede bump di `APP_VERSION` in `services/dataService.ts`.

- **APP_VERSION** – Versione UI/logica (bump sempre)
- **DB_VERSION** – Versione schema dati (Member/AppSettings JSON), bump solo se cambia struttura

### Task Comuni

| Task | File da modificare |
|------|-------------------|
| Aggiungere campo membro | `types.ts`, `MemberDetail.tsx`, `dataService.ts` |
| Aggiungere grado/ruolo | `constants.ts`, `HistoryEditor.tsx` o `RoleEditor.tsx` |
| Aggiungere ramo | `types.ts`, `constants.ts`, `MemberDetail.tsx`, `dataService.ts` |
| Nuova vista | `App.tsx` (case View), creare `components/NomeVista.tsx` |
| Modifica rituale | `constants.ts`, `types.ts` (AppSettings), `RoleAssignment.tsx` |

---

## 📚 Stack Tecnologico

- **React** 19.2.0 – UI library
- **TypeScript** 5.8.x – Type safety
- **Vite** 6.2.x – Build tool
- **Supabase** 2.48.x – Backend (Postgres + Storage)
- **Tailwind CSS** – Styling
- **Lucide React** – Icons
- **Netlify Functions** – Serverless backend
- **Netlify Blobs** – Registry storage
- **Zod** – Validation

---

## 🐛 Troubleshooting

| Problema | Soluzione |
|----------|-----------|
| "Supabase not initialized" | Chiama `initializeLodge()` prima di usare `dataService` |
| Tabelle non trovate | Esegui `supabase-schema.sql` nel SQL editor Supabase |
| Function non trovata (Netlify) | Verifica `netlify.toml`, riavvia `netlify dev` |
| Loggia non trovata | Registra via `/setup` o verifica registry |
| Version mismatch | L'app auto-sync al lancio; controlla console per dettagli |

---

## 🤝 Contributing

Contributi benvenuti! Assicurati di:

1. Bumppare `APP_VERSION` per ogni modifica
2. Aggiornare test e documentazione
3. Seguire convenzioni TypeScript/React del progetto
4. Testare in modalità demo prima di committare

---

## 📄 Licenza

MIT License - vedi LICENSE file per dettagli.

---

**Stato**: ✅ Multi-tenant core implementato | ✅ Autenticazione email+password | ⏳ Setup Wizard in TODO
