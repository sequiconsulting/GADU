# GADU Multi-Tenant - Setup Guide

## 🎯 Panoramica

GADU supporta ora il **multi-tenant**: ogni loggia ha il proprio database Supabase isolato, accessibile tramite numero loggia.

## 🚀 Quick Start

### 1. Configurazione Ambiente

Crea `.env.local` con:

```bash
# Demo Mode
VITE_DEMO_LODGE_NUMBER="999"
VITE_DEMO_LODGE_NAME="Loggia Demo"
VITE_DEMO_PROVINCE="DEMO"
VITE_DEMO_SUPABASE_URL="your_demo_supabase_url"
VITE_DEMO_SUPABASE_ANON_KEY="your_demo_anon_key"

# Backend (solo per Netlify deploy)
REGISTRY_ENCRYPTION_KEY="generate-32-char-random-key"
```

### 2. Installazione Dependencies

```bash
npm install
```

Dependencies multi-tenant:
- `@netlify/blobs` - Registry storage
- `@netlify/functions` - Serverless backend
- `zod` - Validation

### 3. Sviluppo Locale

```bash
# Con Netlify Dev (raccomandato per testare functions)
netlify dev

# Oppure solo frontend
npm run dev
```

### 4. Login Flow

1. **Utente inserisce numero loggia** → Frontend chiama `/.netlify/functions/get-lodge-config`
2. **Sistema carica configurazione** → Riceve URL Supabase + anon key
3. **Inizializza dataService** → `dataService.initializeLodge(config)`
4. **OAuth login** → (TODO: Google OAuth)
5. **App caricata** → Accesso ai dati della loggia

## 📁 Struttura Files

```
.
├── netlify/
│   └── functions/
│       ├── _shared/
│       │   └── registry.ts          # Registry management
│       ├── get-lodge-config.ts      # GET lodge info
│       ├── setup-lodge.ts           # POST new lodge
│       ├── initialize-schema.ts     # POST schema setup
│       └── manage-supabase-users.ts # User CRUD
├── services/
│   ├── dataService.ts               # Dynamic Supabase client
│   ├── lodgeRegistry.ts             # Lodge lookup service
│   └── demoModeService.ts           # Demo mode handler
├── components/
│   └── LoginInterface.tsx           # Login UI
├── types/
│   └── lodge.ts                     # Lodge types
└── supabase-schema.sql              # Updated RLS policies
```

## 🔐 Security Model

### RLS Policies

- **Authenticated users**: Full access (SELECT, INSERT, UPDATE, DELETE)
- **Anon users**: Full access (solo per demo mode)
- **Controlli UI-side**: Gestiti in `AppSettings.users` con privileges

### Multi-Tenancy Isolation

Ogni loggia ha:
- **DB Supabase dedicato** (URL diverso)
- **Anon key separata**
- **Service key backend-only** (non esposta al client)

## 🧪 Testing

### Test Demo Mode

1. Avvia `npm run dev`
2. Click "Modalità Demo"
3. Verifica accesso con dati esempio

### Test Lodge Lookup

1. Registra una loggia test tramite `/setup`
2. Inserisci numero loggia
3. Verifica caricamento configurazione

### Test Backend Functions

```bash
# GET lodge config
curl http://localhost:8888/.netlify/functions/get-lodge-config?number=105

# POST setup lodge (example)
curl -X POST http://localhost:8888/.netlify/functions/setup-lodge \
  -H "Content-Type: application/json" \
  -d '{
    "glriNumber": "105",
    "lodgeName": "I Lapicidi",
    "province": "AN",
    "supabaseUrl": "https://xxx.supabase.co",
    "supabaseAnonKey": "eyJ...",
    "supabaseServiceKey": "eyJ..."
  }'
```

## 📝 TODO

### Completare Implementazione

- [ ] **OAuth Google**: Implementare flow completo in `LoginInterface.tsx`
- [ ] **Setup Wizard**: Creare UI completa 7-step setup
- [ ] **User Management**: Integrare con Supabase Auth
- [ ] **Privilege Guards**: Aggiungere controlli UI basati su permissions
- [ ] **Migration System**: Auto-check schema version + modal upgrade
- [ ] **Error Handling**: Migliori messaggi errore + retry logic

### Deployment Netlify

1. **Push to repo**
2. **Connect to Netlify**
3. **Set environment variables**:
   - `REGISTRY_ENCRYPTION_KEY`
   - `VITE_DEMO_*` (se demo mode abilitato)
4. **Enable Netlify Blobs** in site settings
5. **Deploy!**

## 🐛 Troubleshooting

| Problema | Soluzione |
|----------|-----------|
| "Supabase not initialized" | Assicurati di chiamare `initializeLodge()` prima di usare dataService |
| "Function not found" | Verifica `netlify.toml` + riavvia `netlify dev` |
| "Lodge not found" | Registra la loggia via `/setup` o controlla registry |
| CORS errors | Le functions sono same-origin, controlla URL chiamata |

## 📚 Risorse

- [Netlify Functions Docs](https://docs.netlify.com/functions/overview/)
- [Netlify Blobs Docs](https://docs.netlify.com/blobs/overview/)
- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)

---

**Status**: ✅ Core implementation completa  
**Next**: Setup Wizard UI + OAuth integration
