import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";

export const dynamic = "force-dynamic";

// Câmpurile de booking afișate în card (aceleași ca /api/operator/bookings).
const BOOKING_SELECT = {
  id: true,
  bookingNumber: true,
  type: true,
  status: true,
  tripType: true,
  departureCity: true,
  arrivalCity: true,
  departureDate: true,
  returnDate: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  adults: true,
  children: true,
  price: true,
  currency: true,
  paymentStatus: true,
  payMethod: true,
  passengerResponse: true,
  source: true,
  createdByName: true,
  createdAt: true,
  archivedAt: true,
  tripId: true,
  returnTripId: true,
  seatBookings: { select: { seatNumber: true, tripId: true }, orderBy: { seatNumber: "asc" as const } },
} as const;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Group = {
  kind: "trip" | "loose";
  key: string;
  tripId: string | null;
  busLabel: string | null;
  busPlate: string | null;
  from: string;
  to: string;
  fromParam: string; // "Oraș, Țară" pentru linkul de rezervare pe cursă
  toParam: string;
  departureAt: string; // ISO
  arrivalAt: string | null;
  capacity: number | null;
  seatsTaken: number;
  dayKey: string;
  bookings: unknown[];
};

// Vederea pe CURSE: rezervările active grupate după cursa lor (autocar + rută +
// dată exactă). Cele fără cursă atribuită → grupuri "loose" după rută + zi.
export async function GET(req: NextRequest) {
  const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  // "Activ" = ultima dată relevantă (retur dacă există, altfel plecarea) în viitor.
  // Ora reală, nu miezul nopții (o cursă de azi 08:30 iese după 08:30).
  const now = new Date();

  const bookings = await prisma.booking.findMany({
    where: {
      archivedAt: null,
      OR: [
        { returnDate: { gte: now } },
        { returnDate: null, departureDate: { gte: now } },
      ],
    },
    select: BOOKING_SELECT,
    orderBy: { departureDate: "asc" },
    take: 2000,
  });

  // Cursele reale referite de rezervări → detalii (autocar, rută, ocupare totală).
  const tripIds = [...new Set(bookings.map((b) => b.tripId).filter((x): x is string => !!x))];
  const trips = tripIds.length
    ? await prisma.trip.findMany({
        where: { id: { in: tripIds } },
        select: {
          id: true,
          departureAt: true,
          arrivalAt: true,
          capacity: true,
          bus: { select: { label: true, plate: true } },
          route: {
            select: {
              originCity: { select: { name: true, country: { select: { name: true } } } },
              destinationCity: { select: { name: true, country: { select: { name: true } } } },
            },
          },
          _count: { select: { seatBookings: true } },
        },
      })
    : [];
  const tripMap = new Map(trips.map((t) => [t.id, t]));

  const groups = new Map<string, Group>();

  for (const b of bookings) {
    // Grupăm după cursa DUS (tripId). Rezervările fără cursă → grup pe rută+zi.
    const trip = b.tripId ? tripMap.get(b.tripId) : null;
    if (trip) {
      const key = `trip:${trip.id}`;
      let g = groups.get(key);
      if (!g) {
        const oName = trip.route?.originCity?.name ?? b.departureCity;
        const dName = trip.route?.destinationCity?.name ?? b.arrivalCity;
        const oCountry = trip.route?.originCity?.country?.name;
        const dCountry = trip.route?.destinationCity?.country?.name;
        g = {
          kind: "trip",
          key,
          tripId: trip.id,
          busLabel: trip.bus?.label ?? null,
          busPlate: trip.bus?.plate ?? null,
          from: oName,
          to: dName,
          fromParam: oCountry ? `${oName}, ${oCountry}` : oName,
          toParam: dCountry ? `${dName}, ${dCountry}` : dName,
          departureAt: trip.departureAt.toISOString(),
          arrivalAt: trip.arrivalAt ? trip.arrivalAt.toISOString() : null,
          capacity: trip.capacity ?? null,
          seatsTaken: trip._count.seatBookings,
          dayKey: dayKey(trip.departureAt),
          bookings: [],
        };
        groups.set(key, g);
      }
      g.bookings.push(b);
    } else {
      // Fără cursă: cheie pe rută + ziua plecării.
      const dk = dayKey(b.departureDate);
      const key = `loose:${b.departureCity}|${b.arrivalCity}|${dk}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          kind: "loose",
          key,
          tripId: null,
          busLabel: null,
          busPlate: null,
          from: b.departureCity,
          to: b.arrivalCity,
          fromParam: b.departureCity,
          toParam: b.arrivalCity,
          departureAt: b.departureDate.toISOString(),
          arrivalAt: null,
          capacity: null,
          seatsTaken: 0,
          dayKey: dk,
          bookings: [],
        };
        groups.set(key, g);
      }
      // Cel mai devreme dintre rezervări dă ora grupului loose.
      if (b.departureDate.toISOString() < g.departureAt) g.departureAt = b.departureDate.toISOString();
      g.bookings.push(b);
    }
  }

  const list = [...groups.values()].sort((a, b) => a.departureAt.localeCompare(b.departureAt));

  // Sumar pe zile pentru calendar: câte curse are fiecare zi.
  const calendar: Record<string, number> = {};
  for (const g of list) calendar[g.dayKey] = (calendar[g.dayKey] ?? 0) + 1;

  return NextResponse.json({ success: true, groups: list, calendar });
}
