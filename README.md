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
5. OAuth login (TODO: Google OAuth)
6. App caricata con dati della loggia

### Deployment Netlify

1. Push repo su GitHub/GitLab
2. Connetti a Netlify
3. **Genera chiave di cifratura** (32 byte = 64 caratteri hex):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
4. Imposta variabili d'ambiente su Netlify:
   - Vai su **Site configuration → Environment variables**
   - Aggiungi: `REGISTRY_ENCRYPTION_KEY` = (la chiave generata al punto 3)
   - ⚠️ **IMPORTANTE**: Salva questa chiave in modo sicuro! Senza di essa non potrai decifrare il registry
5. Abilita **Netlify Blobs** nelle impostazioni del sito:
   - Vai su **Integrations → Netlify Blobs → Enable**
6. Deploy!

**Nota sulla cifratura**: Il registry in produzione viene cifrato con AES-256-GCM prima di essere salvato su Netlify Blobs. In sviluppo locale, i dati rimangono in chiaro nel file `.netlify/registry.json` (gitignored).

### Funzioni Backend

- **`get-lodge-config`** – Restituisce config Supabase per numero loggia
- **`setup-lodge`** – Registra nuova loggia nel registry cifrato
- **`initialize-schema`** – Inizializza schema Supabase per nuova loggia
- **`manage-supabase-users`** – CRUD utenti (da implementare con Auth)

---

## 🔐 Autenticazione

GADU utilizza **Google OAuth centralizzato** per tutte le logge, con verifica email per-loggia in Supabase.

### Google OAuth Setup

Per abilitare Google OAuth:

1. Crea un progetto Google OAuth (vedi [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md))
2. Imposta variabili d'ambiente:
   - **Frontend**: `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_REDIRECT_URI`
   - **Backend**: `GOOGLE_CLIENT_SECRET`
3. Per ogni loggia, configura utenti verificati in Supabase auth
4. Utenti con email verificata possono accedere tramite Google

### Architettura Autenticazione

- **Centralized**: Un unico Google OAuth Project serve tutte le logge
- **Secure**: Client secret non esposto al frontend (backend-only)
- **Email-only**: Solo email ritornata al client (GDPR compliant)
- **Per-lodge verification**: Email verificata contro Supabase di ogni loggia
- **Session-based**: Sessioni salvate in localStorage

Per dettagli completi, vedi [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md).

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
| `AD` | Admin (config loggia) |
| `CR` | Read membri |
| `CW` | Write membri |
| `MR` | Read admin panel |
| `MW` | Write admin panel |
| `AR` | Read report |
| `AW` | Write report |
| `RR` | Read ruoli |
| `RW` | Write ruoli |

### Attivazione (quando pronto)

1. Imposta env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
2. In `utils/authService.ts` → `SUPABASE_AUTH_ENABLED = true`
3. Monta `AuthProvider` in `index.tsx`
4. Aggiungi pagina login (email OTP/OAuth)
5. Applica controlli di `permissionChecker` nei componenti protetti
6. Aggiorna policy RLS Supabase per auth lato backend

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
- **DB_VERSION** – Versione dati (`Member`, `AppSettings`), solo se cambia la struttura
- **SUPABASE_SCHEMA_VERSION** – Versione tabelle SQL, bump se cambia schema
- **SUPABASE_AUTH_SCHEMA_VERSION** – Versione metadata auth, bump se cambiano claim utente

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

**Stato**: ✅ Multi-tenant core implementato | ⏳ Setup Wizard e OAuth in TODO
