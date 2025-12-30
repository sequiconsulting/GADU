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
- On startup, dataService ensures app_settings exists, syncs versions, and seeds demo members + convocazioni if tables are empty.
- Missing tables raise a schema error instructing to run supabase-schema.sql.

## Authentication (Prepared, Disabled)

Supabase auth scaffolding exists but is disabled. Files: utils/authService.ts, utils/permissionChecker.ts, contexts/AuthContext.tsx, types.ts. Feature flag SUPABASE_AUTH_ENABLED remains false. Enable by setting env keys, flipping the flag, mounting the provider, and wiring permissions.

## Testing & Debugging

- Use npm run build for type-safe validation.
- If Supabase errors mention missing relations, run supabase-schema.sql.
- Version mismatches are auto-healed by dataService on startup.
- Demo data only seeds when members/convocazioni are empty.
