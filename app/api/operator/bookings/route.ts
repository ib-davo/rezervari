import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";
import { busPlateForRun } from "@/lib/busSchedule";
import { countryOf } from "@/lib/tripGrouping";
import { activeCutoff, activeLegWhere, pastLegWhere } from "@/lib/activeWindow";

export const dynamic = "force-dynamic";

const SELECT = {
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
  passengerResponseAt: true,
  source: true,
  createdByName: true,
  createdAt: true,
  archivedAt: true,
  // Locurile — operatorul trebuie să le poată spune clientului la telefon.
  tripId: true,
  returnTripId: true,
  manualBusId: true,
  notes: true,
  boardedAt: true,
  boardedBy: true,
  baggageSurplus: true,
  seatBookings: { select: { seatNumber: true, tripId: true }, orderBy: { seatNumber: "asc" as const } },
} as const;

export async function GET(req: NextRequest) {
  const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const scope = new URL(req.url).searchParams.get("scope") === "archived" ? "archived" : "active";

  // O rezervare rămâne în Active cât timp cursa e „în desfășurare": nu dispare
  // la ora plecării (autocarul e pe drum 28–40h și pasagerii lui trebuie să fie
  // în listă), ci după fereastra din lib/activeWindow — același prag ca panoul
  // de curse și ca cronul de arhivare. Comparație pe instant absolut → corectă
  // indiferent de fusul serverului.
  const cutoff = activeCutoff();

  const where =
    scope === "active"
      ? {
          archivedAt: null,
          OR: activeLegWhere(cutoff),
        }
      : {
          OR: [
            { archivedAt: { not: null } },
            ...pastLegWhere(cutoff),
          ],
        };

  const bookings = await prisma.booking.findMany({
    where,
    select: SELECT,
    orderBy: scope === "active" ? { departureDate: "asc" } : { departureDate: "desc" },
    take: scope === "archived" ? 300 : 1000,
  });

  // Autocarul fiecărei rezervări: override manual (manualBusId) → autocarul cursei
  // reale (tripId → Trip.bus) → altfel din program (busPlateForRun pe dată + țări).
  // Ca arhiva să poată fi grupată/filtrată pe autocar, nu doar pasageri împrăștiați.
  const manualIds = [...new Set(bookings.map((b) => b.manualBusId).filter((x): x is string => !!x))];
  // Și returTrip-urile: expunem ziua reală a AMBELOR curse legate (vezi mai jos).
  const tripIds = [...new Set(bookings.flatMap((b) => [b.tripId, b.returnTripId]).filter((x): x is string => !!x))];
  const [manualBuses, trips] = await Promise.all([
    manualIds.length ? prisma.bus.findMany({ where: { id: { in: manualIds } }, select: { id: true, plate: true } }) : Promise.resolve([]),
    tripIds.length ? prisma.trip.findMany({ where: { id: { in: tripIds } }, select: { id: true, departureAt: true, bus: { select: { plate: true } } } }) : Promise.resolve([]),
  ]);
  const plateById = new Map<string, string>(manualBuses.map((b) => [b.id, b.plate]));
  const plateByTrip = new Map<string, string>(trips.filter((t) => t.bus).map((t) => [t.id, t.bus!.plate]));
  const depByTrip = new Map<string, string>(trips.map((t) => [t.id, t.departureAt.toISOString()]));
  const withCoach = bookings.map((b) => ({
    ...b,
    // Ziua REALĂ a cursei legate: booking.departureDate poate fi desincronizat de
    // trip.departureAt (baza e scrisă și de davo.md public + importuri, fără
    // gardurile locale) — UI-ul compară cele două și semnalează anomalia.
    tripDepartureAt: b.tripId ? depByTrip.get(b.tripId) ?? null : null,
    returnTripDepartureAt: b.returnTripId ? depByTrip.get(b.returnTripId) ?? null : null,
    coach:
      (b.manualBusId && plateById.get(b.manualBusId)) ||
      (b.tripId && plateByTrip.get(b.tripId)) ||
      busPlateForRun(new Date(b.departureDate), countryOf(b.departureCity), countryOf(b.arrivalCity)) ||
      null,
  }));

  return NextResponse.json({ success: true, scope, bookings: withCoach });
}
