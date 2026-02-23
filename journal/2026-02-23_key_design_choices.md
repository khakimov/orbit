# Key Design Choices: Supabase + Cloudflare Migration

refs: `journal/2026-02-23_supabase_cloudflare_migration_plan.md`

## 1. Supabase over alternatives

Options considered:
- Supabase (Postgres + Auth + Realtime + Storage)
- PlanetScale (MySQL, no built-in auth)
- Neon (Postgres, no built-in auth)
- Keep Firebase but modernise

Decision: Supabase. Single service covers auth, database, storage, and realtime. Free tier is generous for MVP. Postgres is a natural fit since the local stores already use SQL (SQLite).

## 2. Local-first with cloud sync (not cloud-first)

The app already works offline with IndexedDB/SQLite. Rather than making Supabase the primary store and the local DB a cache, we keep the local store as primary and sync to Supabase.

Rationale:
- Offline-first is core to the spaced repetition UX (review anywhere, even without internet)
- Event-sourced model makes sync straightforward (append-only events, no conflicts)
- Reduces latency for reviews (write locally, sync in background)

## 3. Cloudflare Pages over alternatives

Options considered:
- Cloudflare Pages (static + SPA, free tier, global CDN)
- Vercel (good Expo support, but overkill — no SSR needed)
- Netlify (similar to Cloudflare, less performant CDN)
- Keep Firebase Hosting

Decision: Cloudflare Pages. The web app is a static SPA export from Expo — no server-side rendering needed. Cloudflare's free tier is unlimited requests/bandwidth for static sites. If we ever need server-side logic, Cloudflare Workers are available.

## 4. Simplify the AuthenticationClient interface

The current `AuthenticationClient` interface has many methods specific to Firebase's token exchange flow (`getCurrentIDToken`, `getLoginTokenUsingSessionCookie`, `refreshSessionCookie`, etc.). With Supabase, auth is handled by the Supabase client directly.

Decision: slim the interface down to the methods the app actually uses:
- `subscribeToUserAuthState`
- `getUserAuthState`
- `signInWithEmailAndPassword`
- `createUserWithEmailAndPassword`
- `signOut`

Remove or deprecate the token-exchange methods.

## 5. Row Level Security for multi-tenancy

Supabase RLS policies will scope all queries to `auth.uid()`. This means:
- No application-level user filtering needed
- Data isolation enforced at the database level
- The anon key is safe to expose in the client (RLS prevents cross-user access)

## 6. Per-user database namespace on client

Currently the local store uses a fixed name `"shared.orbitStore"` for all users (flagged in `SECURITY.md`). With real auth, we namespace the store by user ID: `"orbitStore.{userId}"`.

This prevents data leakage if multiple users log in on the same browser, and makes logout/account-switch clean.
