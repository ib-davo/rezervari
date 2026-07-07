// Gruparea rezervărilor active pe CURSE FIZICE (un autobuz — real din Trip.bus
// sau atribuit manual — într-o zi). Folosită de /api/operator/trips (dashboard)
// și de /api/operator/manifest (export Excel/PDF), ca să fie o singură sursă.
import { prisma } from "@/lib/prisma";
import { scheduleForDay, scheduledPlateForTrip } from "@/lib/busSchedule";

export const BOOKING_SELECT = {
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
  parcelDetails: true,
  source: true,
  createdByName: true,
  createdAt: true,
  archivedAt: true,
  tripId: true,
  returnTripId: true,
  manualBusId: true,
  seatBookings: { select: { seatNumber: true, tripId: true }, orderBy: { seatNumber: "asc" as const } },
} as const;

export type BookingRow = Awaited<ReturnType<typeof loadBookings>>[number];

export type TripGroupData = {
  kind: "trip" | "loose" | "empty";
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
  tripIds: string[];
  bookings: BookingRow[];
};

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
function paxOf(b: BookingRow): number {
  if (b.type === "parcel") return 1;
  return Math.max(1, (b.adults ?? 0) + (b.children ?? 0));
}

function loadBookings(now: Date) {
  return prisma.booking.findMany({
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
}

type JourneyBus = { id: string; label: string; plate: string | null; totalSeats: number | null };

type Group = TripGroupData & {
  _origins: Set<string>;
  _dests: Set<string>;
  _originsFull: Set<string>;
  _destsFull: Set<string>;
  _memberTrips: Set<string>;
};

export async function buildTripGroups(): Promise<{ groups: TripGroupData[]; calendar: Record<string, number>; scheduledDays: string[] }> {
  const now = new Date();
  const bookings = await loadBookings(now);

  const tripIds = [
    ...new Set(bookings.flatMap((b) => [b.tripId, b.returnTripId]).filter((x): x is string => !!x)),
  ];
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
        },
      })
    : [];
  const tripMap = new Map(trips.map((t) => [t.id, t]));

  const manualBusIds = [...new Set(bookings.map((b) => b.manualBusId).filter((x): x is string => !!x))];
  const manualBuses = manualBusIds.length
    ? await prisma.bus.findMany({ where: { id: { in: manualBusIds } }, select: { id: true, label: true, plate: true, totalSeats: true } })
    : [];
  const busMap = new Map(manualBuses.map((b) => [b.id, b]));

  // Toate autobuzele active (după plăcuță) — pentru programul fix + cardurile goale.
  const allBuses = await prisma.bus.findMany({ where: { active: true }, select: { id: true, label: true, plate: true, totalSeats: true } });
  const busByPlate = new Map(allBuses.map((b) => [b.plate, b]));

  const groups = new Map<string, Group>();

  const placeLeg = (b: BookingRow, legKind: "dep" | "ret") => {
    const legTripId = legKind === "dep" ? b.tripId : b.returnTripId;
    const trip = legTripId ? tripMap.get(legTripId) ?? null : null;
    if (legKind === "ret" && !trip) return;

    let bus: JourneyBus | null = null;
    if (trip?.bus) bus = { id: trip.bus.id, label: trip.bus.label, plate: trip.bus.plate ?? null, totalSeats: trip.bus.totalSeats ?? null };
    else if (legKind === "dep" && b.manualBusId && busMap.has(b.manualBusId)) {
      const mb = busMap.get(b.manualBusId)!;
      bus = { id: mb.id, label: mb.label, plate: mb.plate ?? null, totalSeats: mb.totalSeats ?? null };
    }

    const oName = trip?.route?.originCity?.name ?? b.departureCity;
    const dName = trip?.route?.destinationCity?.name ?? b.arrivalCity;
    const oCountry = trip?.route?.originCity?.country?.name ?? countryOf(b.departureCity);
    const dCountry = trip?.route?.destinationCity?.country?.name ?? countryOf(b.arrivalCity);
    const direction = isMD(dCountry) ? "in" : isMD(oCountry) ? "out" : "x";

    // PROGRAM FIX: autobuzul e determinat de zi + țară (dus) / țara de origine
    // (retur), nu de ce e în DB. Se aplică și rezervărilor loose (fără cursă),
    // după data + țările lor (dacă orașul are „, Țară"). Doar pe leg-ul dus la loose.
    if (trip || legKind === "dep") {
      const schedDate = trip ? trip.departureAt : b.departureDate;
      const plate = scheduledPlateForTrip(schedDate, oCountry, dCountry, dName);
      if (plate && busByPlate.has(plate)) {
        const sb = busByPlate.get(plate)!;
        bus = { id: sb.id, label: sb.label, plate: sb.plate ?? null, totalSeats: sb.totalSeats ?? null };
      }
    }

    const dk = trip ? dayKey(trip.departureAt) : dayKey(b.departureDate);
    const departureIso = trip ? trip.departureAt.toISOString() : b.departureDate.toISOString();
    const key = bus ? `${dk}:bus:${bus.id}` : `${dk}:none:${direction}`;

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
        tripIds: [],
        bookings: [],
        _origins: new Set(),
        _dests: new Set(),
        _originsFull: new Set(),
        _destsFull: new Set(),
        _memberTrips: new Set(),
      };
      groups.set(key, g);
    }

    g._origins.add(oName);
    g._dests.add(dName);
    g._originsFull.add(withCountry(oName, oCountry));
    g._destsFull.add(withCountry(dName, dCountry));
    if (trip) g._memberTrips.add(trip.id);
    if (departureIso < g.departureAt) g.departureAt = departureIso;
    if (!g.capacity && (bus?.totalSeats || trip?.capacity)) g.capacity = bus?.totalSeats ?? trip?.capacity ?? null;
    g.bookings.push(b);
  };

  for (const b of bookings) {
    placeLeg(b, "dep");
    placeLeg(b, "ret");
  }

  const list = [...groups.values()]
    .sort((a, b) => a.departureAt.localeCompare(b.departureAt))
    .map((g) => {
      const origins = [...g._origins];
      const dests = [...g._dests];
      g.from = joinCities(g._origins);
      g.to = joinCities(g._dests);
      g.multi = origins.length > 1 || dests.length > 1;
      g.tripIds = [...g._memberTrips];

      g.seatsTaken = g.bookings.reduce((sum, b) => {
        if (b.status === "cancelled") return sum;
        const seats = (b.seatBookings || []).filter((s) => g._memberTrips.has(s.tripId)).length;
        return sum + (seats > 0 ? seats : paxOf(b));
      }, 0);

      const memberTripIds = g.tripIds;
      if (memberTripIds.length === 1 && origins.length === 1 && dests.length === 1) {
        g.add = { tripId: memberTripIds[0], from: [...g._originsFull][0], to: [...g._destsFull][0] };
      } else if (dests.length === 1) {
        g.add = { to: [...g._destsFull][0] };
      } else if (origins.length === 1) {
        g.add = { from: [...g._originsFull][0] };
      } else {
        g.add = {};
      }

      const { _origins, _dests, _originsFull, _destsFull, _memberTrips, ...pub } = g;
      void _origins; void _dests; void _originsFull; void _destsFull; void _memberTrips;
      return pub;
    });

  // Calendarul „cu pasageri" (doar cursele cu rezervări) — înainte de a adăuga goalele.
  const calendar: Record<string, number> = {};
  for (const g of list) calendar[g.dayKey] = (calendar[g.dayKey] ?? 0) + 1;

  // Curse PROGRAMATE GOALE — generate din PROGRAMUL FIX (nu din DB): fiecare
  // zi de plecare (joi / vineri) în fereastra de ~16 săptămâni primește un card
  // cu autobuzul + țările deservite. Zilele care au deja rezervări pe același
  // autobuz NU primesc card gol (cheie identică → sar).
  const existingKeys = new Set(list.map((g) => g.key));
  const scheduledDaysSet = new Set<string>();
  const horizonDays = 16 * 7;
  const midday = 12 * 3600 * 1000; // ora orientativă pentru afișare
  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const sch = scheduleForDay(d);
    if (!sch) continue;
    const dk = dayKey(d);
    scheduledDaysSet.add(dk);
    const bus = busByPlate.get(sch.plate);
    if (!bus) continue;
    const key = `${dk}:bus:${bus.id}`;
    if (existingKeys.has(key)) continue; // ziua are deja rezervări pe acest autobuz
    existingKeys.add(key);
    list.push({
      kind: "empty",
      key,
      busId: bus.id,
      busLabel: bus.label,
      busPlate: bus.plate ?? null,
      from: "Chișinău",
      to: sch.countries.join(", "),
      departureAt: new Date(d.getTime() + midday).toISOString(),
      arrivalAt: null,
      capacity: bus.totalSeats ?? null,
      seatsTaken: 0,
      dayKey: dk,
      multi: false,
      add: {},
      tripIds: [],
      bookings: [],
    });
  }
  list.sort((a, b) => a.departureAt.localeCompare(b.departureAt));

  return { groups: list, calendar, scheduledDays: [...scheduledDaysSet] };
}
