create table if not exists xero_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tenant_name text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Only one token record (singleton for admin)
create unique index if not exists xero_tokens_singleton on xero_tokens ((true));
