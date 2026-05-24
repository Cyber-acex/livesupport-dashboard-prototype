-- Create restaurant_tables for the tables section
CREATE TABLE IF NOT EXISTS "tables" (
    "id" SERIAL NOT NULL,
    "number" INTEGER UNIQUE NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'vacant',
    "customer_name" VARCHAR(255),
    "reserved_until" TIMESTAMP(0),
    "is_booking" BOOLEAN NOT NULL DEFAULT FALSE,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id")
);
