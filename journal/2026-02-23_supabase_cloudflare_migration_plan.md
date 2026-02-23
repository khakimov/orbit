# Supabase + Cloudflare Migration Plan

refs: `docs/SECURITY.md`, `docs/CARDS.md`

## Context

Orbit is currently running in local-only mode. Firebase auth replaced with a stub `LocalAuthenticationClient`, sync disabled, data stored in IndexedDB (web) / SQLite (native). The Firebase backend code still exists in the repo but is unwired.

Goal: replace Firebase with Supabase (auth + Postgres + storage) and deploy the web app to Cloudflare Pages.

## Phase 1: Supabase Auth

Scope: real user authentication via Supabase.

1. Install `@supabase/supabase-js` in `packages/app`.
2. Create `packages/app/src/authentication/supabaseClient.ts` — initialise the Supabase client with env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).
3. Slim down `AuthenticationClient` interface — remove Firebase token-exchange methods, keep what the UI actually uses.
4. Create `packages/app/src/authentication/supabaseAuthenticationClient.ts` implementing the slimmed interface:
    - `subscribeToUserAuthState` -> `supabase.auth.onAuthStateChange`
    - `getUserAuthState` -> `supabase.auth.getUser`
    - `signInWithEmailAndPassword` -> `supabase.auth.signInWithPassword`
    - `createUserWithEmailAndPassword` -> `supabase.auth.signUp`
    - `signOut` -> `supabase.auth.signOut`
    - `userExistsWithEmail` -> attempt sign-in or use admin check
    - `sendPasswordResetEmail` -> `supabase.auth.resetPasswordForEmail`
    - `supportsCredentialPersistence` -> return true (Supabase persists sessions by default)
5. Wire up `SupabaseAuthenticationClient` in `_layout.tsx` replacing `LocalAuthenticationClient`.
6. Add a minimal login/signup page at `/login`.
7. Namespace the local database store by `user.id` (fixes the shared-namespace issue from `SECURITY.md`).
8. Unit tests for `SupabaseAuthenticationClient` (mock `@supabase/supabase-js`).

Completion: user can sign up, log in, log out, reset password. Data is still local-only but namespaced per user.

## Phase 2: Supabase Database + Sync

Scope: persist events and entities in Supabase Postgres, sync with local store.

1. Design Postgres schema: `events` and `entities` tables mirroring the local store structure. Add Row Level Security (RLS) policies scoped to `auth.uid()`.
2. Create a Supabase migration for the schema.
3. Create `packages/app/src/sync/supabaseSyncAdapter.ts` — implements push/pull of events to/from Supabase.
    - Push: on `recordEvents`, upsert events to Supabase.
    - Pull: on app load, fetch all events from Supabase (simple full-pull for MVP).
    - Future optimisation: paginate large event histories, delta sync by timestamp.
4. Wire the sync adapter into `DatabaseManager` (the optional `apiClient` path already exists).
5. Handle conflict resolution: events are immutable and append-only, so last-write-wins by timestamp is sufficient.
6. Add Supabase Storage bucket for attachments (replacing the GCS path). Include migration path for existing local attachments.
7. Integration tests for sync adapter (requires Supabase test project or local Supabase CLI).

Completion: data syncs between local store and Supabase. Multiple devices see the same cards.

## Phase 3: Cleanup and Simplify

Scope: remove dead Firebase code, simplify the monorepo.

1. Remove `packages/backend/` (Firebase Cloud Functions).
2. Remove Firebase dependencies from `packages/app/package.json` (`firebase`).
3. Remove Firebase config files (`firebase.json`, `.firebaserc`, `firebaseAuth.ts`, `firebaseAuth.web.ts`, `firebaseAuthenticationClient.ts`).
4. Remove `sentry-expo` references and Sentry DSN config.
5. Remove unused packages if they have no remaining consumers:
    - `api-client` — only used by the old sync adapter
    - `api` — schema types for the old REST API
    - `sync` — old `APISyncAdapter` (replaced by Supabase sync)
6. Clean up `packages/app/src/authentication/index.ts` barrel exports.
7. Evaluate whether `store-shared` + `store-web` + `store-fs` can be simplified.

Completion: no Firebase code remains. Monorepo is leaner.

## Phase 4: Cloudflare Pages Deployment

Scope: deploy the web build to Cloudflare Pages instead of Firebase Hosting.

1. Run `bun run build:web` to produce the static `web-build/` output.
2. Create a Cloudflare Pages project (or `wrangler.toml` if using Wrangler CLI).
3. Configure SPA fallback (`/* -> /index.html`).
4. Set environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) at build time.
5. Remove `packages/app/firebase.json` hosting config and `scripts/deploy_web.sh`.
6. Set up CI deployment (GitHub Actions -> Cloudflare Pages).

Completion: web app served from Cloudflare Pages with global CDN.
