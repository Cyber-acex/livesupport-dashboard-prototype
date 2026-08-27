-- Reconcile the voice table created by the earlier deployed voice migration.
ALTER TABLE "voice_channels" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "voice_channels" ADD COLUMN IF NOT EXISTS "type" VARCHAR(20) NOT NULL DEFAULT 'BRANCH';
CREATE UNIQUE INDEX IF NOT EXISTS "voice_channels_branch_id_type_key" ON "voice_channels"("branch_id", "type");