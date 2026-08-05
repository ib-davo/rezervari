/**
 * Verificare READ-ONLY: ziua scrisă pe rezervare trebuie să fie ziua cursei.
 *
 * De ce există: `booking.departureDate` e citită de verificarea de dublură pe
 * telefon (lib/duplicatePhone), iar `trip.departureAt` e citită de liste, de harta
 * de locuri și de manifeste. Când cele două se despart, rezervarea BLOCHEAZĂ o zi
 * și e AFIȘATĂ pe alta: operatorul primește „e deja rezervat pe 07.08, loc 10", se
 * uită la locul 10 din 07.08 și găsește alt om (cazul DAVO-2026-TB23MN, ale cărei
 * locuri erau pe cursa din 06.08).
 *
 * Căile de scriere din acest repo sunt închise, dar DB-ul e comun cu davo.md
 * (deploy separat) și cu scripturile de import — deci verificarea rămâne utilă.
 *
 * Rulare:  npx tsx --env-file=.env.local scripts/check-trip-day-sync.ts
 * Ieșire:  cod 1 dacă există desincronizări pe rezervări ACTIVE (de reparat),
 *          0 dacă doar pe cele anulate/istorice.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const day = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const rows = await prisma.booking.findMany({
    where: { OR: [{ tripId: { not: null } }, { returnTripId: { not: null } }] },
    select: {
      bookingNumber: true,
      status: true,
      source: true,
      createdByName: true,
      departureDate: true,
      returnDate: true,
      trip: { select: { departureAt: true } },
      returnTrip: { select: { departureAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const bad = rows.filter(
    (b) =>
      (b.trip && day(b.departureDate) !== day(b.trip.departureAt)) ||
      (b.returnTrip && b.returnDate && day(b.returnDate) !== day(b.returnTrip.departureAt))
  );
  const active = bad.filter((b) => b.status !== "cancelled");

  console.log(`Rezervări cu cursă: ${rows.length}`);
  console.log(`Desincronizate: ${bad.length} (din care ACTIVE: ${active.length})`);
  for (const b of bad) {
    const legs = [
      b.trip && day(b.departureDate) !== day(b.trip.departureAt)
        ? `dus ${day(b.departureDate)} vs cursă ${day(b.trip.departureAt)}`
        : null,
      b.returnTrip && b.returnDate && day(b.returnDate) !== day(b.returnTrip.departureAt)
        ? `retur ${day(b.returnDate)} vs cursă ${day(b.returnTrip.departureAt)}`
        : null,
    ].filter(Boolean);
    console.log(` - ${b.bookingNumber} [${b.status}] ${legs.join("; ")} — ${b.createdByName ?? b.source}`);
  }

  if (active.length > 0) {
    console.log(
      "\nDE REPARAT: rezervările active de mai sus blochează o zi și sunt afișate pe alta.\n" +
        "Reparare corectă = „Reprogramare” în panou (mută cursa, locurile și reminderele)."
    );
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
