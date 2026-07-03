/**
 * Reasignează cursele de pe busurile inactive (placeholder) la cele active,
 * apoi șterge busurile placeholder.
 *
 * Mapare: placeholder[i] (sortat după createdAt) → active[i % active.length].
 * Toate cursele de pe același placeholder ajung pe același bus activ — preservă
 * omogenitatea (nu împarte o săptămână întreagă pe 3 busuri diferite).
 *
 * Usage:
 *   npx tsx scripts/cleanup-placeholder-buses.ts            # dry-run
 *   npx tsx scripts/cleanup-placeholder-buses.ts --apply    # execută
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const [activeBuses, inactiveBuses] = await Promise.all([
    prisma.bus.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
    prisma.bus.findMany({
      where: { active: false },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { trips: true } } },
    }),
  ]);

  console.log(`Active buses: ${activeBuses.length}`);
  for (const b of activeBuses) {
    console.log(`  • ${b.label} (${b.plate}) — ${b.totalSeats} locuri — id=${b.id.slice(0, 8)}`);
  }

  console.log(`\nInactive (placeholder) buses: ${inactiveBuses.length}`);
  for (const b of inactiveBuses) {
    console.log(`  • ${b.label} (${b.plate}) — ${b.totalSeats} locuri — ${b._count.trips} trips — id=${b.id.slice(0, 8)}`);
  }

  if (inactiveBuses.length === 0) {
    console.log("\nNimic de curățat.");
    return;
  }
  if (activeBuses.length === 0) {
    console.error("\nEROARE: nu există busuri active. Abort.");
    process.exitCode = 1;
    return;
  }

  // Mapare placeholder → bus activ (1:1 cât se poate, apoi modulo)
  const mapping = inactiveBuses.map((p, i) => ({
    placeholder: p,
    target: activeBuses[i % activeBuses.length],
  }));

  console.log("\nMapare:");
  for (const m of mapping) {
    console.log(`  ${m.placeholder.label}  →  ${m.target.label}  (${m.placeholder._count.trips} trips)`);
  }

  // Verifică compatibilitate seats (warning, nu blocant)
  const incompatible = mapping.filter((m) => m.placeholder.totalSeats !== m.target.totalSeats);
  if (incompatible.length > 0) {
    console.warn("\n⚠️  Diferențe de capacitate (atenție la seatBookings existente):");
    for (const m of incompatible) {
      console.warn(`  ${m.placeholder.label} (${m.placeholder.totalSeats}) → ${m.target.label} (${m.target.totalSeats})`);
    }
  }

  // Numără rezervări pe scaune ca să afișăm impactul
  const tripIds = await prisma.trip.findMany({
    where: { busId: { in: inactiveBuses.map((b) => b.id) } },
    select: { id: true },
  });
  const seatBookingsCount = await prisma.seatBooking.count({
    where: { tripId: { in: tripIds.map((t) => t.id) } },
  });
  console.log(`\nTotal trips de relinkat: ${tripIds.length}`);
  console.log(`Total seatBookings afectate (rămân pe noul bus, nemodificate): ${seatBookingsCount}`);

  if (!APPLY) {
    console.log("\n--- DRY RUN ---");
    console.log("Re-rulează cu --apply ca să execute.");
    return;
  }

  console.log("\n--- APPLY ---");
  await prisma.$transaction(async (tx) => {
    for (const m of mapping) {
      const updated = await tx.trip.updateMany({
        where: { busId: m.placeholder.id },
        data: { busId: m.target.id },
      });
      console.log(`  ✓ ${m.placeholder.label} → ${m.target.label}: ${updated.count} trips`);
    }
    for (const m of mapping) {
      await tx.bus.delete({ where: { id: m.placeholder.id } });
      console.log(`  ✓ Șters: ${m.placeholder.label} (${m.placeholder.plate})`);
    }
  });
  console.log("\n✓ Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
