-- Events table: stores the full event-sourced history per user.
-- Entity state (tasks, attachments) is derived locally by replaying events.

CREATE TABLE events (
  id               TEXT PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id),
  entity_id        TEXT NOT NULL,
  type             TEXT NOT NULL,
  timestamp_millis BIGINT NOT NULL,
  data             JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX events_user_entity ON events (user_id, entity_id);
CREATE INDEX events_user_created ON events (user_id, created_at);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own events.
CREATE POLICY events_user_isolation ON events
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
