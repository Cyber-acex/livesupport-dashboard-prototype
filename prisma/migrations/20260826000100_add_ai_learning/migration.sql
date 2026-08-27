-- Additive AI Learning migration.
-- Existing notifications and tickets tables are intentionally untouched.

ALTER TABLE "ai_feedback" ADD COLUMN IF NOT EXISTS "kind" VARCHAR(40);
ALTER TABLE "ai_feedback" ADD COLUMN IF NOT EXISTS "category" VARCHAR(50);
ALTER TABLE "ai_feedback" ADD COLUMN IF NOT EXISTS "severity" VARCHAR(20);
CREATE INDEX IF NOT EXISTS "ai_feedback_category_created_at_idx" ON "ai_feedback" ("category", "created_at");
CREATE INDEX IF NOT EXISTS "ai_feedback_conversation_created_at_idx" ON "ai_feedback" ("conversation_id", "created_at");

CREATE TABLE IF NOT EXISTS "ai_activity" (
  "id" SERIAL NOT NULL,
  "conversation_id" INTEGER,
  "message_id" INTEGER,
  "event_type" VARCHAR(50) NOT NULL,
  "intent" VARCHAR(120),
  "confidence" DOUBLE PRECISION,
  "action_type" VARCHAR(80),
  "outcome" VARCHAR(30),
  "metadata" JSONB,
  "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_activity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ai_activity_conversation_created_at_idx" ON "ai_activity" ("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_activity_event_type_created_at_idx" ON "ai_activity" ("event_type", "created_at");
ALTER TABLE "ai_activity" ADD CONSTRAINT "ai_activity_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ai_decisions" (
  "id" SERIAL NOT NULL,
  "conversation_id" INTEGER,
  "message_id" INTEGER,
  "intent" VARCHAR(120),
  "confidence" DOUBLE PRECISION,
  "selected_branch" VARCHAR(120),
  "selected_action" VARCHAR(80),
  "metadata" JSONB,
  "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_decisions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ai_decisions_conversation_created_at_idx" ON "ai_decisions" ("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_decisions_intent_created_at_idx" ON "ai_decisions" ("intent", "created_at");
ALTER TABLE "ai_decisions" ADD CONSTRAINT "ai_decisions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ai_actions" (
  "id" SERIAL NOT NULL,
  "conversation_id" INTEGER,
  "message_id" INTEGER,
  "action_type" VARCHAR(80) NOT NULL,
  "input_ref" VARCHAR(255),
  "result" JSONB,
  "success" BOOLEAN NOT NULL DEFAULT FALSE,
  "error" TEXT,
  "execution_ms" INTEGER,
  "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_actions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ai_actions_conversation_created_at_idx" ON "ai_actions" ("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_actions_action_type_success_created_at_idx" ON "ai_actions" ("action_type", "success", "created_at");
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ai_corrections" (
  "id" SERIAL NOT NULL,
  "conversation_id" INTEGER,
  "message_id" INTEGER,
  "staff_id" INTEGER,
  "original_response" TEXT,
  "corrected_response" TEXT,
  "explanation" TEXT,
  "expected_behavior" TEXT,
  "status" VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_corrections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ai_corrections_conversation_created_at_idx" ON "ai_corrections" ("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_corrections_status_created_at_idx" ON "ai_corrections" ("status", "created_at");
ALTER TABLE "ai_corrections" ADD CONSTRAINT "ai_corrections_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ai_learning_candidates" (
  "id" SERIAL NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "proposed_rule" TEXT NOT NULL,
  "category" VARCHAR(80),
  "evidence_count" INTEGER NOT NULL DEFAULT 0,
  "confidence" DOUBLE PRECISION,
  "source_feedback" JSONB,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "reviewed_by" INTEGER,
  "reviewed_at" TIMESTAMP(0),
  "review_reason" TEXT,
  "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_learning_candidates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ai_learning_candidates_status_created_at_idx" ON "ai_learning_candidates" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "ai_learning_candidates_category_status_idx" ON "ai_learning_candidates" ("category", "status");

CREATE TABLE IF NOT EXISTS "ai_rules" (
  "id" SERIAL NOT NULL,
  "rule" TEXT NOT NULL,
  "category" VARCHAR(80),
  "priority" INTEGER NOT NULL DEFAULT 50,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "source" VARCHAR(80),
  "confidence" DOUBLE PRECISION,
  "branch_id" INTEGER,
  "workflow" VARCHAR(80),
  "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ai_rules_active_category_priority_idx" ON "ai_rules" ("active", "category", "priority");
CREATE INDEX IF NOT EXISTS "ai_rules_active_branch_id_workflow_idx" ON "ai_rules" ("active", "branch_id", "workflow");

CREATE TABLE IF NOT EXISTS "ai_examples" (
  "id" SERIAL NOT NULL,
  "situation" TEXT NOT NULL,
  "customer_message" TEXT,
  "successful_response" TEXT,
  "action" VARCHAR(80),
  "outcome" VARCHAR(80),
  "quality_score" DOUBLE PRECISION,
  "source" VARCHAR(80),
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_examples_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ai_examples_active_created_at_idx" ON "ai_examples" ("active", "created_at");

CREATE TABLE IF NOT EXISTS "ai_mistake_patterns" (
  "id" SERIAL NOT NULL,
  "pattern" TEXT NOT NULL,
  "occurrence_count" INTEGER NOT NULL DEFAULT 1,
  "severity" VARCHAR(20),
  "first_seen" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved" BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "ai_mistake_patterns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ai_mistake_patterns_resolved_last_seen_idx" ON "ai_mistake_patterns" ("resolved", "last_seen");

CREATE TABLE IF NOT EXISTS "ai_evaluation_metrics" (
  "id" SERIAL NOT NULL,
  "period_start" TIMESTAMP(0) NOT NULL,
  "total_conversations" INTEGER NOT NULL DEFAULT 0,
  "successful_conversations" INTEGER NOT NULL DEFAULT 0,
  "failed_conversations" INTEGER NOT NULL DEFAULT 0,
  "corrections" INTEGER NOT NULL DEFAULT 0,
  "successful_actions" INTEGER NOT NULL DEFAULT 0,
  "failed_actions" INTEGER NOT NULL DEFAULT 0,
  "average_confidence" DOUBLE PRECISION,
  "escalation_rate" DOUBLE PRECISION,
  "correction_rate" DOUBLE PRECISION,
  "resolution_rate" DOUBLE PRECISION,
  "learning_candidates" INTEGER NOT NULL DEFAULT 0,
  "approved_improvements" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_evaluation_metrics_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_evaluation_metrics_period_start_key" ON "ai_evaluation_metrics" ("period_start");
CREATE INDEX IF NOT EXISTS "ai_evaluation_metrics_period_start_idx" ON "ai_evaluation_metrics" ("period_start");
