-- ============================================================================
-- DAVO — Supabase bootstrap (rulează o singură dată, în SQL Editor)
-- ============================================================================
--
-- Cum se folosește:
--   1. Creează un proiect nou pe https://supabase.com (notează parola de DB).
--   2. Deschide Supabase Dashboard → SQL Editor → New query.
--   3. Copy-paste TOT conținutul acestui fișier și apasă "Run".
--   4. Copiază connection strings din Project Settings → Database:
--        - "Transaction" (port 6543)  → DATABASE_URL
--        - "Session"     (port 5432)  → DIRECT_URL
--      Le pui în .env (vezi fișier). Adaugă `?pgbouncer=true&connection_limit=1`
--      la DATABASE_URL.
--   5. Rulează local: `npm run db:seed` ca să populezi țările/orașele/rutele.
--
-- Ce face:
--   - Creează toate tabelele din schema Prisma
--   - Creează indexurile și foreign key-urile
--   - Activează Row Level Security pe fiecare tabel (fără policies) — blochează
--     accesul prin anon/authenticated keys Supabase. Prisma continuă să meargă
--     pentru că se conectează cu rolul owner care face BYPASSRLS.
--
-- Dacă vrei vreodată să regenerezi acest fișier din schema Prisma:
--   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- ============================================================================


-- ===== 1. Tabele + indexuri + foreign keys ==================================

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "flag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isOrigin" BOOLEAN NOT NULL DEFAULT false,
    "countryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "originCityId" TEXT NOT NULL,
    "destinationCityId" TEXT NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "description" TEXT,
    "seoSlug" TEXT,
    "pageSlug" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDepartures" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bus" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "layoutJson" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "arrivalAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "capacity" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatBooking" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "bookingId" TEXT,
    "holdExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "vip" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "tripType" TEXT,
    "departureCity" TEXT NOT NULL,
    "arrivalCity" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "returnDate" TIMESTAMP(3),
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "parcelWeight" DOUBLE PRECISION,
    "parcelDetails" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "ticketUrl" TEXT,
    "qrCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "clientId" TEXT,
    "tripId" TEXT,
    "returnTripId" TEXT,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "relatedId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT '1',
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Country_name_key" ON "Country"("name");
CREATE UNIQUE INDEX "Country_slug_key" ON "Country"("slug");
CREATE UNIQUE INDEX "City_slug_key" ON "City"("slug");
CREATE INDEX "City_countryId_idx" ON "City"("countryId");
CREATE INDEX "City_isOrigin_idx" ON "City"("isOrigin");
CREATE INDEX "Route_active_idx" ON "Route"("active");
CREATE UNIQUE INDEX "Route_originCityId_destinationCityId_key" ON "Route"("originCityId", "destinationCityId");
CREATE UNIQUE INDEX "Bus_plate_key" ON "Bus"("plate");
CREATE INDEX "Trip_departureAt_idx" ON "Trip"("departureAt");
CREATE INDEX "Trip_status_idx" ON "Trip"("status");
CREATE INDEX "Trip_routeId_idx" ON "Trip"("routeId");
CREATE INDEX "SeatBooking_bookingId_idx" ON "SeatBooking"("bookingId");
CREATE UNIQUE INDEX "SeatBooking_tripId_seatNumber_key" ON "SeatBooking"("tripId", "seatNumber");
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");
CREATE INDEX "Client_phone_idx" ON "Client"("phone");
CREATE UNIQUE INDEX "Booking_bookingNumber_key" ON "Booking"("bookingNumber");
CREATE INDEX "Booking_bookingNumber_idx" ON "Booking"("bookingNumber");
CREATE INDEX "Booking_email_idx" ON "Booking"("email");
CREATE INDEX "Booking_status_idx" ON "Booking"("status");
CREATE INDEX "Booking_createdAt_idx" ON "Booking"("createdAt");
CREATE INDEX "Booking_clientId_idx" ON "Booking"("clientId");
CREATE INDEX "Booking_tripId_idx" ON "Booking"("tripId");
CREATE INDEX "EmailJob_sendAt_status_idx" ON "EmailJob"("sendAt", "status");
CREATE INDEX "EmailJob_bookingId_idx" ON "EmailJob"("bookingId");
CREATE INDEX "EmailLog_to_idx" ON "EmailLog"("to");
CREATE INDEX "EmailLog_relatedId_idx" ON "EmailLog"("relatedId");
CREATE INDEX "EmailLog_sentAt_idx" ON "EmailLog"("sentAt");
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
CREATE UNIQUE INDEX "Settings_key_key" ON "Settings"("key");

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Route" ADD CONSTRAINT "Route_originCityId_fkey" FOREIGN KEY ("originCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Route" ADD CONSTRAINT "Route_destinationCityId_fkey" FOREIGN KEY ("destinationCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SeatBooking" ADD CONSTRAINT "SeatBooking_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SeatBooking" ADD CONSTRAINT "SeatBooking_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_returnTripId_fkey" FOREIGN KEY ("returnTripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailJob" ADD CONSTRAINT "EmailJob_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ===== 2. Row Level Security ================================================
--
-- Activăm RLS pe toate tabelele, FĂRĂ policies.
-- Consecință: rolurile `anon` și `authenticated` (keys expuse la frontend) nu
-- au acces la nimic. Prisma folosește rolul `postgres` (owner) care are
-- BYPASSRLS, deci aplicația continuă să meargă normal.
-- Asta închide și warning-urile din Supabase Advisors.
--
-- Dacă vreodată vrei să expui tabele direct prin Supabase JS SDK (fără
-- Prisma), trebuie să adaugi policies explicit.

ALTER TABLE "Country"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "City"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Route"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bus"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trip"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeatBooking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Booking"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailJob"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailLog"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminUser"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Settings"    ENABLE ROW LEVEL SECURITY;


-- ===== 3. Baseline pentru Prisma migrations =================================
--
-- Asta îi spune Prismei că migrația inițială e deja aplicată, ca să nu încerce
-- să o re-ruleze. Se execută de la tine local (nu aici în SQL Editor) după ce
-- setezi DATABASE_URL + DIRECT_URL:
--
--   npx prisma migrate resolve --applied 20260425000000_init
--
-- Apoi toate migrațiile viitoare merg normal cu `npm run db:migrate` /
-- `npm run db:deploy`.
