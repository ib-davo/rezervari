/**
 * Trimite UN email de manifest cursă către admin pentru o cursă specifică,
 * sau pentru prima cursă "scheduled" găsită. Bypass de auth (rulează direct
 * pe Prisma + Resend), pentru testat conținutul/format-ul emailului.
 *
 * Usage:
 *   npx tsx scripts/send-test-trip-manifest.ts                # prima cursă scheduled
 *   npx tsx scripts/send-test-trip-manifest.ts <tripId>       # cursă specifică
 *   npx tsx scripts/send-test-trip-manifest.ts <tripId> --force  # forțează retrimitere
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { sendManifestForTrip } from "../lib/adminTripManifest";

async function main() {
  if (!process.env.RESEND_API_KEY) {
    console.error("✗ RESEND_API_KEY nu e setat. Verifică .env.local");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const explicitId = args.find((a) => !a.startsWith("--"));

  const prisma = new PrismaClient();

  let tripId = explicitId;
  if (!tripId) {
    const trip = await prisma.trip.findFirst({
      where: { status: { in: ["scheduled", "boarding"] } },
      orderBy: { departureAt: "asc" },
      include: { route: { include: { originCity: true, destinationCity: true } } },
    });
    if (!trip) {
      console.error("✗ Nicio cursă disponibilă. Rulează seed sau generează curse.");
      process.exit(2);
    }
    tripId = trip.id;
    console.log(`Cursă selectată: ${trip.route.originCity.name} → ${trip.route.destinationCity.name}`);
    console.log(`  ID: ${tripId}`);
    console.log(`  Plecare: ${trip.departureAt.toISOString()}`);
  }
  await prisma.$disconnect();

  console.log(`\nTrimit manifest...${force ? " (force)" : ""}`);
  const res = await sendManifestForTrip(tripId, { force });
  if (res.ok) {
    console.log("✓ Manifest trimis");
  } else {
    console.error(`✗ ${res.reason}`);
    process.exit(3);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
