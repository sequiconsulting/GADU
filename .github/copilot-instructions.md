# GADU Copilot Instructions

## Project Overview

**GADU** (Gestione Associazioni Decisamente User-friendly) is a membership management system for Masonic lodges built with React, TypeScript, Firebase, and Vite. It manages members across four Masonic branches (Craft, Mark, Chapter, Royal Ark Mariner) with complex degree tracking, role assignments, and organizational reporting.

## Architecture

### Core Structure

- **`App.tsx`** - Main component managing view state (9 views), navigation, year selection, and member/settings lifecycle
- **`types.ts`** - Masonic domain model: `Member`, `MasonicBranchData`, `OfficerRole`, `DegreeEvent`, `StatusEvent`
- **`constants.ts`** - Branch definitions, degree hierarchies (Italian names), role templates, and utility functions
- **`services/dataService.ts`** - Firebase Firestore abstraction layer with fallback to local mode (toggle `USE_FIREBASE`)
- **`index.tsx`** - React entry point with strict mode

### Component Organization

UI components are single-file, function-based components that accept props for data and callbacks:
- **`MemberDetail.tsx`** - Multi-branch form with profile/degree/role tabs per branch; validates matricula uniqueness
- **`HistoryEditor.tsx`** - Manages `statusEvents` and `degrees` arrays for a branch
- **`RoleEditor.tsx`** - Manages `roles` array with year/branch/date tracking
- **`RolesReport.tsx`** - Role matrix view by branch
- **`RoleAssignment.tsx`** - Bulk role assignment UI
- **`Piedilista.tsx`** - Member roster by degree/branch (reports view)
- **`InactiveMembers.tsx`** - Filters members by activity in selected year
- **`AdminPanel.tsx`** - Settings editor for lodge name/number/province/preferences
- **`Legend.tsx`** - Reference display for degrees and UI conventions

### Data Flow

1. **Load**: `App` calls `dataService.getMembers()` and `dataService.getSettings()` on mount
2. **Edit**: Components update state and pass changes via callbacks to parent (e.g., `onSave`)
3. **Save**: `dataService.saveMember(member)` merges to Firestore; `loadData()` refreshes UI
4. **Filter**: `App` applies `searchTerm` and `filterBranch` to members before passing to view

### Key Domain Concepts

- **`BranchType`**: Discriminated union (`'CRAFT' | 'MARK' | 'CHAPTER' | 'RAM'`) with localized labels in `BRANCHES` constant
- **`MasonicBranchData`**: Per-branch node on `Member` with `statusEvents[]`, `degrees[]`, `roles[]`, and provenance flags (`isMotherLodgeMember`, `isDualMember`, `isFounder`)
- **`StatusEvent`**: Tracks active/inactive transitions with date and optional note; calculated into annual active status via `isMemberActiveInYear(member, branch, year)`
- **`OfficerRole`**: Tracks by `yearStart` (Masonic year 2025 = 2025-2026) with mid-year `startDate`/`endDate` support
- **`DegreeEvent`**: Immutable event (date, name, meeting number, location) for degree progression tracking
- **Year Selection**: App stores civil year; Masonic year string generated via `calculateMasonicYearString(year)`

## Development Workflow

### Build & Run

```bash
npm install                 # Install React 19.2, Firebase 12.6, Vite 6.2, TypeScript 5.8
npm run dev               # Start Vite dev server on port 3000
npm run build             # Compile to dist/ with Vite
npm run preview           # Serve built dist locally
```

### Version Management

**CRITICAL: Every code change must update the app version. Database changes must also update the DB version in Firestore.**

**App Version** (`dataService.ts` line 17):
- Update `APP_VERSION` with each commit/deployment (e.g., `'0.27'` → `'0.28'`)
- Format: Semantic versioning as string (e.g., `'MAJOR.MINOR'`)
- Used in UI title bar and cache busting
- Example: `public APP_VERSION = '0.28';`

**Database Version** (`dataService.ts` line 18 + Firestore):
- Increment `DB_VERSION` only when `Member` or `AppSettings` types/schema change
- Update `dataService.ts` line 18: `public DB_VERSION = 2;` (in-code version)
- **Automatic Synchronization**: The app automatically syncs DB version on every read/write operation:
  1. On `getSettings()`: Compares `dbVersion` from Firestore with local `DB_VERSION`
  2. On `saveMember()`, `saveSettings()`, and all data operations: If version mismatch detected, automatically pushes updated `dbVersion` to Firestore
  3. No manual Firebase Console update required; app handles version drift automatically
- **Migration Pattern**: On app load, if `dbVersion` mismatch detected between app code and Firestore:
  - App auto-updates Firestore to match current code version
  - Optional: Show migration prompt for data schema upgrades
  - Optional: Apply automatic schema migrations for backward compatibility
- **Example Workflow**:
  1. Developer adds new field to `Member` type in `types.ts`
  2. Developer increments `DB_VERSION` from 2 → 3 in `dataService.ts`
  3. User updates app (gets new code with DB_VERSION = 3)
  4. App calls `getSettings()` → detects Firestore has `dbVersion: 2` but code expects 3
  5. App automatically updates Firestore document with `dbVersion: 3`
  6. Migration complete; no manual intervention needed

**When to Update:**
- ✅ **App Version**: Every UI fix, workflow change, button style update, printing fix, feature addition
- ✅ **DB Version**: Only when data model (`types.ts` `Member` or `AppSettings`) changes structure
- ❌ **Both**: Only if code AND schema change together (rare; usually just app version)

### Firebase Setup

- **Local Development**: `dataService.USE_FIREBASE = true` (default) connects to staging Firebase project (`gadu-staging`)
- **Firestore Collections**: `members` (docs per member by ID), `settings/appSettings` (singleton app config)
- **Credentials**: Embedded in `dataService.ts` (staging credentials; production credentials in `.env` on real project)
- **Offline Development**: Set `USE_FIREBASE = false` to mock data (returns empty arrays)
- **Version Sync**: Automatic on every data operation; no manual Firestore edits required

### Key Files for Common Tasks

| Task | File(s) |
|------|---------|
| Add member field | `types.ts` (`Member`), `MemberDetail.tsx` (form section), `dataService.ts` (validation if needed) |
| Add degree/role | `constants.ts` (`DEGREES`/`COMMON_ROLES`), `components/HistoryEditor.tsx` or `RoleEditor.tsx` |
| Add branch | `types.ts` (`BranchType`), `constants.ts` (`BRANCHES`, `DEGREES`, `COMMON_ROLES`), `MemberDetail.tsx` (new tab), `dataService.ts` (initialize empty branch) |
| New view/page | `App.tsx` (add `View` type, render case, navigation), create new `components/ViewName.tsx` |
| UI styling | Tailwind classes (e.g., `bg-masonic-blue`) via Vite; custom colors in `index.html` or inline |
| Add ritual support | Update `constants.ts` types/labels/role arrays, `types.ts` AppSettings, `RoleAssignment.tsx` UI, `RolesReport.tsx` display |
| Fix printing issues | Adjust `@media print` CSS in `index.html` and `print:` Tailwind classes in affected component (Piedilista, RolesReport) |

### Critical Workflows

**Year Navigation & Data Refresh Flow:**
- `App` maintains `selectedYear` (civil year) and `yearOptions` array (range available in dropdown)
- Arrow buttons call `handleAddFutureYear()` / `handleAddPastYear()` (increment/decrement by 1)
- `loadData()` refreshes `members` and `appSettings` from Firebase and passes both to child components
- **Do not use Math.max/Math.min on yearOptions**; always increment/decrement from `selectedYear` directly

**Member Save Flow:**
1. `MemberDetail` validates form (async matricula check via `validate()`)
2. User clicks "Salva" button → `handleSave()` calls `dataService.saveMember(member)`
3. `saveMember()` performs `.setDoc(..., { merge: true })` on Firestore
4. On success, component callback triggers `onSave()` → parent calls `loadData()` → all child views refresh
5. After save, navigation returns to `returnView` (e.g., 'MEMBERS' if edited from members list)

**Ritual Change Flow in RoleAssignment:**
1. User clicks "Modifica Rituale" button → `setUnlockingRitual(activeBranch)` unlocks UI
2. User selects new ritual from dropdown → `confirmingRitualChange` modal appears
3. User confirms → `handleRitualChange()` updates `AppSettings.yearlyRituals[year]` AND deletes all roles for that branch/year
4. On success, `onUpdate()` callback triggers parent `loadData()` to refresh role display

**Print Workflow:**
- User clicks "Stampa" button → browser print dialog (Ctrl+P or print button)
- CSS `@media print` hides sidebar, search bars, and control buttons; shows print header with lodge name
- `print-branch-container:nth-of-type(n+2)` forces new page for each branch; `page-break-inside: avoid` keeps table rows together
- Print preview confirms layout before sending to printer

## Patterns & Conventions

### Component Props Pattern

Components receive data and callbacks, not direct Firebase access:
```tsx
interface ComponentProps {
  members: Member[];
  onSave: (updated: Member) => void;
  onCancel: () => void;
}
```

### Masonic Year Handling

- Civil year `2025` → Masonic year "2025-2026" (via `calculateMasonicYearString`)
- Member active status calculated per (branch, year) tuple via `isMemberActiveInYear(member, branch, year)`
- Roles keyed by `yearStart` integer; UI displays via `calculateMasonicYearString(yearStart)`

### Ritual System (Year-Based)

- **Craft** branch supports two rituals: `'Emulation'` (default) or `'Scozzese'` (Scottish Rite)
- **Mark & Chapter** branches support: `'Irlandese'` (default) or `'Aldersgate'`
- **RAM** branch uses no ritual distinction
- Rituals selected per year in `AppSettings.yearlyRituals[year]` (e.g., `{craft: 'Scozzese', markAndArch: 'Aldersgate'}`)
- Use `getRolesForRitual(branch, ritual)` to fetch correct role list (e.g., `CRAFT_ROLES_SCOTTISH_RITE` vs `CRAFT_ROLES_EMULATION`)
- Changing ritual in `RoleAssignment` component **deletes all roles for that branch/year** (confirmation modal + deletion logic)

### Branch Data Access

Branch data accessed by lowercase key:
```tsx
const branchKey = branch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
const branchData = member[branchKey]; // e.g., member.craft
```

### Validation Pattern

Validation in component (e.g., `MemberDetail.validate()`) with user-facing Italian error messages; async to check Firestore duplicates.

### Printing & Report Styles

- Print styles in `index.html` `@media print` block: use `page-break-before: always !important` for section breaks
- Piedilista prints with header + table together; branches on separate pages via `.print-branch-container:nth-of-type(n+2) { page-break-before: always !important; }`
- Career/degree add buttons and "Modifica Rituale" button use yellow background (`bg-yellow-400 hover:bg-yellow-500 text-slate-900`) for visual prominence

### Italian Terminology

All UI labels and degree/role names in Italian (e.g., "Maestro Venerabile", "Apprendista Ammesso"). Abbreviations standardized in `DEGREES` constants.

## External Dependencies

- **React 19.2.0** - UI framework
- **Firebase 12.6.0** - Firestore backend (collections, docs, batch writes)
- **Vite 6.2.0** - Build tool; config defines port 3000, Tailwind/styling via plugins
- **TypeScript 5.8** - Strict type checking for domain model safety
- **Lucide React** - Icon library for all UI icons (e.g., `Users`, `Save`, `ArrowLeft`)
- **@faker-js/faker** - Mock data generation (imported but check if actually used)

## Common Gotchas

1. **Branch case sensitivity**: `BranchType` values are uppercase (`'CRAFT'`); member keys are lowercase (`member.craft`)
2. **Firestore `.merge()`**: `saveMember` uses `setDoc(..., { merge: true })` to preserve unmodified fields
3. **Year options dynamic**: `App` allows adding past/future years beyond initial 8-year range
4. **Status vs. Degree**: `statusEvents` track active/inactive; `degrees` track progression—both per branch
5. **Mobile menu**: `isMobileMenuOpen` state toggles on view changes; layout responsive at breakpoints via Tailwind
6. **Empty member template**: `dataService.getEmptyMember()` initializes new member with empty branch data structs
7. **Ritual state management**: `RoleAssignment` manages `unlockingRitual` (locked by default) and `confirmingRitualChange` states; confirm modal must appear before deleting roles
8. **Print layout**: Use `pageBreakInside: 'auto'` on container and avoid on header/footer rows; pair inline styles with `!important` CSS rules in `index.html`

## Recently Added Features

### Ritual Selection System (In Progress)
- **Files**: `constants.ts` (types, labels, role arrays, `getRolesForRitual`), `types.ts` (AppSettings.yearlyRituals), `RoleAssignment.tsx` (UI), `RolesReport.tsx`, `Piedilista.tsx`
- **Pattern**: Year-based ritual configuration with role deletion on change; ritual displayed in organigramma section headers
- **UI Convention**: Ritual selector button locked by default (`<Lock>` icon); click "Modifica Rituale" to unlock (`<Unlock>` icon); confirmation modal warns of role deletion

### Authentication (Prepared: Auth0 - Not Yet Active)

**Status**: Infrastructure prepared but NOT implemented. App currently has zero authentication.

**Prepared Components & Files:**
- **`types.ts`**: `UserRole` type and `Auth0User` interface with custom claims support
- **`utils/permissions.ts`**: Complete permission checking system with these functions:
  - `canWriteToBranch(user, branch)` - Check write access per branch
  - `getWritableBranches(user)` - Get list of branches user can modify
  - `canModifyMember()`, `canCreateMember()`, `canDeleteMember()` - Member-level controls
  - `canModifyAdminSettings()`, `canChangeRitual()` - Admin-only operations
- **`contexts/AuthContext.tsx`**: Placeholder context for Auth0 (not active)
- **`components/LoginPage.tsx`**: Pre-built login UI component (not active)
- **`App.tsx`**: TODO comments showing where Auth0 guard will be added (lines 21-24)

**User Roles** (stored in Auth0 custom claim `https://gadu.com/roles`):
- **`admin_global`** - Full read/write to all branches
- **`admin_craft`** - Read all, write only Craft branch
- **`admin_mark_arch`** - Read all, write Mark & Chapter branches
- **`admin_ram`** - Read all, write only RAM branch
- Users can have multiple roles; permission functions handle union of capabilities

**To Activate Auth0** (future step):
1. Install `@auth0/auth0-react`: `npm install @auth0/auth0-react`
2. Create `.env.local` with: `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_REDIRECT_URI`
3. Replace `AuthContext.tsx` placeholder with actual Auth0Provider
4. Uncomment imports and guard in `App.tsx` lines 5-7 and 21-24
5. Update Firestore rules to validate Auth0 tokens
6. Use `canWriteToBranch(user, branch)` in MemberDetail, RoleAssignment, etc. to gate write operations
7. Test role-based access in each workflow

## Testing & Debugging

- **Console logging**: `dataService.init()` logs Firebase mode status
- **Version tracking**: `APP_VERSION` in `dataService` for UI title and cache busting; always increment on code changes
- **Database schema migration**: If data model changes, increment `DB_VERSION` in both `dataService.ts` and Firestore `settings/appSettings` doc
- **Firestore Rules**: `firestore.rules` file present; ensure read/write rules match authentication model
- **Build validation**: TypeScript strict mode catches type errors; run `npm run build` to verify before deploy
- **Print preview**: Use browser print preview (Ctrl+P) to verify Piedilista and RolesReport layouts before official printing
- **Auth0 permissions**: Test `utils/permissions.ts` functions with mock users in each role; verify write restrictions enforce correctly
