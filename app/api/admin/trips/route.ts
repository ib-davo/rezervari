import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
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
        bookings: { select: { price: true, status: true } },
      },
    });

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
          booked: confirmed.length,
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
