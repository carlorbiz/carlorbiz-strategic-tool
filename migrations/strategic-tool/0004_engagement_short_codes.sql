-- Add short_code column to st_engagements for clean URLs
-- e.g. /e/AcM7kP instead of /e/a1b2c3d4-0001-4000-8000-000000000001

ALTER TABLE st_engagements
  ADD COLUMN IF NOT EXISTS short_code TEXT UNIQUE;

-- Generate short codes for existing engagements
UPDATE st_engagements
SET short_code = substr(md5(id::text), 1, 6)
WHERE short_code IS NULL;

-- Make it NOT NULL with a default for new rows
ALTER TABLE st_engagements
  ALTER COLUMN short_code SET DEFAULT substr(md5(gen_random_uuid()::text), 1, 6);

ALTER TABLE st_engagements
  ALTER COLUMN short_code SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_st_engagements_short_code ON st_engagements (short_code);
