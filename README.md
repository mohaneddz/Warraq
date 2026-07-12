# Warraq

Warraq is a local-first desktop library system for Mustapha Bacha Hospital, built with Tauri v2, React, TypeScript, Tailwind, and SQLite.

## Run and verify

    pnpm install
    pnpm tauri dev
    pnpm typecheck
    pnpm test
    pnpm build
    pnpm rust:check

## Data and security

- Library data is stored as sqlite:warraq.db in the Tauri application-data directory.
- Rust-managed migrations are in src-tauri/migrations; the SQL plugin preloads and migrates the database on startup.
- Non-secret preferences live in Tauri Store. API keys belong in Stronghold and are represented in the UI only by masked status.
- Backups and exports must not contain Stronghold secrets.

## Desktop behavior

The window has a custom titlebar, persistent window state, single-instance handling, and close-to-tray behavior. The tray provides restore, search, circulation, settings, and explicit quit actions. Default in-app shortcuts include Ctrl/Cmd+K, slash, and Ctrl/Cmd+comma.

## Integrations

The app is usable offline. Open Library is the intended default metadata provider; Google Books, Library of Congress, Crossref, ISBNdb, Groq, and custom HTTPS providers are optional. Native code validates provider URLs and requires HTTPS except localhost during development.

## Permissions

src-tauri/capabilities/default.json grants only the Tauri SQL, Store, Stronghold, desktop, dialog/filesystem, notification, clipboard, log, and opener plugin permissions required by the application. No shell permission or arbitrary frontend network permission is granted.
