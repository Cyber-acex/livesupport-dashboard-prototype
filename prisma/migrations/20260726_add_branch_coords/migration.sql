-- Add latitude and longitude to branches
ALTER TABLE "branches"
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;

ALTER TABLE "branches"
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
