import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";

export const dynamic = "force-dynamic";

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
  manualBusId: true,
  seatBookings: { select: { seatNumber: true, tripId: true }, orderBy: { seatNumber: "asc" as const } },
} as const;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isMD(country?: string | null): boolean {
  return /moldova/i.test(country ?? "");
}
function countryOf(cityStr: string): string {
  const parts = cityStr.split(",");
  return parts.length > 1 ? parts[parts.length - 1].trim() : "";
}
function withCountry(city: string, country?: string | null): string {
  return country ? `${city}, ${country}` : city;
}
function joinCities(set: Set<string>, max = 2): string {
  const arr = [...set];
  if (arr.length <= max) return arr.join(", ");
  return `${arr.slice(0, max).join(", ")} +${arr.length - max}`;
}

type JourneyBus = { id: string; label: string; plate: string | null; totalSeats: number | null };

type Group = {
  kind: "trip" | "loose";
  key: string;
  busId: string | null;
  busLabel: string | null;
  busPlate: string | null;
  from: string;
  to: string;
  departureAt: string;
  arrivalAt: string | null;
  capacity: number | null;
  seatsTaken: number;
  dayKey: string;
  multi: boolean;
  add: { tripId?: string; from?: string; to?: string };
  bookings: unknown[];
  _origins: Set<string>;
  _dests: Set<string>;
  _originsFull: Set<string>;
  _destsFull: Set<string>;
  _memberSeats: Map<string, number>;
};

// Vederea pe CURSE FIZICE: o cursă = un autobuz (real, din trip, SAU atribuit
// manual) într-o zi, într-o direcție (spre / dinspre Moldova) — chiar dacă
// trece prin mai multe țări (rute diferite în DB). Rezervările fără autobuz se
// strâng într-un singur card „fără autocar" per zi + direcție.
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
          bus: { select: { id: true, label: true, plate: true, totalSeats: true } },
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

  // Autobuze atribuite manual (pentru rezervări fără cursă cu autocar).
  const manualBusIds = [...new Set(bookings.map((b) => b.manualBusId).filter((x): x is string => !!x))];
  const manualBuses = manualBusIds.length
    ? await prisma.bus.findMany({ where: { id: { in: manualBusIds } }, select: { id: true, label: true, plate: true, totalSeats: true } })
    : [];
  const busMap = new Map(manualBuses.map((b) => [b.id, b]));

  const groups = new Map<string, Group>();

  for (const b of bookings) {
    const trip = b.tripId ? tripMap.get(b.tripId) : null;

    // Autobuzul fizic al rezervării: cel din cursă, altfel cel atribuit manual.
    let bus: JourneyBus | null = null;
    if (trip?.bus) bus = { id: trip.bus.id, label: trip.bus.label, plate: trip.bus.plate ?? null, totalSeats: trip.bus.totalSeats ?? null };
    else if (b.manualBusId && busMap.has(b.manualBusId)) {
      const mb = busMap.get(b.manualBusId)!;
      bus = { id: mb.id, label: mb.label, plate: mb.plate ?? null, totalSeats: mb.totalSeats ?? null };
    }

    // Rută + direcție: din cursă dacă există, altfel din câmpurile rezervării.
    const oName = trip?.route?.originCity?.name ?? b.departureCity;
    const dName = trip?.route?.destinationCity?.name ?? b.arrivalCity;
    const oCountry = trip?.route?.originCity?.country?.name ?? countryOf(b.departureCity);
    const dCountry = trip?.route?.destinationCity?.country?.name ?? countryOf(b.arrivalCity);
    const direction = isMD(dCountry) ? "in" : isMD(oCountry) ? "out" : "x";

    const dk = trip ? dayKey(trip.departureAt) : dayKey(b.departureDate);
    const departureIso = trip ? trip.departureAt.toISOString() : b.departureDate.toISOString();
    const busKey = bus?.id ?? "none";
    const key = `${dk}:${direction}:${busKey}`;

    let g = groups.get(key);
    if (!g) {
      g = {
        kind: bus ? "trip" : "loose",
        key,
        busId: bus?.id ?? null,
        busLabel: bus?.label ?? null,
        busPlate: bus?.plate ?? null,
        from: oName,
        to: dName,
        departureAt: departureIso,
        arrivalAt: trip?.arrivalAt ? trip.arrivalAt.toISOString() : null,
        capacity: bus?.totalSeats ?? trip?.capacity ?? null,
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
    // Ocupare fizică = suma locurilor pe leg-urile reale (dedup pe tripId).
    if (trip) g._memberSeats.set(trip.id, trip._count.seatBookings);
    if (departureIso < g.departureAt) g.departureAt = departureIso;
    if (!g.capacity && (bus?.totalSeats || trip?.capacity)) g.capacity = bus?.totalSeats ?? trip?.capacity ?? null;
    g.bookings.push(b);
  }

  const list = [...groups.values()]
    .sort((a, b) => a.departureAt.localeCompare(b.departureAt))
    .map((g) => {
      const origins = [...g._origins];
      const dests = [...g._dests];
      g.from = joinCities(g._origins);
      g.to = joinCities(g._dests);
      g.multi = origins.length > 1 || dests.length > 1;
      g.seatsTaken = [...g._memberSeats.values()].reduce((s, n) => s + n, 0);

      // Link "+": preselectăm cursa dacă e una singură; altfel precompletăm
      // capătul fix (destinația pentru inbound, originea pentru outbound).
      const memberTripIds = [...g._memberSeats.keys()];
      if (memberTripIds.length === 1 && origins.length === 1 && dests.length === 1) {
        g.add = { tripId: memberTripIds[0], from: [...g._originsFull][0], to: [...g._destsFull][0] };
      } else if (dests.length === 1) {
        g.add = { to: [...g._destsFull][0] };
      } else if (origins.length === 1) {
        g.add = { from: [...g._originsFull][0] };
      } else {
        g.add = {};
      }

      const { _origins, _dests, _originsFull, _destsFull, _memberSeats, ...pub } = g;
      void _origins; void _dests; void _originsFull; void _destsFull; void _memberSeats;
      return pub;
    });

  const calendar: Record<string, number> = {};
  for (const g of list) calendar[g.dayKey] = (calendar[g.dayKey] ?? 0) + 1;

  return NextResponse.json({ success: true, groups: list, calendar });
}
