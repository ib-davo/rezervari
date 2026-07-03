/**
 * Trimite un email de manifest țară (noua agregare) pentru a vedea cum arată.
 * Selectează țara cu cele mai multe curse în viitorul imediat ca să avem date
 * suficiente; bagă FORCE ca să bypass-eze idempotența.
 *
 * Usage:
 *   npx tsx scripts/send-test-country-manifest.ts                 # auto-select
 *   npx tsx scripts/send-test-country-manifest.ts <tripIdAncoră>  # pe baza unei curse
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { sendManifestForTrip } from "../lib/adminTripManifest";

async function main() {
  if (!process.env.RESEND_API_KEY) {
    console.error("✗ RESEND_API_KEY nu e setat");
    process.exit(1);
  }

  const explicit = process.argv[2];
  const prisma = new PrismaClient();

  let tripId = explicit;
  if (!tripId) {
    // Caut o cursă viitoare scheduled care are măcar 1 booking.
    const candidate = await prisma.trip.findFirst({
      where: {
        status: "scheduled",
        OR: [
          { bookings: { some: { status: { in: ["confirmed", "pending"] } } } },
          { returnBookings: { some: { status: { in: ["confirmed", "pending"] } } } },
        ],
      },
      orderBy: { departureAt: "asc" },
      include: { route: { include: { originCity: { include: { country: true } }, destinationCity: { include: { country: true } } } } },
    });
    if (!candidate) {
      console.error("✗ Nu am găsit nicio cursă cu pasageri. Rulez cu --force pe prima scheduled.");
      const fallback = await prisma.trip.findFirst({
        where: { status: "scheduled" },
        orderBy: { departureAt: "asc" },
      });
      if (!fallback) {
        console.error("✗ Nicio cursă scheduled deloc.");
        process.exit(2);
      }
      tripId = fallback.id;
    } else {
      tripId = candidate.id;
      console.log(`Cursă ancoră: ${candidate.route.originCity.name} → ${candidate.route.destinationCity.name}`);
      console.log(`  Țară agregată: ${candidate.route.originCity.country.name === "Moldova" ? candidate.route.destinationCity.country.name : candidate.route.originCity.country.name}`);
      console.log(`  Data: ${candidate.departureAt.toISOString()}`);
    }
  }
  await prisma.$disconnect();

  console.log(`\nTrimit manifest țară (force)...`);
  const res = await sendManifestForTrip(tripId, { force: true });
  if (res.ok) {
    console.log("✓ Email trimis pe ADMIN_NOTIFICATION_EMAIL");
  } else {
    console.error(`✗ ${res.reason}`);
    process.exit(3);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
