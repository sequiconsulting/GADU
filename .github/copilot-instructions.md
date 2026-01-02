# GADU Copilot Instructions

## Project Overview

GADU (Gestione Associazioni Decisamente User-friendly) is a membership management system for Masonic lodges built with React, TypeScript, Supabase, and Vite. It manages members across four branches (Craft, Mark, Chapter, Royal Ark Mariner) with degree tracking, role assignments, convocazioni, and reporting.

## Architecture

- **App.tsx** – Main component managing view state (9 views), navigation, year selection, and member/settings lifecycle
- **types.ts** – Domain model: Member, MasonicBranchData, OfficerRole, DegreeEvent, StatusEvent, Convocazione, AppSettings
- **constants.ts** – Branch definitions, degree hierarchies (Italian), role templates, and utility functions
- **services/dataService.ts** – Supabase data layer (tables: app_settings, members, convocazioni); enforces APP_VERSION/DB_VERSION/SUPABASE_SCHEMA_VERSION, ensures schema presence, seeds demo data when tables are empty
- **supabase-schema.sql** – SQL bootstrap for tables and permissive RLS (run once in Supabase SQL editor)
- **index.tsx** – React entry point with strict mode

## Component Organization

Function components accept data + callbacks (no direct Supabase calls):
- MemberDetail – Multi-branch form with profile/degree/role tabs; matricola uniqueness validation
- HistoryEditor – Manages statusEvents and degrees for a branch
- RoleEditor – Manages roles with year/branch/date tracking
- RolesReport – Role matrix view by branch
- RoleAssignment – Bulk role assignment UI with ritual handling
- Piedilista – Member roster by degree/branch (reports view)
- InactiveMembers – Filters members by activity in selected year
- AdminPanel – Settings editor for lodge name/number/province/preferences
- Legend – Reference display for degrees and UI conventions
- Tornate – CRUD for convocazioni

## Data Flow

1. Load: App calls dataService.getMembers() and dataService.getSettings() on mount.
2. Edit: Components update state and return changes via callbacks to the parent.
3. Save: dataService.saveMember/saveSettings/saveConvocazione upsert to Supabase; loadData() refreshes UI after success.
4. Filter: App applies searchTerm and filterBranch before passing members to views.

## Development Workflow

npm install                 # Install deps (React 19.2, Supabase JS 2.48, Vite 6.2, TS 5.8)
npm run dev                 # Start Vite dev server on port 3000
npm run build               # Compile to dist/
npm run preview             # Serve built dist locally

Supabase env required: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (NEXT_PUBLIC_* fallbacks supported). Run supabase-schema.sql once, then launch the app to auto-seed demo data and sync versions.

## Version Management

Every code change must bump APP_VERSION in services/dataService.ts.

- APP_VERSION – UI/display version; bump for any UI/logic change.
- DB_VERSION – Data model version for Member/AppSettings; bump only when shapes change. Stored in app_settings.db_version and auto-synced on startup.
- SUPABASE_SCHEMA_VERSION – Table/layout version; bump when the SQL schema changes. Keep supabase-schema.sql in sync.

## Database Migrations (Automatic & Incremental)

**CRITICAL: All schema changes MUST be applied automatically by code using incremental migrations.**

When modifying the database schema:

1. **Always bump DB_VERSION** in services/dataService.ts when making schema changes
2. **Maintain two SQL artifacts in dataService.ts:**
   - `BASELINE_SCHEMA_SQL` – Complete clean-slate schema for latest version (tables, indexes, RLS policies)
   - `DB_MIGRATIONS` map – Incremental SQL for each version step (e.g., v12→v13, v13→v14)
3. **Each migration step must be idempotent** – Use `IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `ALTER TABLE IF EXISTS`, etc.
4. **Migration execution is automatic** – On app startup, if current db_version < DB_VERSION, dataService runs all missing migrations in sequence via direct postgres connection (service key required)
5. **Service key is mandatory** – Migrations use pg library to connect directly to postgres (port 5432); fail with clear error if service key unavailable
6. **Update both artifacts** when changing schema:
   - Update BASELINE_SCHEMA_SQL to reflect the new clean state
   - Add new entry to DB_MIGRATIONS for the version increment (e.g., `DB_MIGRATIONS[13] = "ALTER TABLE..."`)
7. **Version tracking** – After each migration step, app_settings.db_version is updated, allowing safe resume after interruption
8. **Keep supabase-schema.sql in sync** – This file should match BASELINE_SCHEMA_SQL for manual reference/emergency bootstrap

Example workflow for adding a column:
- Bump DB_VERSION from 13 to 14
- Update BASELINE_SCHEMA_SQL to include new column in CREATE TABLE
- Add `DB_MIGRATIONS[13] = "ALTER TABLE members ADD COLUMN IF NOT EXISTS new_field text;"`
- Update supabase-schema.sql to match BASELINE_SCHEMA_SQL
- Bump APP_VERSION

**Never require manual SQL execution** – The system must handle all upgrades automatically from any version to any other version.

## Key Files for Common Tasks

| Task | File(s) |
|------|---------|
| Add member field | types.ts (Member), components/MemberDetail.tsx, services/dataService.ts (seed/validation if needed) |
| Add degree/role | constants.ts (DEGREES/COMMON_ROLES), components/HistoryEditor.tsx or RoleEditor.tsx |
| Add branch | types.ts (BranchType), constants.ts, MemberDetail.tsx, dataService.ts (initialize empty branch) |
| New view/page | App.tsx (add View case), create components/ViewName.tsx |
| UI styling | Tailwind classes in components; custom colors in index.html or style.css |
| Ritual support | Update constants.ts types/labels/role arrays, types.ts AppSettings, RoleAssignment.tsx, RolesReport.tsx |
| Convocazioni | components/Tornate.tsx, services/dataService.ts (convocazioni helpers), types.ts |
| Supabase schema | supabase-schema.sql, ensure SUPABASE_SCHEMA_VERSION matches |

## Critical Workflows

- Year navigation & refresh: selectedYear drives views; arrow buttons increment/decrement by 1. loadData() reloads members/settings after saves. Do not Math.max/Math.min yearOptions; adjust from selectedYear.
- Member save: MemberDetail.handleSave() -> dataService.saveMember(); on success triggers parent loadData() and returns to returnView.
- Ritual change (RoleAssignment): Clicking "Modifica Rituale" unlocks dropdown; confirmation modal warns that all roles for that branch/year will be deleted; on confirm, ritual is saved and roles cleared for that branch/year, then parent reloads.
- Convocazioni: Tornate manages CRUD per branch/year via dataService helpers; error messaging assumes Supabase tables and RLS are present.

## Patterns & Conventions

- Branch data accessed by lowercase key: const branchKey = branch.toLowerCase().
- Roles keyed by yearStart (civil year); UI shows calculateMasonicYearString(yearStart).
- Validation uses async checks with Italian error messages.
- Print styles live in index.html (@media print) plus print: Tailwind classes in report components.
- Ritual selection per year stored in AppSettings.yearlyRituals; use getRolesForRitual(branch, ritual).

## External Dependencies

- React 19.2.0
- @supabase/supabase-js 2.48.x
- Vite 6.2.x
- TypeScript 5.8.x
- Lucide React
- @faker-js/faker (demo data)

## Supabase & Seeding

- Tables: app_settings (singleton), members (JSONB), convocazioni (JSONB with branch_type/year_start).
- On startup, dataService automatically applies missing DB migrations if service key is available, then syncs versions.
- Demo data seeds only when members/convocazioni tables are empty (manual trigger via AdminPanel).
- Service key (postgres password) required for automatic migrations; anon key used for normal operations.

## Authentication (Prepared, Disabled)

Supabase auth scaffolding exists but is disabled. Files: utils/authService.ts, utils/permissionChecker.ts, contexts/AuthContext.tsx, types.ts. Feature flag SUPABASE_AUTH_ENABLED remains false. Enable by setting env keys, flipping the flag, mounting the provider, and wiring permissions.

## Testing & Debugging

- Use npm run build for type-safe validation.
- Migrations run automatically on startup; ensure service key is configured for schema changes.
- Version tracking in app_settings.db_version; check console for migration progress.
- Demo data only seeds when members/convocazioni are empty.

## Operating Guidelines & Best Practices

- **COMMUNICATION LANGUAGE: Always respond in Italian.**
- **Documentation: Do NOT create README, .md files, or documentation unless explicitly requested by the user.**
- Editing: Prefer apply_patch for single-file edits; avoid for auto-generated content or bulk formatting. Keep ASCII unless necessary. Add concise comments only for non-obvious logic.
- Versioning: Bump APP_VERSION in services/dataService.ts for any UI/logic change. Bump DB_VERSION only for data shape changes; SUPABASE_SCHEMA_VERSION only when SQL schema changes.
- **Database migrations: Always maintain BASELINE_SCHEMA_SQL (clean latest version) and DB_MIGRATIONS map (incremental steps). Every schema change must have an idempotent migration entry.**
- Git etiquette: Never commit or push unless the user explicitly asks. Do not revert user changes you did not make.
- Supabase clients: Reuse the global cache in utils/supabaseClientCache.ts to prevent multiple GoTrueClient warnings. Do not instantiate duplicate clients.
- Auth (email flow): Use emailAuthService with cached client; privileges live in user_metadata; handle mustChangePassword.
- Registry/prod: Do not write to filesystem in prod; Netlify prod uses Blobs. NETLIFY_DEV indicates local mode.
- Sidebar UX: Only one left-menu accordion open at a time; opening one closes the others; clicking an open section collapses all.
- Data flow: Components must not call Supabase directly; use dataService. After saves, call loadData() to resync.
- Rituals/Roles: Use getRolesForRitual and AppSettings.yearlyRituals; ritual change clears roles for that branch/year with confirmation.
- Initiation terms: When first degree is added for a branch, add ACTIVE status event with branch-specific INITIATION_TERMS.
- Year handling: selectedYear drives views/reports; add past/future years without clamping (no Math.max/min on yearOptions).
- Schema changes: All DB schema modifications must be applied automatically via incremental migrations; never require manual SQL execution.
- Env: Require VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (NEXT_PUBLIC_* fallbacks). Service key required for migrations.
- **Git workflow: NEVER run `git commit` or `git push` unless the user explicitly asks. Always wait for user confirmation before committing changes.**
- **Code modification workflow: ALWAYS present the action plan and ask for user confirmation BEFORE making any code changes. Describe what files will be modified and how, then wait for explicit approval.**
