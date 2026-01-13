# GADU Copilot Instructions

## Project Overview

GADU (Gestione Associazioni Decisamente User-friendly) – Membership management system for Masonic lodges. React + TypeScript + Supabase + Vite. Manages members across 4 branches (Craft, Mark, Arch, RAM) with degree tracking, role assignments, and reporting.

## Core Principles

### Single Source of Truth (No Workarounds)
- Each data type has ONE authoritative source (registry, appSettings, database, etc.)
- NO fallback logic, NO duplication, NO "default to something else"
- If data is missing from its source → **throw explicit error immediately**
- Example: Lodge data (name, number, province) → **registry ONLY**, never appSettings

### Show Errors, Never Hide Them
- **Never use try/catch without rethrowing** or using the error
- **Always validate input** at function entry; throw if missing/invalid
- **Errors must be specific and actionable**: not "Failed" but "Registry write verification failed: databasePassword missing"
- **No silent failures**: if a critical operation fails (save, migration, verification) → user must know why

## Architecture

**Files:**
- `App.tsx` – 9 views, navigation, year selection, member/settings lifecycle
- `types.ts` – Domain model (Member, AppSettings, StatusEvent, etc.)
- `constants.ts` – Branch defs, degrees, roles, utilities
- `services/dataService.ts` – Supabase layer (app_settings, members, convocazioni)
- `services/lodgeRegistry.ts` – Registry service

**Components:**
- `MemberDetail` – Profile/degree/role tabs; matricola validation
- `HistoryEditor` – Manage statusEvents/degrees per branch
- `RoleEditor` – Manage roles (year/branch/date tracking)
- `AdminPanel` – Settings (lodge, preferences, users)
- `RolesReport` – Role matrix view
- `Piedilista` – Member roster by degree
- `Tornate` – Convocazioni CRUD

**Netlify Functions:**
- `create-lodge.ts` – Create new lodge (verify registry, init schema, create admin user)
- `update-schema.ts` – Initialize database schema
- `manage-supabase-users.ts` – User CRUD
- `admin-registry.ts` – Manage registry (upsert/delete lodges)

## Data Flow

1. **Load**: App → `dataService.getMembers()`, `dataService.getSettings()`
2. **Edit**: Components update state → callback to parent
3. **Save**: `dataService.saveMember/saveSettings()` → Supabase upsert → `loadData()` refresh
4. **Filter**: App applies `searchTerm` + `filterBranch` before passing to views

## Versioning

- `APP_VERSION` – Bump for any UI/logic change
- `DB_VERSION` – Bump only when Member/AppSettings shape changes
- `SUPABASE_SCHEMA_VERSION` – Bump only when SQL schema changes

**Database migrations:**
- Automatic & incremental via `DB_MIGRATIONS` map
- Maintain `BASELINE_SCHEMA_SQL` (clean latest state)
- All migrations idempotent (`IF NOT EXISTS`, etc.)
- Service key required for automatic execution
- Never require manual SQL

## Common Tasks

| Task | Files |
|------|-------|
| Add member field | types.ts, MemberDetail.tsx, dataService.ts |
| Add degree/role | constants.ts, HistoryEditor.tsx, RoleEditor.tsx |
| Add branch | types.ts, constants.ts, MemberDetail.tsx, dataService.ts |
| New view | App.tsx, create components/ViewName.tsx |
| Styling | Tailwind in components, custom colors in index.html |
| Supabase schema | supabase-schema.sql, update SUPABASE_SCHEMA_VERSION |

## Critical Workflows

- **Year navigation**: `selectedYear` drives views; no Math.max/min clamping; arrow buttons ±1
- **Member save**: `MemberDetail.handleSave()` → `dataService.saveMember()` → `loadData()` → return to view
- **Ritual change**: Modal confirmation → clear roles for branch/year → reload
- **Lodge creation**: Save to registry → verify write (retry w/ backoff) → init schema → create admin user → activate
- **Convocazioni**: `Tornate` manages CRUD via `dataService` helpers; assumes RLS present

## Patterns & Conventions

- Branch key (lowercase): `branch.toLowerCase()`
- Roles keyed by `yearStart` (civil year)
- Validation: async with Italian error messages
- Print: `@media print` in index.html + `print:` classes
- Ritual per year: `AppSettings.yearlyRituals[year]`
- Status events: sorted by date, tracked per branch
- Changelog: max 100 entries, oldest auto-trimmed, paginated (5 per page)

## Git Workflow

- **NEVER commit/push without explicit user request**
- **ALWAYS present action plan BEFORE modifying code**
- Describe which files will change and how → wait for "ok" or "yes"
- Only then make changes → show user changes → wait for "commit and push" command

## Code Modification Workflow

1. **Analyze** the request
2. **Present plan**: "I will modify X, Y, Z by doing A, B, C"
3. **Wait for approval** ("ok", "yes", "proceed")
4. **Implement** changes
5. **Compile** check (`npm run build`)
6. **Wait for commit/push command**

## Best Practices

- **Communication**: Always Italian
- **No docs** unless requested
- **Reuse** supabaseClientCache to prevent warnings
- **Data layer**: Components never call Supabase directly; use dataService
- **Registry**: Single source for lodge config (name, number, province, URLs, etc.)
- **Settings**: Single source for customizable lodge data (preferences, user changelog, etc.)
- **Errors**: Explicit, specific, actionable – never silent
- **Retry logic**: Use for filesystem/network operations with backoff (100ms, 200ms, 300ms)
- **Migrations**: Always idempotent; testable on all versions

## Dependencies

- React 19.2.0, @supabase/supabase-js 2.48.x, Vite 6.2.x, TypeScript 5.8.x
- Lucide React, @faker-js/faker (demo), postgres (migrations), zod (validation)

## Supabase Setup

- Tables: `app_settings` (singleton), `members` (JSONB), `convocazioni` (JSONB)
- Migrations auto-apply on startup (service key required)
- Demo data only seeds when empty (manual via AdminPanel)
- RLS: Deny anon, allow authenticated users

