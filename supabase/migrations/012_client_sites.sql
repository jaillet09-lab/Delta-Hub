-- Multi-site client support

-- Flag on clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS is_multi_site boolean NOT NULL DEFAULT false;

-- Sites table — one row per location for multi-site clients
CREATE TABLE IF NOT EXISTS client_sites (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               uuid          REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  site_name               text          NOT NULL,
  address                 text,
  suburb                  text,
  state                   text          DEFAULT 'QLD',
  postcode                text,
  scope_of_work           text,
  frequency               text,
  service_days            text[]        NOT NULL DEFAULT '{}',
  days_per_week           integer,
  access_details          text,
  assigned_cleaner_id     uuid          REFERENCES profiles(id) ON DELETE SET NULL,
  rate_per_visit          numeric(10,2),
  cleaner_hourly_rate     numeric(10,2),
  cleaner_hours_per_visit numeric(5,2),
  additional_services     jsonb         NOT NULL DEFAULT '[]',
  notes                   text,
  sort_order              integer       NOT NULL DEFAULT 0,
  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now()
);

-- Link jobs to a specific site (nullable — null = single-site client)
ALTER TABLE job_assignments
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES client_sites(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE client_sites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_all_client_sites" ON client_sites
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Trigger
DROP TRIGGER IF EXISTS set_client_sites_updated_at ON client_sites;
CREATE TRIGGER set_client_sites_updated_at
  BEFORE UPDATE ON client_sites
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS client_sites_client_idx  ON client_sites(client_id);
CREATE INDEX IF NOT EXISTS job_assignments_site_idx ON job_assignments(site_id)
  WHERE site_id IS NOT NULL;
