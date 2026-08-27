-- Additive AI Learning settings; existing settings values are preserved.
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "ai_learning_enabled" BOOLEAN DEFAULT TRUE;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "ai_candidate_detection" BOOLEAN DEFAULT TRUE;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "ai_require_approval" BOOLEAN DEFAULT TRUE;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "ai_evidence_threshold" INTEGER DEFAULT 3;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "ai_learning_scope" VARCHAR(20) DEFAULT 'global';