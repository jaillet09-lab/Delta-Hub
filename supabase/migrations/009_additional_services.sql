-- Migration 009: Additional services per client
-- Stores ad-hoc services (window cleaning, pressure washing, vinyl clean, etc.)
-- with their own frequency, charge rate and cleaner cost.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS additional_services jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN clients.additional_services IS
  'Array of { id, name, frequency, my_rate_per_visit, cleaner_cost_per_visit }';
