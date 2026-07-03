/**
 * Șterge un set explicit de bookings de test (după bookingNumber).
 *
 * Cascade manuală pe relațiile fără onDelete: Cascade:
 *   - EmailJob.bookingId (required)  → delete
 *   - SeatBooking.bookingId (opțional) → delete (eliberează locul)
 *
 * Usage:
 *   npx tsx scripts/delete-test-bookings.ts            # dry-run
 *   npx tsx scripts/delete-test-bookings.ts --apply    # execută
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const NUMBERS = [
  "DAVO-2026-DF7D80",
  "DAVO-2026-DAATAT",
  "DAVO-2026-XLY92U",
  "DAVO-2026-8T4GKZ",
  "DAVO-2026-1IA8VP",
  "DAVO-2026-NUM5IA",
  "DAVO-2026-KJG7G0",
  "DAVO-2026-LY85LZ",
  "DAVO-2026-YC8IP6",
  "DAVO-2026-XA6CLQ",
  "DAVO-2026-0DRLTS",
  "DAVO-2026-USTBV6",
  "DAVO-2026-DJHW1E",
  "DAVO-2026-F0QUQD",
  "DAVO-2026-0L13SN",
  "CLC-2026-L5JWEF",
  "DAVO-2026-KZMH3B",
  "DAVO-2026-RTZN16",
  "DAVO-2026-4WYY5E",
  "DAVO-2026-UBR0NP",
];

async function main() {
  const bookings = await prisma.booking.findMany({
    where: { bookingNumber: { in: NUMBERS } },
    select: {
      id: true,
      bookingNumber: true,
      firstName: true,
      lastName: true,
      departureCity: true,
      arrivalCity: true,
      status: true,
      _count: { select: { seatBookings: true, emailJobs: true } },
    },
  });

  console.log(`Găsite: ${bookings.length}/${NUMBERS.length}`);
  for (const b of bookings) {
    console.log(
      `  • ${b.bookingNumber}  ${b.firstName} ${b.lastName}  ${b.departureCity}→${b.arrivalCity}  [${b.status}]  seats=${b._count.seatBookings} emails=${b._count.emailJobs}`
    );
  }

  const found = new Set(bookings.map((b) => b.bookingNumber));
  const missing = NUMBERS.filter((n) => !found.has(n));
  if (missing.length > 0) {
    console.log(`\nNu există în DB (sărim): ${missing.join(", ")}`);
  }

  if (bookings.length === 0) {
    console.log("\nNimic de șters.");
    return;
  }

  if (!APPLY) {
    console.log("\n--- DRY RUN ---");
    console.log("Re-rulează cu --apply ca să execute.");
    return;
  }

  const ids = bookings.map((b) => b.id);
  console.log("\n--- APPLY ---");
  const result = await prisma.$transaction(async (tx) => {
    const jobs = await tx.emailJob.deleteMany({ where: { bookingId: { in: ids } } });
    const seats = await tx.seatBooking.deleteMany({ where: { bookingId: { in: ids } } });
    const deleted = await tx.booking.deleteMany({ where: { id: { in: ids } } });
    return { jobs: jobs.count, seats: seats.count, deleted: deleted.count };
  });

  console.log(`  ✓ EmailJob șterse:    ${result.jobs}`);
  console.log(`  ✓ SeatBooking șterse: ${result.seats}`);
  console.log(`  ✓ Booking șterse:     ${result.deleted}`);
  console.log("\n✓ Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
