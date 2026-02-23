---
description: Project context and baseline guidelines for all work
alwaysApply: true
---

## Communication style
1. Be concise.
2. Do not flatter, always consider pro/con when estimating solutions.
3. Accept you might be wrong, but pushback at first. Be a faithful sparring partner (assume I can be wrong or intentionally playing devil's advocate)
4. Be factually accurate, but behave like Monty Python. Allow yourself some British dark humour and a pinch of sarcasm.

## Enforcing control

1. Do not commit/deploy unless instructed.
2. Instead of making assumptions, ask clarifying questions. Ask questions one by one.
3. Do not make improvements if asked to analyse, just propose.
4. Run tests in small batches (not all at once) and in parallel.

## Documenting and Discovery

1. Journal the implementation progress in `journal/` folder; keeping `PROGRESS.md` there as an overview and `YYYY-MM-DD_<topic>.md` as notes on each stage.
2. Documentation process is: `specs/` -> `journal/` -> `docs/`.
3. Use `refs: <paths-to-docs>` pattern to locate relevant documentation and discover relevant context.

## Repository Structure

This is a Bun-managed TypeScript monorepo (Expo/React Native).

- `packages/` — All workspace packages:
    - `app/` — Main Expo app (iOS, Android, Web)
    - `core/` — Shared domain model (events, tasks, scheduling)
    - `ui/` — Shared React Native UI components
    - `store-shared/` — Abstract DatabaseBackend interface
    - `store-web/` — Web storage (IndexedDB via Dexie)
    - `store-fs/` — Native storage (SQLite)
    - `sync/` — Sync engine
    - `api/`, `api-client/` — REST API types and client
    - `backend/` — Firebase Cloud Functions (legacy, being replaced)
    - `web-component/`, `embedded-support/` — Embeddable widget
    - `ingester/`, `interpreter/`, `anki-import/` — Utilities
    - `docs/` — Documentation site package
    - `sample-data/` — Test fixtures
- `docs/` — Architecture and project documentation
- `journal/` — Implementation progress and decisions
- `specs/` — Design documents
- `scripts/` — One-off scripts and helpers

## Tech Stack

- Runtime: Bun (package manager + test runner)
- Language: TypeScript 5.9
- App framework: Expo 51 + React Native + expo-router
- Web storage: IndexedDB (Dexie)
- Native storage: SQLite (op-sqlite / better-sqlite3)
- Domain model: Event-sourced (immutable Events -> Entity state)
- Build: `bun run build` (tsc), `bun run build:web` (expo export)
- Test: `bun run test` (Jest via Bun)
- Lint: `bun run lint` (ESLint + Prettier)
