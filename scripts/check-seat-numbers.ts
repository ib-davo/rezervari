import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const manBus = await prisma.bus.findFirst({
    where: { plate: "CJ 41 DAV" },
    include: { trips: { select: { id: true } } },
  });
  if (!manBus) {
    console.log("MAN Lion's Coach not found.");
    return;
  }
  const seats = await prisma.seatBooking.findMany({
    where: { tripId: { in: manBus.trips.map((t) => t.id) } },
    select: { tripId: true, seatNumber: true, bookingId: true },
    orderBy: { seatNumber: "asc" },
  });
  console.log(`MAN Lion's Coach: ${manBus.totalSeats} locuri, ${manBus.trips.length} trips, ${seats.length} seatBookings`);
  for (const s of seats) {
    const flag = s.seatNumber > 46 ? "  ⚠️ > 46 (orfan dacă mut pe Van Hool TDX 46)" : "";
    console.log(`  trip=${s.tripId.slice(0, 8)}  seat=${s.seatNumber}  booking=${s.bookingId?.slice(0, 8) ?? "-"}${flag}`);
  }
  const orphans = seats.filter((s) => s.seatNumber > 46);
  console.log(`\nOrfane (> 46): ${orphans.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
