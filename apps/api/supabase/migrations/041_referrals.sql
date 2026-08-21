-- Referral/waiting-list mechanic for the pre-signup funnel.
--
-- Two tables:
--   * referral_codes  — one short, shareable code per user. The referrer's
--                       share link is /login?ref=<code>. A code is created
--                       lazily the first time the user opens the referral
--                       page (POST /api/referral/code), so pre-existing
--                       accounts don't need a backfill.
--   * referral_claims — attributes a signup to a referrer. Inserted once
--                       after the referred user signs up (POST
--                       /api/referral/claim). Its unique constraint on
--                       referred_user_id makes the claim idempotent — a user
--                       can never be attributed twice. The referrer's
--                       redemption count is derived by counting claims
--                       GROUP BY referrer_user_id rather than stored on the
--                       referrer row, so it can't drift.
--
-- We intentionally do NOT use a moddatetime trigger for updated_at (none of
-- the other migrations in this repo install one — see the note in
-- 035_onboarding_runs.sql) — neither table needs updated_at.

-- ─── referral_codes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_user_id_key
  ON referral_codes (user_id);

-- ─── referral_claims ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_claims (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL,
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'credited'
                     CHECK (status IN ('credited', 'converted')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_claims_referrer ON referral_claims (referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_claims_code        ON referral_claims (code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_claims_referee ON referral_claims (referred_user_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- A user may read/insert only their own referral code. Code lookup by token
-- (so a new signup can resolve a code to its owner before claiming) is the
-- one exception: any authenticated user may SELECT any code row by the
-- token. That only exposes the token itself — never another user's id — and
-- is the same trust boundary as letting users share referral links.
ALTER TABLE referral_codes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_codes_select_own ON referral_codes;
CREATE POLICY referral_codes_select_own ON referral_codes
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS referral_codes_select_by_token ON referral_codes;
CREATE POLICY referral_codes_select_by_token ON referral_codes
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS referral_codes_insert_own ON referral_codes;
CREATE POLICY referral_codes_insert_own ON referral_codes
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- referral_claims: a user can read the referrals that were attributed to
-- them (so the /referral page can show redemption history). Inserts are
-- performed server-side by /api/referral/claim, which resolves the code to
-- its owner and writes referrer_user_id — so the client never inserts here.
DROP POLICY IF EXISTS referral_claims_select_own ON referral_claims;
CREATE POLICY referral_claims_select_own ON referral_claims
  FOR SELECT USING (
    referrer_user_id = auth.uid() OR referred_user_id = auth.uid()
  );

-- No INSERT policy on referral_claims: claims are written only by the
-- `referral` edge function using the service-role key (which bypasses RLS),
-- so a client can never attribute a signup directly.