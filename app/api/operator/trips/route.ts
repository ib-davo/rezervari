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
function isMD(country?: string | null): boolean {
  return /moldova/i.test(country ?? "");
}
function withCountry(city: string, country?: string | null): string {
  return country ? `${city}, ${country}` : city;
}
function joinCities(set: Set<string>, max = 2): string {
  const arr = [...set];
  if (arr.length <= max) return arr.join(", ");
  return `${arr.slice(0, max).join(", ")} +${arr.length - max}`;
}

type Group = {
  kind: "trip" | "loose";
  key: string;
  // afișare
  busLabel: string | null;
  busPlate: string | null;
  from: string;
  to: string;
  departureAt: string;
  arrivalAt: string | null;
  capacity: number | null;
  seatsTaken: number;
  dayKey: string;
  multi: boolean; // rută cu mai multe puncte de îmbarcare/coborâre
  // link "+"
  add: { tripId?: string; from?: string; to?: string };
  bookings: unknown[];
  // interne (nu se serializează direct)
  _origins: Set<string>;
  _dests: Set<string>;
  _originsFull: Set<string>;
  _destsFull: Set<string>;
  _memberSeats: Map<string, number>;
};

// Vederea pe CURSE FIZICE: o cursă = un autobuz într-o zi, într-o direcție —
// chiar dacă în DB are mai multe rute (puncte de îmbarcare diferite ale
// aceleiași curse). Grupăm după bus + zi + direcție (spre/dinspre Moldova).
export async function GET(req: NextRequest) {
  const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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

  const tripIds = [...new Set(bookings.map((b) => b.tripId).filter((x): x is string => !!x))];
  const trips = tripIds.length
    ? await prisma.trip.findMany({
        where: { id: { in: tripIds } },
        select: {
          id: true,
          departureAt: true,
          arrivalAt: true,
          capacity: true,
          bus: { select: { id: true, label: true, plate: true } },
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
    const trip = b.tripId ? tripMap.get(b.tripId) : null;

    if (trip) {
      const dk = dayKey(trip.departureAt);
      const oName = trip.route?.originCity?.name ?? b.departureCity;
      const dName = trip.route?.destinationCity?.name ?? b.arrivalCity;
      const oCountry = trip.route?.originCity?.country?.name;
      const dCountry = trip.route?.destinationCity?.country?.name;
      // Direcția: spre Moldova (inbound) vs dinspre Moldova (outbound). Ține
      // separat dus/retur ale aceluiași autobuz în aceeași zi.
      const direction = isMD(dCountry) ? "in" : isMD(oCountry) ? "out" : "x";
      // Identitatea autobuzului fizic. Fără id → cădem pe etichetă+plăcuță.
      const busKey = trip.bus?.id ?? `${trip.bus?.label ?? "?"}|${trip.bus?.plate ?? "?"}`;
      const key = `run:${busKey}:${dk}:${direction}`;

      let g = groups.get(key);
      if (!g) {
        g = {
          kind: "trip",
          key,
          busLabel: trip.bus?.label ?? null,
          busPlate: trip.bus?.plate ?? null,
          from: oName,
          to: dName,
          departureAt: trip.departureAt.toISOString(),
          arrivalAt: trip.arrivalAt ? trip.arrivalAt.toISOString() : null,
          capacity: trip.capacity ?? null,
          seatsTaken: 0,
          dayKey: dk,
          multi: false,
          add: {},
          bookings: [],
          _origins: new Set(),
          _dests: new Set(),
          _originsFull: new Set(),
          _destsFull: new Set(),
          _memberSeats: new Map(),
        };
        groups.set(key, g);
      }
      g._origins.add(oName);
      g._dests.add(dName);
      g._originsFull.add(withCountry(oName, oCountry));
      g._destsFull.add(withCountry(dName, dCountry));
      // Ocupare fizică = suma locurilor pe toate leg-urile aceluiași autobuz
      // (dedup pe tripId, ca o cursă cu 2 pasageri să nu fie numărată de 2 ori).
      g._memberSeats.set(trip.id, trip._count.seatBookings);
      if (trip.departureAt.toISOString() < g.departureAt) g.departureAt = trip.departureAt.toISOString();
      if (!g.capacity && trip.capacity) g.capacity = trip.capacity;
      g.bookings.push(b);
    } else {
      const dk = dayKey(b.departureDate);
      const key = `loose:${b.departureCity}|${b.arrivalCity}|${dk}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          kind: "loose",
          key,
          busLabel: null,
          busPlate: null,
          from: b.departureCity,
          to: b.arrivalCity,
          departureAt: b.departureDate.toISOString(),
          arrivalAt: null,
          capacity: null,
          seatsTaken: 0,
          dayKey: dk,
          multi: false,
          add: { from: b.departureCity, to: b.arrivalCity },
          bookings: [],
          _origins: new Set([b.departureCity]),
          _dests: new Set([b.arrivalCity]),
          _originsFull: new Set([b.departureCity]),
          _destsFull: new Set([b.arrivalCity]),
          _memberSeats: new Map(),
        };
        groups.set(key, g);
      }
      if (b.departureDate.toISOString() < g.departureAt) g.departureAt = b.departureDate.toISOString();
      g.bookings.push(b);
    }
  }

  // Post-procesare: rută afișată, ocupare, link "+", curățare câmpuri interne.
  const list = [...groups.values()]
    .sort((a, b) => a.departureAt.localeCompare(b.departureAt))
    .map((g) => {
      const origins = [...g._origins];
      const dests = [...g._dests];
      g.from = joinCities(g._origins);
      g.to = joinCities(g._dests);
      g.multi = origins.length > 1 || dests.length > 1;
      g.seatsTaken = [...g._memberSeats.values()].reduce((s, n) => s + n, 0);

      if (g.kind === "trip") {
        const memberTripIds = [...g._memberSeats.keys()];
        if (memberTripIds.length === 1) {
          // O singură cursă fizică-rută → preselectăm exact cursa (sare la locuri).
          g.add = {
            tripId: memberTripIds[0],
            from: [...g._originsFull][0],
            to: [...g._destsFull][0],
          };
        } else if (dests.length === 1) {
          // Inbound multi-îmbarcare: destinația e fixă, operatorul alege punctul.
          g.add = { to: [...g._destsFull][0] };
        } else if (origins.length === 1) {
          // Outbound multi-coborâre: originea e fixă.
          g.add = { from: [...g._originsFull][0] };
        } else {
          g.add = {};
        }
      }

      // Nu serializăm seturile interne.
      const { _origins, _dests, _originsFull, _destsFull, _memberSeats, ...pub } = g;
      void _origins; void _dests; void _originsFull; void _destsFull; void _memberSeats;
      return pub;
    });

  const calendar: Record<string, number> = {};
  for (const g of list) calendar[g.dayKey] = (calendar[g.dayKey] ?? 0) + 1;

  return NextResponse.json({ success: true, groups: list, calendar });
}
