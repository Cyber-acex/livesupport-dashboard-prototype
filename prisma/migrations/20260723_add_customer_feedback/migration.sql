CREATE TABLE "customer_feedback" (
  "id" SERIAL NOT NULL,
  "token" VARCHAR(128) NOT NULL,
  "ticket_id" INTEGER NOT NULL,
  "customer_id" INTEGER,
  "branch_id" INTEGER,
  "rating" INTEGER,
  "comment" TEXT,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(0) NOT NULL,
  "used_at" TIMESTAMP(0),
  "submitted_at" TIMESTAMP(0),
  "feedback_source" VARCHAR(100),
  "created_by_staff_id" INTEGER,
  CONSTRAINT "customer_feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_feedback_token_key" ON "customer_feedback"("token");
CREATE INDEX "customer_feedback_ticket_id_idx" ON "customer_feedback"("ticket_id");
CREATE INDEX "customer_feedback_branch_id_idx" ON "customer_feedback"("branch_id");

CREATE TABLE "customer_feedback_delivery_logs" (
  "id" SERIAL NOT NULL,
  "feedback_id" INTEGER NOT NULL,
  "channel" VARCHAR(50) NOT NULL,
  "destination" VARCHAR(255),
  "status" VARCHAR(30) NOT NULL,
  "error" TEXT,
  "attempted_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_feedback_delivery_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_feedback_delivery_logs_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "customer_feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "customer_feedback_delivery_logs_feedback_id_idx" ON "customer_feedback_delivery_logs"("feedback_id");
