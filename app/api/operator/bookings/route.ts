import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";
import { busPlateForRun } from "@/lib/busSchedule";
import { countryOf } from "@/lib/tripGrouping";

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

  // O cursă "a avut loc" când i-a trecut ORA reală de plecare (retur dacă
  // există, altfel dus) — NU la miezul nopții. `departureDate`/`returnDate`
  // sunt timestamp-uri complete (ex. 08:30), deci comparăm cu momentul curent:
  // o cursă de azi 08:30 dispare din Active după ora 08:30, nu abia mâine.
  // Comparație pe instant absolut → corectă indiferent de fusul serverului.
  const now = new Date();

  const where =
    scope === "active"
      ? {
          archivedAt: null,
          OR: [
            { returnDate: { gte: now } },
            { returnDate: null, departureDate: { gte: now } },
          ],
        }
      : {
          OR: [
            { archivedAt: { not: null } },
            { returnDate: null, departureDate: { lt: now } },
            { returnDate: { not: null, lt: now } },
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
  const tripIds = [...new Set(bookings.map((b) => b.tripId).filter((x): x is string => !!x))];
  const [manualBuses, trips] = await Promise.all([
    manualIds.length ? prisma.bus.findMany({ where: { id: { in: manualIds } }, select: { id: true, plate: true } }) : Promise.resolve([]),
    tripIds.length ? prisma.trip.findMany({ where: { id: { in: tripIds } }, select: { id: true, bus: { select: { plate: true } } } }) : Promise.resolve([]),
  ]);
  const plateById = new Map<string, string>(manualBuses.map((b) => [b.id, b.plate]));
  const plateByTrip = new Map<string, string>(trips.filter((t) => t.bus).map((t) => [t.id, t.bus!.plate]));
  const withCoach = bookings.map((b) => ({
    ...b,
    coach:
      (b.manualBusId && plateById.get(b.manualBusId)) ||
      (b.tripId && plateByTrip.get(b.tripId)) ||
      busPlateForRun(new Date(b.departureDate), countryOf(b.departureCity), countryOf(b.arrivalCity)) ||
      null,
  }));

  return NextResponse.json({ success: true, scope, bookings: withCoach });
}
