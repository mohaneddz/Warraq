# WARRAQ — Codex master implementation prompt

You are working inside an **existing Tauri v2 + React + TypeScript + Vite project** named **Warraq**. It is a desktop library-management system for Mustapha Bacha Hospital in Algiers. The project already runs with `pnpm tauri dev` and already contains source code and design assets. Your job is to inspect it, preserve what is useful, then implement the complete product described below.

Do not generate a disposable demo, a static mockup, or a second project. Work directly in the existing repository. Every visible control must work, all CRUD must persist to SQLite, all routes must exist, and all desktop behavior must be implemented through Tauri v2. Do not leave fake buttons, dead menu items, TODO pages, hardcoded statistics, or mock data in production paths.

## 1. First actions and working rules

1. Inspect `package.json`, `src/`, `src-tauri/`, current routes, current styling, current Tauri config/capabilities, and the supplied Warraq assets before changing anything.
2. Determine the existing React/Tauri versions and adapt commands to them. Use **pnpm only**. Do not replace the stack or recreate the repository.
3. Make a short implementation plan, then execute it completely. Work in coherent checkpoints but do not stop after scaffolding.
4. Preserve unrelated existing code and user changes. Refactor only where it improves the requested architecture.
5. Use strict TypeScript. Avoid `any`, unsafe casts, monolithic components, duplicated business logic, and direct SQL scattered across UI files.
6. After each major checkpoint, run the relevant TypeScript, frontend, Rust, lint, and test checks. Finish by running the full validation suite and `pnpm tauri dev` or the closest non-blocking build verification available.
7. If a dependency is already present, reuse it. Install only the missing packages that are actually used.

## 2. Product and visual identity

Warraq digitizes the hospital's physical and digital library: cataloguing, copies, members, borrowing, returns, renewals, reservations, overdue items, inventory, reports, imports, backups, external metadata lookup, and optional AI assistance.

Use the supplied Warraq identity assets. Put production copies in sensible `src/assets/brand/`, `public/`, and `src-tauri/icons/` locations as required; do not reference the design-board image as the logo.

Brand tokens:

- Ink: `#17211F`
- Emerald: `#176B57`
- Parchment: `#F4EBDD`
- Copper: `#C87941`
- Primary Latin font: **Manrope**
- Arabic font: **IBM Plex Sans Arabic**

The UI should feel calm, scholarly, premium, and modern: warm parchment surfaces, ink text, emerald navigation/actions, copper highlights, restrained page-inspired details, rounded corners, thin borders, soft shadows, excellent information density, and no generic bright-blue hospital template. Support light and dark themes, reduced motion, keyboard navigation, visible focus states, high contrast, RTL layout for Arabic, and responsive behavior down to a sensible minimum desktop window size.

Use Tailwind CSS and central CSS variables/design tokens. Do not scatter raw hex colors throughout components. Use the logo startup animation tastefully and keep normal navigation fast.

## 3. Required frontend packages

Prefer the current stable versions compatible with the repository. Use:

- `tailwindcss` with the official Vite integration appropriate to the installed Tailwind version
- `react-router-dom` for routing
- `@tanstack/react-query` for async server/database state and cache invalidation
- `@tanstack/react-table` for sortable/filterable/paginated data grids
- `@tanstack/react-virtual` where large catalogs need virtualization
- `zustand` for small cross-cutting UI state only; do not duplicate database entities in Zustand
- `react-hook-form`, `zod`, and `@hookform/resolvers` for forms and validation
- `lucide-react` for the consistent 2px rounded icon system
- `class-variance-authority`, `clsx`, and `tailwind-merge` for reusable component variants
- `motion` for restrained transitions and the startup sequence
- `sonner` for toast feedback
- `cmdk` for the command palette
- `date-fns` for date calculations and formatting
- `recharts` for dashboard and report charts
- `@zxing/browser` for camera/barcode support where available, while also supporting USB barcode scanners as keyboard input
- `papaparse` for CSV import/export and `exceljs` for XLSX import/export
- `react-error-boundary` for recoverable page boundaries
- `i18next` and `react-i18next` for English, French, and Arabic
- `vitest`, React Testing Library, and `@testing-library/user-event` for frontend tests

Use accessible in-project UI primitives modeled consistently; if a shadcn-style primitive set already exists, extend it. Do not add a heavy competing component framework.

## 4. Required Tauri v2 capabilities and plugins

Add, initialize, configure, and permission-scope the relevant official Tauri v2 plugins on both Rust and TypeScript sides:

- SQL with the SQLite feature
- Store
- Stronghold for API keys/secrets
- Autostart
- Global Shortcut
- Single Instance
- Notification
- Dialog
- File System
- Opener
- HTTP or narrow Rust HTTP commands for external API requests
- Window State
- Updater only if an updater endpoint/config already exists; otherwise implement the settings surface safely without inventing a production signing key or endpoint
- Clipboard only where copy actions are implemented
- Log for local diagnostic logging without secrets or personal data

Configure `src-tauri/capabilities/*.json` with the minimum permissions and scopes required. Do not grant shell execution or broad filesystem/network access. Scope HTTP hosts to configured providers. Never put API keys in frontend source, SQLite, logs, the normal Store file, or Git. Store secrets using Stronghold and expose narrow commands/services to set, retrieve masked status, test, and delete them.

Use SQLite as `sqlite:warraq.db`, preload it appropriately, and register versioned migrations in Rust via `tauri-plugin-sql`. Queries must be parameterized. Multi-step circulation operations must run transactionally.

## 5. Required source structure

Refactor toward this structure without blindly deleting useful existing files:

```text
src/
  app/
    App.tsx
    router.tsx
    providers.tsx
    queryClient.ts
  assets/
    brand/
    illustrations/
  components/
    ui/                 # buttons, inputs, dialogs, menus, tabs, tables, badges
    layout/             # AppShell, Sidebar, Topbar, CustomTitlebar, PageHeader
    shared/             # EmptyState, ErrorState, LoadingState, StatCard, etc.
    forms/              # reusable form fields and form sections
    domain/             # BookCard, MemberBadge, LoanStatus, ISBNScanner, etc.
  sections/
    startup/
    onboarding/
    dashboard/
    catalog/
    circulation/
    members/
    reservations/
    inventory/
    reports/
    activity/
    settings/
  hooks/
    useAppShortcuts.ts
    useGlobalShortcuts.ts
    useCloseToTray.ts
    useBarcodeScanner.ts
    useDebouncedValue.ts
    useTheme.ts
    useLocale.ts
    usePermissions.ts
  data/
    database.ts
    schema.ts
    repositories/
    queries/
    mutations/
    seed/               # development-only seed data
  services/
    integrations/
    groq/
    metadata/
    importExport/
    backup/
    notifications/
  store/
    uiStore.ts
    preferencesStore.ts
  types/
  utils/
    dates.ts
    errors.ts
    formatters.ts
    identifiers.ts
    validation.ts
  i18n/
    en.json
    fr.json
    ar.json
  styles/
    globals.css
    tokens.css
  main.tsx

src-tauri/
  capabilities/
    default.json
  icons/
  migrations/
    0001_initial.sql
    0002_indexes.sql
  src/
    commands/
      integrations.rs
      backup.rs
      window.rs
    services/
      groq.rs
      metadata.rs
      secrets.rs
    shortcuts.rs
    tray.rs
    window.rs
    state.rs
    lib.rs
    main.rs
  tauri.conf.json
```

Use barrel files sparingly. Domain sections own their page components; generic primitives live in `components`. Repositories own SQL, services own integrations/business adapters, and hooks coordinate UI behavior.

## 6. SQLite data model and migrations

Implement normalized migrations, foreign keys, useful indexes, timestamps, and soft archival where appropriate. At minimum include:

- `books`: id, isbn10, isbn13, title, subtitle, description, language, publication_year/date, edition, page_count, cover_path/url, publisher_id, category_id, call_number, dewey_code, notes, source, created_at, updated_at, archived_at
- `authors`: id, name, normalized_name, biography, external_ids, timestamps
- `book_authors`: book_id, author_id, author_order
- `publishers`: id, name, city, timestamps
- `categories`: id, name, parent_id, color, description
- `shelves`: id, code, room, floor, section, capacity, notes
- `copies`: id, book_id, accession_number unique, barcode unique, shelf_id, acquisition_date, acquisition_source, price, condition, status, notes, timestamps
- `members`: id, member_number unique, full_name, email, phone, department, role/job_title, address, joined_at, expiry_date, status, notes, avatar_path, timestamps
- `loans`: id, copy_id, member_id, borrowed_at, due_at, returned_at, renewed_count, issued_by, received_by, condition_out, condition_in, notes
- `reservations`: id, book_id, member_id, status, position, reserved_at, expires_at, fulfilled_at
- `fines`: id, loan_id, member_id, amount, reason, status, waived_reason, paid_at, timestamps; fines must be optional/configurable
- `tags` and `book_tags`
- `attachments`: id, book_id, label, local_path, mime_type, size
- `audit_logs`: actor, action, entity_type, entity_id, before_json, after_json, created_at
- `saved_searches`: id, name, query_json, created_at
- `integration_cache`: provider, cache_key, payload_json, expires_at

Add indexes for ISBN, title, normalized author names, barcodes, accession numbers, member numbers, open loans, due dates, reservation status, and common filters. Use SQLite FTS5 for catalog/member search if supported by the bundled SQLite build; otherwise provide a carefully indexed fallback. Do not store app preferences or secrets in these tables.

Enforce business invariants:

- A copy cannot have more than one open loan.
- Archived/lost/repair copies cannot be checked out.
- Suspended/expired members cannot borrow.
- Loan limits and durations come from settings.
- Renewal fails if the maximum is reached or another member has an active reservation.
- Returning a book updates copy status and advances reservation availability atomically.
- Destructive operations use archive where history must remain intact.
- Every important create/update/delete/circulation action creates an audit entry.

## 7. Application shell and desktop interactions

### Custom titlebar

Use a frameless/decorations-disabled Tauri window and implement a proper custom titlebar with:

- draggable regions that do not block controls
- logo/name, current section breadcrumb, optional sync/database indicator
- minimize, maximize/restore, and close buttons with platform-appropriate hover states
- double-click titlebar to maximize/restore
- correct maximized state icon and window event synchronization
- no accidental dragging from inputs/buttons

### Close to tray and single instance

- Closing the main window hides it to the system tray when the preference is enabled; it does not terminate the process.
- First close may show a one-time explanatory notification with “Do not show again”.
- Tray menu: Show/Hide Warraq, Quick Search, New Loan, Return Book, Overdue count, Settings, Quit.
- Double-clicking or primary-clicking the tray icon restores and focuses the window.
- “Quit” from the tray or app menu exits fully and bypasses close-to-tray interception.
- Enforce a single instance. Launching again focuses/restores the existing window and forwards any arguments/deep links.
- Persist window size, position, maximized state, and last route; recover gracefully if a saved position is off-screen.

### Startup and autostart

- Create a lightweight Tauri splash/startup window or splash state showing the Warraq symbol with a refined page-turn/pulse animation.
- Initialize Store, Stronghold availability, SQLite, migrations, preferences, locale, theme, and global shortcuts behind it.
- Show progress labels only when startup exceeds a short threshold. On success, crossfade into the main window. On failure, show a recoverable diagnostic screen with retry and open-log actions.
- Respect `prefers-reduced-motion`.
- Settings can toggle launch at system startup and “start minimized to tray”. Make both behaviors functional.

## 8. Navigation, command palette, and shortcuts

Use a collapsible left sidebar and nested route layout. Sidebar sections: Dashboard, Catalog, Circulation, Members, Reservations, Inventory, Reports, Activity, Settings. Keep primary actions reachable from the topbar.

Implement a global in-app command palette with `Ctrl/Cmd+K`: fuzzy search pages, books, members, actions, and settings. Support arrow navigation, Enter, Escape, recent commands, and permission-aware results.

Default in-app shortcuts, all shown and editable in Settings:

- `Ctrl/Cmd+K`: command palette
- `/`: focus global search when not inside an editable field
- `Ctrl/Cmd+N`: context-aware new item
- `Ctrl/Cmd+Shift+B`: new checkout
- `Ctrl/Cmd+Shift+R`: return book
- `Ctrl/Cmd+Shift+S`: scan ISBN/barcode
- `Ctrl/Cmd+1…9`: navigate primary sections
- `Ctrl/Cmd+,`: Settings
- `Ctrl/Cmd+F`: page-level filter/search
- `Escape`: close the topmost modal/popover or clear selection
- `?`: shortcuts overlay when not typing

Global OS shortcuts, configurable and collision-safe:

- `Ctrl+Alt+W`: show/hide and focus Warraq
- `Ctrl+Alt+K`: show Warraq and open command/search palette
- `Ctrl+Alt+B`: show quick checkout

Register/unregister global shortcuts when settings change, report collisions without crashing, and never trigger app shortcuts while typing unless explicitly intended.

## 9. Pages and complete functionality

### Startup / first-run onboarding

- Animated brand splash.
- First-run wizard: library name, institution details, preferred language, default loan duration, loan limit, fines enabled/disabled, administrator/librarian profile, optional import, integrations skipped or configured.
- The wizard is resumable and only appears until completed.

### Dashboard

- KPI cards: total titles, total copies, copies on loan, active members, overdue loans, reservations ready.
- Date-range selector and comparison to previous period.
- Recent circulation list, overdue alerts, reservation alerts, low/zero availability, recent activity.
- Circulation trend chart, top categories, most borrowed titles, member activity.
- Quick actions: add book, add member, checkout, return, scan ISBN, import.
- Every card/chart drills into a filtered page; no decorative dead charts.

### Catalog

- Table/grid toggle, persisted preference.
- Search across title, ISBN, author, tags, accession number, barcode, call number, publisher, and description.
- Filters: category, author, language, year range, availability, copy status, shelf, tags, source.
- Sort, column visibility, density, pagination/virtualization, multi-select, bulk category/tag/shelf/archive/export/label actions.
- Saved searches and filter chips.
- Add book manually or from ISBN/DOI/web lookup; deduplicate before save.
- Book form sections: bibliographic info, authors, classification, copies, cover, location, notes, attachments.
- Book details: cover and metadata, authors, copies/statuses, loan history, reservations, attachments, audit timeline, edit/archive actions.
- Copy management: generate/accession number, barcode, condition, shelf, status, label printing/export.
- Cover image can come from provider, local file, clipboard, or camera; cache locally and show fallback artwork.

### ISBN/barcode scanner

- Modal and dedicated page supporting webcam scan, USB scanner keyboard stream, pasted/typed ISBN/barcode, and batch mode.
- Normalize ISBN-10/ISBN-13, validate check digits, distinguish ISBN from local copy barcodes.
- ISBN lookup previews merged provider results before the user confirms creation.
- Existing title/copy matches show clear next actions instead of duplicating records.
- Provide sound/visual success feedback configurable in Settings.

### Circulation

- A focused checkout workflow optimized for barcode scanners: identify member, validate status/limits, scan one or multiple copies, preview due dates, resolve warnings, confirm transaction, optionally print/export receipt.
- Return workflow: scan multiple copies, show borrower/loan/overdue state, record condition, assess optional fine, surface next reservation, confirm transaction.
- Renew single or multiple eligible loans with rule checks.
- Current loans table with member/title/copy/due/status filters and bulk actions.
- Overdue page grouped by urgency, member and department; notification/contact actions must be explicit and locally logged, never automatically contact people without configuration.
- Loan detail drawer/page with complete timeline and audit trail.

### Members

- Searchable/sortable member table and status filters.
- Create/edit form with member-number generation, contact data, department, role, expiry, notes, and avatar.
- Member details: active loans, history, reservations, fines, borrowing limits, activity, contact actions.
- Suspend/reactivate/archive with reasons and confirmations.
- Bulk import/export with mapping, validation, duplicate preview, and error report.

### Reservations

- Queue by title, member, status, and date.
- Create/cancel/expire/fulfil reservations.
- Automatically advance queues on returns; show ready-until deadlines.
- Dashboard/tray notifications for newly available reservations.

### Inventory and shelves

- Shelf/location management with room, floor, section, capacity, and occupancy.
- Inventory session workflow: select scope/shelf, scan expected copies, mark found, flag misplaced/missing, pause/resume session, reconcile with confirmation.
- Copy condition/status workflows: available, on-loan, reserved, repair, lost, archived.
- Inventory discrepancy report and audit history.

### Reports

- Date-range and filter controls shared across reports.
- Circulation totals/trends, overdue aging, popular books, inactive stock, member activity, category/language distribution, acquisitions, inventory status, fines if enabled.
- Charts always paired with an accessible table.
- Export current result to CSV/XLSX and print-friendly PDF/HTML through a clear save dialog.
- Remember report filters and allow saved report presets.

### Activity / audit log

- Immutable timeline with actor, action, entity, timestamp, and before/after details.
- Search/filter by user, action, entity type, and date.
- Link entries back to entities; allow export, never silent deletion.

### Settings

Organize Settings into searchable tabs:

1. **General**: institution/library name, address, contact, timezone `Africa/Algiers`, date format, default language, RTL preview.
2. **Appearance**: system/light/dark theme, density, sidebar mode, reduced motion, accent preview.
3. **Circulation rules**: default duration, per-member-role limits, renewals, reservation expiry, grace period, fines toggle and rate.
4. **Catalog**: accession/barcode templates, default category/language/shelf, metadata provider priority, cover behavior.
5. **Desktop**: launch at startup, start minimized, close to tray, minimize to tray, notifications, sounds, window-state reset.
6. **Shortcuts**: editable in-app and global shortcuts, conflict validation, restore defaults.
7. **Integrations & AI**: provider cards, secrets, endpoints, model selection, connection tests, priority, rate-limit status.
8. **Data**: database health, backup now, scheduled backup preference, restore, CSV/XLSX import/export, clear integration cache, sample data only in development.
9. **About**: version/build, database version, update check, licenses, open data/log/config folders.

Settings must persist using Tauri Store for preferences and Stronghold for secrets. Changes that can apply live should do so immediately; risky changes require confirmation.

## 10. Groq and external library integrations

Create a provider/adaptor architecture so integrations are optional and replaceable. The application must remain fully usable offline.

### Groq

In Settings provide:

- API key field with masked saved state, replace/delete controls, and no way to reveal the full stored key
- base URL defaulting to `https://api.groq.com/openai/v1`
- model selector populated from the provider when possible, with a manual fallback
- test-connection button with clear success/error/latency feedback
- timeout, AI enabled toggle, and optional monthly/request guardrails

Use Groq only for explicit assistive actions such as cleaning imported metadata, proposing categories/tags, summarizing a supplied description, translating catalog text, and turning a natural-language report request into a previewed filter. Never fabricate canonical book facts. Never write AI output to the database without user review/confirmation. Redact personal member data and secrets from prompts. Provide cancellation, errors, rate-limit handling, and an audit note for accepted AI-assisted changes.

### Metadata/web-library providers

Implement adapters and settings cards for:

- Open Library Books/Search/Covers — enabled by default, no secret where not required
- Google Books — optional API key
- Library of Congress — optional public catalog lookup
- Crossref — DOI/journal metadata lookup
- ISBNdb — optional paid API key
- a generic custom OpenAI-compatible or REST metadata provider configuration only if it can be implemented safely with explicit URL allowlisting

Each provider supports enable/disable, priority order, test connection, timeout, cache TTL, masked key status where relevant, and clear attribution/source display. Merge results deterministically: ISBN/DOI exact matches first, preserve source provenance per field, show conflicts to the user, and never overwrite local edits silently. Cache responses with expiry, provide retry/backoff, respect rate limits, and support offline fallback.

Route network calls through narrowly scoped Rust services or the Tauri HTTP plugin with capability allowlists. Validate URLs, require HTTPS except localhost development, cap response sizes, sanitize provider errors, and never log authorization headers.

## 11. Import, export, backup, and recovery

- CSV/XLSX import wizard for books, copies, and members: file picker, sheet selection, header mapping, saved mappings, preview, validation, duplicate strategy, transactional import, progress, cancellation where safe, and downloadable error report.
- Export filtered tables and reports to CSV/XLSX with human-readable headers.
- Full backup creates a timestamped SQLite backup plus essential settings/locally cached covers where appropriate. Use SQLite-safe backup/checkpoint behavior, not a blind copy during writes.
- Restore validates format/version, warns clearly, creates a pre-restore backup, closes/reopens database connections safely, runs migrations, and reports success/failure.
- Never include Stronghold secrets in ordinary exports. If secret backup is ever offered, it must be a separate encrypted, explicitly confirmed operation; otherwise omit it.
- Add database health/integrity checks and useful recovery messaging.

## 12. Reusable components and interaction quality

At minimum implement reusable: Button, IconButton, Input, SearchInput, Select, Combobox, MultiSelect, Checkbox, RadioGroup, Switch, Textarea, DatePicker, FormField, Dialog, ConfirmDialog, Drawer, Popover, DropdownMenu, Tooltip, Tabs, Badge, Avatar, Card, StatCard, DataTable, Pagination, Skeleton, Spinner, EmptyState, ErrorState, Toast, CommandPalette, ShortcutHint, PageHeader, FilterBar, SavedViewMenu, BarcodeInput, CoverImage, StatusBadge, AuditTimeline, and custom titlebar controls.

All mutations need pending/disabled states, validation, success feedback, understandable error recovery, and cache invalidation. Use optimistic updates only where rollback is safe. Dialogs must trap focus, Escape behavior must be predictable, destructive actions require specific confirmations, and table state must be keyboard usable.

Use polished empty states and skeletons, not spinners everywhere. Preserve filters when navigating to details and back. Support deep links between entities. Debounce search and cancel stale work. Large lists must stay responsive.

## 13. Localization and accessibility

- Fully structure strings for English, French, and Arabic; English can be the initial complete translation, but do not hardwire UI text outside locale files.
- Switching Arabic must set `dir="rtl"`, mirror layouts appropriately, keep numbers/identifiers readable, and use IBM Plex Sans Arabic.
- Use semantic HTML, labels, descriptions, focus management, ARIA only where native semantics are insufficient, WCAG AA contrast, and touch targets suitable for desktop touchscreens.
- Every icon-only button has an accessible name and tooltip. Charts have text summaries/tables. Never encode status by color alone.

## 14. Security and privacy

- Local-first: no telemetry and no external request unless the feature/provider is enabled or explicitly invoked.
- Stronghold for secrets; SQLite for library data; Store for non-secret preferences.
- Parameterized SQL, strict input schemas, sanitized file names/paths, least-privilege capabilities, HTTPS provider validation, response size/time limits, and redacted logs.
- Do not expose arbitrary filesystem, URL, shell, or SQL execution to the frontend.
- Do not send member borrowing history or personal information to Groq or metadata APIs.
- Log important local actions, but never log secrets or full sensitive payloads.

## 15. Testing and verification

Add meaningful tests, not snapshots alone:

- validation and ISBN check-digit utilities
- loan eligibility, due dates, renewal and reservation rules
- repository/query behavior against a test SQLite database where practical
- catalog filtering and form validation
- checkout and return happy/error paths
- shortcut suppression while typing
- settings persistence and provider configuration masking
- import mapping/validation
- close-to-tray/quit decision logic isolated for testing

Run and fix:

- TypeScript typecheck
- frontend lint/format checks already configured
- Vitest suite
- Rust `cargo check` and relevant tests
- production frontend build
- Tauri build/check where practical

Manually verify the critical flow: fresh start → onboarding → add book/copy → add member → checkout → dashboard updates → return → history/audit update → restart app → data persists. Also verify custom titlebar, tray restore/quit, single instance, autostart toggle, global shortcut conflict handling, theme/language/RTL, backup/restore validation, API-key masking, and offline behavior.

## 16. Definition of done

The work is complete only when:

- the existing Tauri project launches cleanly with the Warraq identity
- SQLite migrations and persistence work across restarts
- all pages and navigation above exist and their core workflows function
- no production page relies on fake/hardcoded data
- titlebar, tray, close-to-tray, single instance, autostart, window state, startup animation, in-app shortcuts, and global shortcuts work
- Groq and metadata integrations are optional, configurable, secure, testable, and gracefully offline
- forms, tables, filters, imports, exports, backup, settings, audit logs, and reports work
- loading, empty, validation, permission, offline, and error states are handled
- assets and icons are wired into both the frontend and Tauri bundle
- capabilities are least-privilege and secrets are not leaked
- tests and builds pass
- README documents setup, plugin permissions, migrations, integrations, shortcuts, backup location, and the commands to run/test/build

Do not stop at a plan or ask me to manually wire generated code together. Implement, validate, and leave the existing repository in a working, maintainable state. If a genuinely external value is unavailable—such as a production updater signing key—implement the safe configuration surface, document the exact missing value, and keep the rest of the app functional without it.