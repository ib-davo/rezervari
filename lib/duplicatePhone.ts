import type { Prisma, PrismaClient } from "@prisma/client";
import { displayPassengerNames } from "@/lib/passengerNames";

// Un client = O rezervare pe zi de plecare.
//
// Problema reală: același om sună doi operatori (sau sună UN operator după ce
// a rezervat singur pe davo.md) și amândoi îi fac rezervare pe aceeași cursă.
// Ajunge la îmbarcare cu două locuri plătite o dată, iar autocarul pleacă cu
// un loc vândut degeaba. Telefonul e singurul identificator pe care îl avem
// mereu (emailul lipsește la rezervările de operator), deci pe el blocăm.

// Cheia de identitate a unui telefon: ultimele 8 cifre.
// „+373 60 123 456", „060123456", „37360123456" și „00373 60123456" sunt
// ACELAȘI om — fiecare operator îl scrie altfel, iar dublura trebuie prinsă
// oricum ar fi scris. 8 cifre = exact numărul național moldovenesc (6XXXXXXX);
// pe numerele străine (UK 07911 123456) taie doar prefixul de operator, ceea ce
// rămâne suficient de distinctiv pentru lista unei singure zile.
export function phoneKey(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 6) return ""; // prea scurt ca să identifice pe cineva
  return digits.slice(-8);
}

// Un telefon ≠ un pasager: în ~9% din zilele cu plecări, o familie întreagă
// (Bufteac Djulieta + Fabian + Iurie + Matias) e rezervată pe telefonul unuia
// singur — rezervări separate, perfect legitime. Deci dublura se decide pe
// PERSOANĂ: telefon + zi + același nume = același om înscris de două ori.
// Numele se compară normalizat (fără diacritice, fără majuscule, ordinea
// prenume/nume indiferentă): „Ion Popescu" = „POPESCU, Ion" = „Popescu Ion".
function nameKey(raw: string): string {
  return (raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

// Cheile pasagerilor unei rezervări. Numele sunt stocate ca liste paralele
// unite cu ", " (vezi lib/passengerNames) — o rezervare de grup conține mai
// mulți oameni, iar dublura poate fi oricare dintre ei.
export function passengerKeys(firstName: string, lastName: string): string[] {
  const firsts = (firstName || "").split(",").map((s) => s.trim());
  const lasts = (lastName || "").split(",").map((s) => s.trim());
  const n = Math.max(firsts.filter(Boolean).length, lasts.filter(Boolean).length, 1);
  const keys = Array.from({ length: n }, (_, i) => nameKey(`${firsts[i] ?? ""} ${lasts[i] ?? ""}`));
  return keys.filter(Boolean);
}

export type DuplicateBooking = {
  bookingNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  departureCity: string;
  arrivalCity: string;
  departureDate: Date;
  returnDate: Date | null;
  status: string;
  source: string;
  createdByName: string | null;
  seats: number[];
  /** true = ACELAȘI om, înscris a doua oară (blocaj total).
   *  false = alt nume pe același telefon (familie) — operatorul poate confirma. */
  samePerson: boolean;
  /** numele care s-a repetat, pentru mesaj */
  matchedName: string | null;
};

type Db = PrismaClient | Prisma.TransactionClient;

// Ziua UTC în care cade o dată. Toate datele de plecare sunt ancorate în UTC
// (vezi lib/runSeats — plecările reale 04:00–17:00 UTC cad mereu în ziua lor).
function utcDay(d: Date) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return { start, end: new Date(start.getTime() + 24 * 3600 * 1000) };
}

export function formatDay(d: Date): string {
  return d.toLocaleDateString("ro-RO", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Caută o rezervare de pasager ACTIVĂ pe același telefon care atinge una din
 * zilele noii rezervări (dus sau retur). Doar `type: passenger` — un expeditor
 * poate trimite legitim mai multe colete în aceeași zi.
 *
 * Anulările (status = cancelled) nu blochează: locul lor e deja eliberat.
 * `passengerResponse = cancelled` e doar o notiță de contact, nu o anulare, deci
 * rezervarea rămâne pe cursă și blochează în continuare.
 *
 * Rezultatul spune și DE CE e dublură: `samePerson = true` (același nume → omul
 * s-a înscris de două ori, prin doi operatori) sau `false` (alt nume pe același
 * telefon → familie). Prioritatea o are potrivirea pe persoană.
 */
export async function findDuplicateByPhone(
  db: Db,
  opts: {
    phone: string;
    firstName?: string;
    lastName?: string;
    departureDate: Date;
    returnDate?: Date | null;
    excludeBookingId?: string;
  }
): Promise<DuplicateBooking | null> {
  const key = phoneKey(opts.phone);
  if (!key) return null;

  const days = [utcDay(opts.departureDate)];
  if (opts.returnDate) {
    const r = utcDay(opts.returnDate);
    if (r.start.getTime() !== days[0].start.getTime()) days.push(r);
  }

  // Filtrul pe telefon NU se poate face în SQL: în baza de date numerele sunt
  // scrise cu spații/prefixe diferite („+373 60 123 456" nu conține „60123456"),
  // deci `contains` ar rata exact dublurile pe care le căutăm. Aducem plecările
  // zilei (zeci–sute de rânduri, o singură cursă/zi) și comparăm pe cheie.
  const sameDay = await db.booking.findMany({
    where: {
      type: "passenger",
      status: { not: "cancelled" },
      ...(opts.excludeBookingId ? { id: { not: opts.excludeBookingId } } : {}),
      OR: days.flatMap((d) => [
        { departureDate: { gte: d.start, lt: d.end } },
        { returnDate: { gte: d.start, lt: d.end } },
      ]),
    },
    select: {
      bookingNumber: true,
      firstName: true,
      lastName: true,
      phone: true,
      departureCity: true,
      arrivalCity: true,
      departureDate: true,
      returnDate: true,
      status: true,
      source: true,
      createdByName: true,
      createdAt: true,
      seatBookings: { select: { seatNumber: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  const samePhone = sameDay.filter((b) => phoneKey(b.phone) === key);
  if (samePhone.length === 0) return null;

  const wanted = new Set(passengerKeys(opts.firstName ?? "", opts.lastName ?? ""));
  const matchOf = (b: (typeof samePhone)[number]) =>
    passengerKeys(b.firstName, b.lastName).find((k) => wanted.has(k)) ?? null;

  // Aceeași PERSOANĂ are prioritate: dacă pe telefon e și familia, și omul
  // însuși, mesajul trebuie să fie despre om (blocaj), nu despre familie.
  const hit = samePhone.find((b) => matchOf(b) !== null) ?? samePhone[0];
  const matched = matchOf(hit);

  return {
    bookingNumber: hit.bookingNumber,
    firstName: hit.firstName,
    lastName: hit.lastName,
    phone: hit.phone,
    departureCity: hit.departureCity,
    arrivalCity: hit.arrivalCity,
    departureDate: hit.departureDate,
    returnDate: hit.returnDate,
    status: hit.status,
    source: hit.source,
    createdByName: hit.createdByName,
    seats: [...new Set(hit.seatBookings.map((s) => s.seatNumber))].sort((a, b) => a - b),
    samePerson: matched !== null,
    matchedName: matched,
  };
}

// Cardul rezervării existente, așa cum îl vede operatorul în mesaj: tot ce-i
// trebuie ca s-o găsească în listă (număr, cine, locuri, cine a făcut-o).
function existingBookingLine(dup: DuplicateBooking): string {
  const who = displayPassengerNames(dup.firstName, dup.lastName);
  const seats = dup.seats.length ? `, loc ${dup.seats.join(", ")}` : "";
  const by = dup.createdByName
    ? `, făcută de ${dup.createdByName}`
    : dup.source === "site"
      ? ", făcută de client pe site"
      : "";
  return `${dup.bookingNumber}${who ? ` — ${who}` : ""} (${dup.departureCity} → ${dup.arrivalCity}${seats})${by}`;
}

// Mesajul pentru OPERATOR — două situații complet diferite:
//  • același om, a doua oară → BLOCAJ (exact bug-ul: a sunat doi operatori);
//  • alt nume pe același telefon → familie, se poate continua cu confirmare.
export function duplicateMessageForOperator(dup: DuplicateBooking): string {
  const day = formatDay(dup.departureDate);
  if (dup.samePerson) {
    return (
      `${displayPassengerNames(dup.firstName, dup.lastName)} e DEJA rezervat pe ${day}, pe numărul ${dup.phone}: ` +
      `${existingBookingLine(dup)}. ` +
      `Probabil a sunat și la alt operator. Nu se face a doua rezervare — deschide-o pe cea existentă (Editează) dacă trebuie schimbat ceva.`
    );
  }
  return (
    `Atenție: numărul ${dup.phone} are deja o rezervare pe ${day} — ${existingBookingLine(dup)}. ` +
    `Dacă e ALTĂ persoană (familie pe același telefon), bifează confirmarea și trimite din nou. ` +
    `Dacă e același om, nu face rezervare nouă — editeaz-o pe cea existentă.`
  );
}

// Mesajul PUBLIC (davo.md) — blochează în ambele cazuri, dar NU divulgă numele
// și numărul rezervării altcuiva: telefonul poate fi tastat de oricine.
// Pe site nu există bifă de ocolire; pentru mai multe persoane se aleg mai
// multe locuri într-o singură rezervare.
export function duplicateMessagePublic(dup: DuplicateBooking): string {
  return (
    `Există deja o rezervare pe acest număr de telefon pentru ${formatDay(dup.departureDate)}. ` +
    `Pentru mai multe persoane alege mai multe locuri într-o singură rezervare, ` +
    `sau sună-ne ca să modificăm rezervarea existentă.`
  );
}
