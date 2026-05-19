-- CreateTable
CREATE TABLE "conversations" (
    "id" SERIAL NOT NULL,
    "phone" VARCHAR(255),
    "name" VARCHAR(255),
    "platform" VARCHAR(50) DEFAULT 'whatsapp',
    "last_viewed" TIMESTAMP(0),
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "sender" VARCHAR(50) NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replies" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "sender" VARCHAR(50) NOT NULL,
    "message" TEXT,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "sender" VARCHAR(255) NOT NULL,
    "message" TEXT,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_messages" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "sender" VARCHAR(255) NOT NULL,
    "message" TEXT,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai replies" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "sender" VARCHAR(255) NOT NULL,
    "message" TEXT,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff replies" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "sender" VARCHAR(255) NOT NULL,
    "message" TEXT,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resolved" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "resolved_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resolved_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalations" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "customer_name" VARCHAR(255),
    "escalated_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_by" VARCHAR(255),
    "claim_time" TIMESTAMP(0),
    "snoozed_until" TIMESTAMP(0),
    "alarm_active" BOOLEAN DEFAULT true,

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "customer_name" VARCHAR(255),
    "refunded_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_feedback" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER,
    "message_id" INTEGER,
    "user_id" INTEGER,
    "rating" INTEGER,
    "feedback_text" TEXT,
    "correction" TEXT,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) DEFAULT 'agent',
    "disabled" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "displayName" VARCHAR(255),
    "email" VARCHAR(255),
    "password" VARCHAR(255),
    "autoReply" VARCHAR(255),
    "chatEnabled" VARCHAR(10),
    "msgAlert" BOOLEAN,
    "ticketAlert" BOOLEAN,
    "soundAlert" BOOLEAN,
    "priority" VARCHAR(20),
    "autoAssign" VARCHAR(10),
    "theme" VARCHAR(20),
    "translateEnabled" BOOLEAN,
    "translateLang" VARCHAR(10),
    "avatarUrl" TEXT,
    "autopilotMode" VARCHAR(20),

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "order_id" VARCHAR(255),
    "customer_name" VARCHAR(255),
    "phone" VARCHAR(255),
    "product" TEXT,
    "amount" DECIMAL(10,2),
    "total_amount" DECIMAL(10,2),
    "status" VARCHAR(50),
    "order_date" TIMESTAMP(0),
    "conversation_id" INTEGER,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "rider_name" VARCHAR(255),
    "vehicle" VARCHAR(128),
    "current_lat" DOUBLE PRECISION,
    "current_lng" DOUBLE PRECISION,
    "customer_lat" DOUBLE PRECISION,
    "customer_lng" DOUBLE PRECISION,
    "delivery_status" VARCHAR(64),
    "order_confirmed_time" TIMESTAMP(0),
    "rider_assigned_time" TIMESTAMP(0),
    "picked_up_time" TIMESTAMP(0),
    "in_transit_time" TIMESTAMP(0),
    "arriving_time" TIMESTAMP(0),
    "delivered_time" TIMESTAMP(0),
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" SERIAL NOT NULL,
    "content" TEXT,
    "escalated" BOOLEAN,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" SERIAL NOT NULL,
    "ticket_type" VARCHAR(255),
    "subject" VARCHAR(255),
    "customer_name" VARCHAR(255),
    "customer_phone" VARCHAR(255),
    "assignee" VARCHAR(255),
    "priority" VARCHAR(20),
    "status" VARCHAR(50),
    "content" TEXT,
    "tags" TEXT,
    "attachments" TEXT,
    "sla_due" TIMESTAMP(0),
    "escalated" BOOLEAN,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foods" (
    "id" SERIAL NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "key_name" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "available" INTEGER NOT NULL,
    "image_url" TEXT,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "foods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_conversations" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "ig_id" VARCHAR(255),
    "ig_username" VARCHAR(255),
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_avatars" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_avatars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_issues" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "customer_name" VARCHAR(255),
    "reported_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resolved_conversation_id_key" ON "resolved"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "escalations_conversation_id_key" ON "escalations"("conversation_id");

-- CreateIndex
CREATE INDEX "refunds_conversation_id_idx" ON "refunds"("conversation_id");

-- CreateIndex
CREATE INDEX "ai_feedback_conversation_id_idx" ON "ai_feedback"("conversation_id");

-- CreateIndex
CREATE INDEX "ai_feedback_user_id_idx" ON "ai_feedback"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "settings_user_id_key" ON "settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_id_key" ON "orders"("order_id");

-- CreateIndex
CREATE INDEX "orders_conversation_id_idx" ON "orders"("conversation_id");

-- CreateIndex
CREATE INDEX "deliveries_order_id_idx" ON "deliveries"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "foods_category_key_name_key" ON "foods"("category", "key_name");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_conversations_conversation_id_key" ON "instagram_conversations"("conversation_id");

-- CreateIndex
CREATE INDEX "user_avatars_user_id_idx" ON "user_avatars"("user_id");

-- CreateIndex
CREATE INDEX "delivery_issues_conversation_id_idx" ON "delivery_issues"("conversation_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replies" ADD CONSTRAINT "replies_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_messages" ADD CONSTRAINT "staff_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai replies" ADD CONSTRAINT "ai replies_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff replies" ADD CONSTRAINT "staff replies_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolved" ADD CONSTRAINT "resolved_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_conversations" ADD CONSTRAINT "instagram_conversations_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_issues" ADD CONSTRAINT "delivery_issues_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
