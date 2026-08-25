CREATE TABLE "voice_channels" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'BRANCH',
    "branch_id" INTEGER,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL,
    CONSTRAINT "voice_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "voice_settings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "push_to_talk_key" VARCHAR(50),
    "input_device" VARCHAR(255),
    "output_device" VARCHAR(255),
    "input_volume" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "output_volume" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL,
    CONSTRAINT "voice_settings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "voice_channels_branch_id_idx" ON "voice_channels"("branch_id");
CREATE UNIQUE INDEX "voice_settings_user_id_key" ON "voice_settings"("user_id");
ALTER TABLE "voice_channels" ADD CONSTRAINT "voice_channels_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_settings" ADD CONSTRAINT "voice_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;