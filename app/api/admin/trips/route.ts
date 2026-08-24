import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runKey } from "@/lib/runSeats";

type SeatCountBooking = {
  status: string;
  type: string;
  adults: number | null;
  children: number | null;
  seatBookings: { tripId: string }[];
};

// Pasagerii pe care o rezervare îi ocupă pe o rulare: locurile alese pe
// trip-urile rulării, altfel adulți + copii — identic cu `seatsTaken` din
// lib/tripGrouping.ts, ca dashboardul să arate aceleași cifre ca panoul.
function paxOnRun(b: SeatCountBooking, memberTripIds: Set<string>): number {
  if (b.status === "cancelled") return 0;
  if (b.type === "parcel" || b.type === "colet_la_cheie") return 0;
  const seats = b.seatBookings.filter((s) => memberTripIds.has(s.tripId)).length;
  return seats > 0 ? seats : Math.max(1, (b.adults ?? 0) + (b.children ?? 0));
}

export async function GET() {
  try {
    const seatCountSelect = {
      status: true,
      type: true,
      adults: true,
      children: true,
      seatBookings: { select: { tripId: true } },
    } as const;

    const trips = await prisma.trip.findMany({
      orderBy: { departureAt: "asc" },
      include: {
        route: {
          include: {
            originCity: true,
            destinationCity: true,
          },
        },
        bus: true,
        bookings: { select: { ...seatCountSelect, price: true } },
        returnBookings: { select: seatCountSelect },
      },
    });

    // Ocuparea pe RULAREA fizică (toate trip-urile aceluiași autobuz din aceeași
    // zi UTC), nu doar pe trip-ul rutei curente: pasagerul spre London ocupă
    // autocarul și pentru cursa-soră spre Boston. Fără asta, dashboardul arăta
    // 21/54 pe o cursă când autocarul avea deja 48 de oameni.
    const runMemberTrips = new Map<string, Set<string>>();
    for (const t of trips) {
      const k = runKey(t.busId, t.departureAt);
      if (!runMemberTrips.has(k)) runMemberTrips.set(k, new Set());
      runMemberTrips.get(k)!.add(t.id);
    }
    const runSeatsTaken = new Map<string, number>();
    for (const t of trips) {
      const k = runKey(t.busId, t.departureAt);
      const members = runMemberTrips.get(k)!;
      let taken = runSeatsTaken.get(k) ?? 0;
      for (const b of t.bookings) taken += paxOnRun(b, members);
      for (const b of t.returnBookings) taken += paxOnRun(b, members);
      runSeatsTaken.set(k, taken);
    }

    return NextResponse.json({
      success: true,
      trips: trips.map((t) => {
        const confirmed = t.bookings.filter((b) => b.status === "confirmed");
        return {
          id: t.id,
          routeId: t.routeId,
          routeLabel: `${t.route.originCity.name} → ${t.route.destinationCity.name}`,
          busId: t.busId,
          busLabel: t.bus.label,
          departureAt: t.departureAt.toISOString(),
          arrivalAt: t.arrivalAt.toISOString(),
          status: t.status,
          capacity: t.capacity,
          booked: runSeatsTaken.get(runKey(t.busId, t.departureAt)) ?? 0,
          revenue: confirmed.reduce((s, b) => s + b.price, 0),
        };
      }),
    });
  } catch (error) {
    console.error("admin/trips GET", error);
    return NextResponse.json({ success: false, error: "Failed to load trips" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { routeId, busId, departureAt, arrivalAt, repeatWeekly, notes } = body as {
      routeId: string;
      busId: string;
      departureAt: string;
      arrivalAt: string;
      repeatWeekly?: number;
      notes?: string;
    };

    if (!routeId || !busId || !departureAt || !arrivalAt) {
      return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    const bus = await prisma.bus.findUnique({ where: { id: busId } });
    if (!bus) {
      return NextResponse.json({ success: false, error: "Bus not found" }, { status: 404 });
    }

    const dep0 = new Date(departureAt);
    const arr0 = new Date(arrivalAt);
    const weeks = Math.max(0, Math.min(52, Number(repeatWeekly) || 0));

    const creates = [];
    for (let i = 0; i <= weeks; i++) {
      const dep = new Date(dep0);
      dep.setDate(dep.getDate() + 7 * i);
      const arr = new Date(arr0);
      arr.setDate(arr.getDate() + 7 * i);
      creates.push({
        routeId,
        busId,
        departureAt: dep,
        arrivalAt: arr,
        capacity: bus.totalSeats,
        status: "scheduled",
        notes: notes || null,
      });
    }

    const result = await prisma.trip.createMany({ data: creates });
    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("admin/trips POST", error);
    return NextResponse.json({ success: false, error: "Failed to create trip" }, { status: 500 });
  }
}
