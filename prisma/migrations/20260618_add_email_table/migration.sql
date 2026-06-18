-- CreateTable "emails"
CREATE TABLE "emails" (
    "id" SERIAL NOT NULL,
    "from" VARCHAR(255) NOT NULL,
    "fromEmail" VARCHAR(255) NOT NULL,
    "to" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "preview" TEXT,
    "date" TIMESTAMP(0),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isSpam" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emails_fromEmail_idx" ON "emails"("fromEmail");

-- CreateIndex
CREATE INDEX "emails_to_idx" ON "emails"("to");

-- CreateIndex
CREATE INDEX "emails_created_at_idx" ON "emails"("created_at");
