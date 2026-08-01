/**
 * Reparație unică: dezarhivează rezervările pe care cronul vechi le-a arhivat
 * PREA DEVREME (la 24h de la plecare, deși autocarul era încă pe drum).
 *
 * Cronul nou (/api/cron/archive-past) folosește fereastra din lib/activeWindow,
 * deci rezervările restaurate aici rămân în panou până le trece cu adevărat
 * cursa, apoi se arhivează singure la momentul corect.
 *
 * Idempotent: dacă nu mai există rezervări arhivate în fereastra activă, nu face
 * nimic. Nu trimite niciun email — atinge doar `archivedAt`.
 *
 * Usage:
 *   npx tsx --env-file=.env.local --env-file=.env scripts/unarchive-in-window.ts          # dry-run
 *   npx tsx --env-file=.env.local --env-file=.env scripts/unarchive-in-window.ts --apply  # execută
 */
import { PrismaClient } from "@prisma/client";
import { activeCutoff, activeLegWhere, ACTIVE_RETENTION_DAYS } from "../lib/activeWindow";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const cutoff = activeCutoff();
  const where = { archivedAt: { not: null }, OR: activeLegWhere(cutoff) };

  const rows = await prisma.booking.findMany({
    where,
    select: {
      bookingNumber: true, firstName: true, lastName: true, status: true,
      departureDate: true, returnDate: true, archivedAt: true,
    },
    orderBy: { departureDate: "asc" },
  });

  console.log(`Fereastră activă: ${ACTIVE_RETENTION_DAYS} zile → cutoff ${cutoff.toISOString()}`);
  console.log(`Arhivate prea devreme: ${rows.length}`);
  for (const b of rows) {
    const leg = b.returnDate ?? b.departureDate;
    console.log(`  ${b.bookingNumber}  ${b.lastName} ${b.firstName}  [${b.status}]  etapă ${leg.toISOString()}  arhivat ${b.archivedAt?.toISOString()}`);
  }

  if (!APPLY) {
    console.log("\nDRY-RUN — rulează cu --apply ca să dezarhivezi.");
    return;
  }
  if (rows.length === 0) return;

  const res = await prisma.booking.updateMany({ where, data: { archivedAt: null } });
  console.log(`\nDezarhivate: ${res.count}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
