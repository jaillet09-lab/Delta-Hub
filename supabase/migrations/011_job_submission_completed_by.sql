-- Track whether a job was completed by the cleaner, admin, or manager
ALTER TABLE job_submissions
  ADD COLUMN IF NOT EXISTS completed_by_role text
    CHECK (completed_by_role IN ('cleaner', 'admin', 'manager'));

-- Existing rows with completed_at and no role are assumed cleaner-submitted
UPDATE job_submissions
SET completed_by_role = 'cleaner'
WHERE completed_at IS NOT NULL AND completed_by_role IS NULL;
