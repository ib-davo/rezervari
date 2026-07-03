-- Panou operatori (davo-operatori). 100% aditiv — nimic existent nu se modifică.
-- Toate coloanele noi au DEFAULT sau sunt nullable, deci INSERT-urile davo merg neschimbat.

-- CreateTable
CREATE TABLE IF NOT EXISTS "Operator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'operator',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Operator_slug_key" ON "Operator"("slug");

-- AlterTable Booking (aditiv)
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'site';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "createdByName" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_source_idx" ON "Booking"("source");
CREATE INDEX IF NOT EXISTS "Booking_archivedAt_idx" ON "Booking"("archivedAt");
CREATE INDEX IF NOT EXISTS "Booking_createdById_idx" ON "Booking"("createdById");

-- AddForeignKey (gardat ca să fie idempotent)
DO $$ BEGIN
    ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
