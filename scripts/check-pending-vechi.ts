/**
 * Verificare READ-ONLY: rezervări `pending` cu plecare VIITOARE, mai vechi de
 * N zile (implicit 14) — candidatele la „loc ținut degeaba".
 *
 * De ce există: un pending vechi ține locul pe autocar și, prin regula „un om =
 * o rezervare pe zi" (lib/duplicatePhone), BLOCHEAZĂ fără ocolire orice
 * rezervare nouă a aceleiași persoane. Rândurile intrate prin scripturile de
 * import (loturi cu createdAt lipite, la secundă) stau așa săptămâni întregi —
 * nimeni nu le confirmă, dar ele blochează operatorii.
 *
 * DOAR RAPORT, fără reparare automată: sunt pasageri reali dintr-o listă.
 * Operatorul decide pentru fiecare — confirmă (omul vine) sau anulează (locul
 * se eliberează și blocajul dispare).
 *
 * Rulare:  npx tsx --env-file=.env.local scripts/check-pending-vechi.ts [N]
 *          (N = pragul în zile de la creare; implicit 14)
 * Ieșire:  cod 1 dacă există pending-uri vechi de semnalat, 0 dacă nu.
 */
import { PrismaClient } from "@prisma/client";
import { phoneKey } from "../lib/duplicatePhone";

const prisma = new PrismaClient();

const DAYS = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 14;
const day = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const cutoff = new Date(now.getTime() - DAYS * 24 * 3600 * 1000);

  const rows = await prisma.booking.findMany({
    where: {
      type: "passenger",
      status: "pending",
      departureDate: { gte: todayUtc }, // plecare azi sau în viitor — încă ține locul
      createdAt: { lt: cutoff },
    },
    select: {
      bookingNumber: true,
      firstName: true,
      lastName: true,
      phone: true,
      departureCity: true,
      arrivalCity: true,
      departureDate: true,
      createdAt: true,
      source: true,
      createdByName: true,
      adults: true,
      children: true,
      // locurile vin cu autocarul lor — operatorul trebuie să știe UNDE stă
      // locul ținut, nu doar că există.
      seatBookings: {
        select: { seatNumber: true, trip: { select: { bus: { select: { plate: true } } } } },
      },
    },
    orderBy: [{ departureDate: "asc" }, { createdAt: "asc" }],
  });

  console.log(`Pending cu plecare viitoare, create acum peste ${DAYS} zile: ${rows.length}\n`);

  const ageDays = (d: Date) => Math.floor((now.getTime() - d.getTime()) / 86400000);
  for (const b of rows) {
    const seats = [...new Set(b.seatBookings.map((s) => s.seatNumber))].sort((a, z) => a - z);
    const plate = b.seatBookings.find((s) => s.trip?.bus?.plate)?.trip?.bus?.plate ?? null;
    // Lotul de import se recunoaște după createdAt la secundă fixă (script), nu
    // după prefix — importurile târzii au folosit numere normale DAVO-2026-*.
    const who = b.createdByName ? `${b.source}/${b.createdByName}` : b.source;
    const blocks = phoneKey(b.phone)
      ? `blochează tel …${phoneKey(b.phone)}`
      : "fără telefon (nu blochează pe telefon)";
    console.log(
      [
        b.bookingNumber,
        `${b.firstName} ${b.lastName}`.trim(),
        `plecare ${day(b.departureDate)}`,
        `creat ${day(b.createdAt)} (acum ${ageDays(b.createdAt)} zile)`,
        `sursă: ${who}`,
        seats.length ? `ține locul ${seats.join(", ")}${plate ? ` pe ${plate}` : ""}` : "fără loc atribuit",
        `${b.adults + b.children} pers.`,
        blocks,
      ].join(" | ")
    );
  }

  if (rows.length) {
    console.log(
      `\nDe făcut MANUAL, din panou, pentru fiecare: sună omul → confirmă sau anulează.` +
        `\nNU se șterge/expiră automat nimic de aici: sunt pasageri reali dintr-o listă.`
    );
  }
  process.exit(rows.length ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(2);
  })
  .finally(() => prisma.$disconnect());
