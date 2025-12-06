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

### Firebase Setup

- **Local Development**: `dataService.USE_FIREBASE = true` (default) connects to staging Firebase project (`gadu-staging`)
- **Firestore Collections**: `members` (docs per member by ID), `settings/appSettings` (singleton app config)
- **Credentials**: Embedded in `dataService.ts` (staging credentials; production credentials in `.env` on real project)
- **Offline Development**: Set `USE_FIREBASE = false` to mock data (returns empty arrays)

### Key Files for Common Tasks

| Task | File(s) |
|------|---------|
| Add member field | `types.ts` (`Member`), `MemberDetail.tsx` (form section), `dataService.ts` (validation if needed) |
| Add degree/role | `constants.ts` (`DEGREES`/`COMMON_ROLES`), `components/HistoryEditor.tsx` or `RoleEditor.tsx` |
| Add branch | `types.ts` (`BranchType`), `constants.ts` (`BRANCHES`, `DEGREES`, `COMMON_ROLES`), `MemberDetail.tsx` (new tab), `dataService.ts` (initialize empty branch) |
| New view/page | `App.tsx` (add `View` type, render case, navigation), create new `components/ViewName.tsx` |
| UI styling | Tailwind classes (e.g., `bg-masonic-blue`) via Vite; custom colors in `index.html` or inline |

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

### Branch Data Access

Branch data accessed by lowercase key:
```tsx
const branchKey = branch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
const branchData = member[branchKey]; // e.g., member.craft
```

### Validation Pattern

Validation in component (e.g., `MemberDetail.validate()`) with user-facing Italian error messages; async to check Firestore duplicates.

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

## Testing & Debugging

- **Console logging**: `dataService.init()` logs Firebase mode status
- **Version tracking**: `APP_VERSION` in `dataService` for UI title and cache busting
- **Firestore Rules**: `firestore.rules` file present; ensure read/write rules match authentication model
- **Build validation**: TypeScript strict mode catches type errors; run `npm run build` to verify before deploy
