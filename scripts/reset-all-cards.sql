-- Reset all cards to brand-new state (enters learning steps on next review).
-- Run once against Supabase. Inserts a TaskResetComponent event per component.
--
-- Usage:
--   psql $DATABASE_URL -f scripts/reset-all-cards.sql
--   or paste into Supabase SQL Editor
--
-- What it does:
--   1. Finds the latest TaskIngestEvent per entity (to discover component IDs)
--   2. Inserts one taskResetComponent event per component per task
--   3. On next sync, clients replay these events and reset card state
--
-- Safe to run multiple times (uses gen_random_uuid for unique event IDs).

WITH task_components AS (
  -- Get the latest ingest event per task to extract component IDs.
  -- QA/Plain tasks have "main"; cloze tasks have multiple components.
  SELECT DISTINCT ON (e.entity_id)
    e.user_id,
    e.entity_id,
    e.data
  FROM events e
  WHERE e.type = 'taskIngest'
  ORDER BY e.entity_id, e.timestamp_millis DESC
),
components_expanded AS (
  -- Extract each component ID from the task spec.
  -- QA/Plain: no "components" key -> just "main"
  -- Cloze: "components" object -> one row per key
  SELECT
    tc.user_id,
    tc.entity_id,
    COALESCE(comp.key, 'main') AS component_id
  FROM task_components tc
  LEFT JOIN LATERAL jsonb_each(tc.data->'spec'->'content'->'components') comp ON true
),
reset_events AS (
  SELECT
    replace(replace(
      left(encode(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 'base64'), 22),
      '+', '-'), '/', '_') AS event_id,
    ce.user_id,
    ce.entity_id,
    ce.component_id,
    (extract(epoch FROM now()) * 1000)::bigint AS ts_millis
  FROM components_expanded ce
)
INSERT INTO events (id, user_id, entity_id, type, timestamp_millis, data)
SELECT
  re.event_id,
  re.user_id,
  re.entity_id,
  'taskResetComponent',
  re.ts_millis,
  jsonb_build_object(
    'id', re.event_id,
    'entityID', re.entity_id,
    'type', 'taskResetComponent',
    'timestampMillis', re.ts_millis,
    'componentID', re.component_id
  )
FROM reset_events re;
