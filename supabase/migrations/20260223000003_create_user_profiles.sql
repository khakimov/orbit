-- User profiles: per-user settings including Telegram account linking.

CREATE TABLE user_profiles (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id),
  telegram_chat_id     BIGINT UNIQUE,
  telegram_username    TEXT,
  telegram_linked_at   TIMESTAMPTZ,
  linking_token        TEXT UNIQUE,
  linking_token_expires_at TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own profile.
CREATE POLICY user_profiles_self ON user_profiles
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role needs to look up profiles by telegram_chat_id (for Mochki bot).
-- The service role key bypasses RLS, so no extra policy needed.
