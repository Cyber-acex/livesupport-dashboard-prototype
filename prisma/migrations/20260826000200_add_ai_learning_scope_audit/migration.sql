-- Additive follow-up for scoped knowledge and review audit metadata.
ALTER TABLE "ai_learning_candidates" ADD COLUMN IF NOT EXISTS "review_reason" TEXT;
ALTER TABLE "ai_rules" ADD COLUMN IF NOT EXISTS "branch_id" INTEGER;
ALTER TABLE "ai_rules" ADD COLUMN IF NOT EXISTS "workflow" VARCHAR(80);
CREATE INDEX IF NOT EXISTS "ai_rules_active_branch_id_workflow_idx" ON "ai_rules" ("active", "branch_id", "workflow");
