-- CreateTable
CREATE TABLE "staff_profiles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "firstName" VARCHAR(255),
    "lastName" VARCHAR(255),
    "email" VARCHAR(255),
    "phone" VARCHAR(255),
    "bio" TEXT,
    "country" VARCHAR(255),
    "cityState" VARCHAR(255),
    "postalCode" VARCHAR(255),
    "taxId" VARCHAR(255),
    "avatarUrl" TEXT,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "staff_profiles_user_id_key" UNIQUE("user_id"),
    CONSTRAINT "staff_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- CreateIndex
CREATE INDEX "staff_profiles_user_id_idx" ON "staff_profiles"("user_id");
