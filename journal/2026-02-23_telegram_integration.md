# Telegram Integration via Mochki

Date: 2026-02-23

## What

Connected Orbit's spaced repetition system to Telegram via Mochki (existing Telegram SRS bot). Users can link their Telegram account in Orbit settings, then review due cards directly in Telegram. Reviews sync back to Orbit through the shared Supabase event store.

## Architecture

```
Orbit Web App            Mochki (CF Worker)
     |                         |
     v                         v
Supabase (shared)
  |- user_profiles (telegram_chat_id mapping)
  |- events (read by Mochki, TaskRepetitionEvent written by Mochki)
```

Mochki uses `@withorbit/core` directly -- `eventReducer()` replays events into Task entities, `createReviewQueue()` computes due cards. No intermediate API needed; Mochki talks to Supabase with a service role key.

## Key decisions

- `@withorbit/core` is Workers-compatible (zero deps, pure TS). Linked via `file:` path for now.
- Mochki becomes Orbit-only (removed standalone card import API).
- Rating simplified from FSRS 4-point (Again/Hard/Good/Easy) to Orbit's 2-outcome model (Remembered/Forgotten).
- Account linking via Telegram deep link: `t.me/<bot>?start=<token>`. Edge function generates short-lived token, bot validates and binds chat_id on `/start`.
- DO keeps: user session state, chat Q&A, reminder alarms. Card data lives only in Supabase.

## Changes

Orbit:
- `supabase/migrations/20260223_create_user_profiles.sql` -- user_profiles table with telegram linking fields
- `supabase/functions/link-telegram/index.ts` -- token generation, status check, unlink
- `supabase/config.toml` -- registered new function
- `packages/app/src/app/(auth)/settings.tsx` -- Telegram link/unlink UI

Mochki (`/Users/rus/Projects/current/rnd/mochi/mochki`):
- `src/orbit/adapter.ts` -- Supabase event fetch, replay, review queue, record review
- `src/orbit/supabase-client.ts` -- singleton Supabase client
- `src/env.d.ts` -- Supabase env type extension
- `src/commands/start.ts` -- handles linking token, checks existing link
- `src/commands/review.ts` -- fetches due cards from Supabase via adapter
- `src/commands/stats.ts` -- due count from Supabase
- `src/callbacks/review.ts` -- Remembered/Forgotten buttons, records TaskRepetitionEvent
- `src/mochki-state-do.ts` -- added orbit user_id cache, alarm uses Supabase
- `src/index.ts` -- removed card import API (cards come from Orbit)
- `src/constants.ts` -- removed FSRS rating constants
- `package.json` -- added @supabase/supabase-js, @withorbit/core
- `wrangler.jsonc` -- Supabase secrets comment

## Deployment prerequisites

1. Run Supabase migration: `supabase db push`
2. Deploy edge function: `supabase functions deploy link-telegram`
3. Set Mochki secrets: `wrangler secret put SUPABASE_URL` and `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`
4. Set `TELEGRAM_BOT_USERNAME` env var on the link-telegram edge function
5. Deploy Mochki: `pnpm deploy`
