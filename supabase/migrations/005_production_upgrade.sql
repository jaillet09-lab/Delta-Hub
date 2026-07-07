-- Delta Operations Hub — Production Upgrade (idempotent)

-- ─────────────────────────────────────────────
-- 1. LEADS PIPELINE
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('lead', 'contacted', 'quoted', 'won', 'lost');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS leads (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name     text        NOT NULL,
  contact_name      text,
  contact_email     text,
  contact_phone     text,
  status            lead_status NOT NULL DEFAULT 'lead',
  last_contact_date date,
  quote_value       numeric(10,2),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_all_leads" ON leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- 2. SETTINGS TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text        UNIQUE NOT NULL,
  value      jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_all_settings" ON settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO settings (key, value) VALUES
  ('business', '{"name":"Delta Cleaning","email":"hello@deltacleaning.com.au","phone":"0412 844 238","website":"https://www.deltacleaning.com.au","address":"Brisbane, QLD"}'),
  ('margin_thresholds', '{"red":24,"yellow":40}'),
  ('valuation_multiple', '2.5'),
  ('survey_frequency_days', '90'),
  ('lead_followup_days', '7'),
  ('contract_renewal_days', '60'),
  ('survey_questions', '[{"id":"q1","key":"quality_score","text":"How would you rate the quality of our cleaning service?","min":1,"max":10},{"id":"q2","key":"reliability_score","text":"How reliable is our team (on time, consistent)?","min":1,"max":10},{"id":"q3","key":"communication_score","text":"How would you rate our communication and responsiveness?","min":1,"max":10},{"id":"q4","key":"value_score","text":"How well does our service represent value for money?","min":1,"max":10},{"id":"q5","key":"nps_score","text":"How likely are you to recommend Delta Cleaning to others? (0 = not at all, 10 = extremely likely)","min":0,"max":10}]')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────
-- 3. CLIENT ENHANCEMENTS
-- ─────────────────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_expiry_date  date;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS visits_per_month      numeric(8,3);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS monthly_labour_cost   numeric(10,2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS monthly_profit        numeric(10,2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS margin_pct            numeric(5,2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS profile_complete      boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────
-- 4. PROFIT CALCULATION TRIGGER
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION frequency_to_visits_per_month(f frequency_type)
RETURNS numeric AS $$
BEGIN
  RETURN CASE f
    WHEN 'daily'       THEN 365.0 / 12.0
    WHEN 'weekly'      THEN 52.0  / 12.0
    WHEN 'fortnightly' THEN 26.0  / 12.0
    WHEN 'monthly'     THEN 1.0
    WHEN 'quarterly'   THEN 4.0   / 12.0
    WHEN 'annual'      THEN 1.0   / 12.0
    WHEN 'one_off'     THEN 1.0
    ELSE 1.0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION compute_client_profit()
RETURNS TRIGGER AS $$
DECLARE
  v_visits   numeric;
  v_revenue  numeric;
  v_labour   numeric;
  v_profit   numeric;
  v_margin   numeric;
  v_complete boolean;
BEGIN
  v_visits := CASE WHEN NEW.frequency IS NOT NULL
    THEN frequency_to_visits_per_month(NEW.frequency) ELSE 1 END;

  v_revenue := CASE WHEN NEW.rate_per_visit IS NOT NULL
    THEN ROUND(NEW.rate_per_visit * v_visits, 2) ELSE NULL END;

  v_labour := CASE WHEN NEW.cleaner_hourly_rate IS NOT NULL AND NEW.cleaner_hours_per_visit IS NOT NULL
    THEN ROUND(NEW.cleaner_hourly_rate * NEW.cleaner_hours_per_visit * v_visits, 2) ELSE NULL END;

  v_profit := CASE WHEN v_revenue IS NOT NULL AND v_labour IS NOT NULL
    THEN ROUND(v_revenue - v_labour, 2) ELSE NULL END;

  v_margin := CASE WHEN v_revenue IS NOT NULL AND v_revenue > 0 AND v_profit IS NOT NULL
    THEN ROUND((v_profit / v_revenue) * 100, 1) ELSE NULL END;

  v_complete := (
    NEW.rate_per_visit          IS NOT NULL AND
    NEW.cleaner_hourly_rate     IS NOT NULL AND
    NEW.cleaner_hours_per_visit IS NOT NULL AND
    NEW.frequency               IS NOT NULL
  );

  NEW.visits_per_month    := ROUND(v_visits, 3);
  NEW.monthly_value       := v_revenue;
  NEW.annual_value        := CASE WHEN v_revenue IS NOT NULL THEN ROUND(v_revenue * 12, 2) ELSE NULL END;
  NEW.monthly_labour_cost := v_labour;
  NEW.monthly_profit      := v_profit;
  NEW.margin_pct          := v_margin;
  NEW.profile_complete    := v_complete;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_profit_calc ON clients;
CREATE TRIGGER client_profit_calc
  BEFORE INSERT OR UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION compute_client_profit();

-- Back-fill existing rows
UPDATE clients SET updated_at = now();

-- ─────────────────────────────────────────────
-- 5. INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS clients_margin_pct_idx       ON clients(margin_pct)           WHERE active = true;
CREATE INDEX IF NOT EXISTS clients_contract_expiry_idx  ON clients(contract_expiry_date) WHERE active = true;
CREATE INDEX IF NOT EXISTS clients_profile_complete_idx ON clients(profile_complete)     WHERE active = true;
CREATE INDEX IF NOT EXISTS leads_status_idx             ON leads(status);
CREATE INDEX IF NOT EXISTS leads_last_contact_idx       ON leads(last_contact_date);
