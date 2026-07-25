ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "branch_id" INTEGER;

CREATE INDEX IF NOT EXISTS "customers_branch_id_idx" ON "customers"("branch_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'customers_branch_id_fkey'
      AND table_name = 'customers'
  ) THEN
    ALTER TABLE "customers"
    ADD CONSTRAINT "customers_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
