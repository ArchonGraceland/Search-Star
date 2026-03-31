-- ═══════════════════════════════════════════════════
-- PHASE 5 — Platform Portal Schema Changes
-- ═══════════════════════════════════════════════════

-- 1. Add user_id to platform_accounts
ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS billing_email text;
ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS company_url text;

-- 2. Update role check constraint on profiles to allow 'platform'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin', 'platform'));

-- 3. Create platform_transactions table
CREATE TABLE IF NOT EXISTS platform_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id uuid NOT NULL REFERENCES platform_accounts(id),
  type text NOT NULL CHECK (type IN ('deposit', 'query_debit', 'marketing_debit', 'refund')),
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  description text,
  reference_id text,
  created_at timestamptz DEFAULT now()
);

-- 4. Enable RLS on platform_transactions
ALTER TABLE platform_transactions ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for platform_accounts — platform users can read/update their own
CREATE POLICY "Platform users can read own account"
  ON platform_accounts FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Platform users can update own account"
  ON platform_accounts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6. RLS policies for platform_transactions
CREATE POLICY "Platform users can read own transactions"
  ON platform_transactions FOR SELECT
  USING (
    platform_id IN (SELECT id FROM platform_accounts WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Service role can insert transactions"
  ON platform_transactions FOR INSERT
  WITH CHECK (true);

-- 7. Admin policies for platform_transactions
CREATE POLICY "Admins can manage platform_transactions"
  ON platform_transactions FOR ALL
  USING (is_admin());

-- 8. Admin policies for platform_accounts (if not already existing)
DROP POLICY IF EXISTS "Admins can manage platform_accounts" ON platform_accounts;
CREATE POLICY "Admins can manage platform_accounts"
  ON platform_accounts FOR ALL
  USING (is_admin());

-- 9. Allow platform accounts to be inserted by service role
CREATE POLICY "Service role can insert platform_accounts"
  ON platform_accounts FOR INSERT
  WITH CHECK (true);

