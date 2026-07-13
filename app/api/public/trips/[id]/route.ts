import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { occupiedSeatsForRun } from "@/lib/runSeats";
import type { BusLayout, MultiDeckLayout, SeatLayout } from "@/lib/adminMock";

function safeLayout(raw: string): BusLayout {
  try {
    const l = JSON.parse(raw);
    if (l && Array.isArray((l as MultiDeckLayout).decks)) {
      return l as MultiDeckLayout;
    }
    if (l && Array.isArray((l as SeatLayout).cells)) {
      return l as SeatLayout;
    }
  } catch {}
  return { rows: 1, cols: 1, cells: ["empty"] };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trip = await prisma.trip.findUnique({
      where: { id },
      select: {
        id: true,
        departureAt: true,
        arrivalAt: true,
        status: true,
        route: {
          select: {
            id: true,
            basePrice: true,
            currency: true,
            originCity: { select: { name: true } },
            destinationCity: { select: { name: true } },
          },
        },
        bus: {
          select: {
            id: true,
            label: true,
            plate: true,
            totalSeats: true,
            layoutJson: true,
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json(
        { success: false, error: "Trip not found" },
        { status: 404 }
      );
    }

    const layout = safeLayout(trip.bus.layoutJson);
    // Ocuparea pe RULAREA fizică (toate trip-urile aceluiași autobuz din ziua
    // respectivă), nu doar pe trip-ul rutei curente — locul 1 vândut pe
    // Bruxelles→Chișinău e ocupat și pentru Gent→Chișinău. Vezi lib/runSeats.
    const occupiedSeats = await occupiedSeatsForRun(trip.id);

    return NextResponse.json({
      success: true,
      trip: {
        id: trip.id,
        departureAt: trip.departureAt.toISOString(),
        arrivalAt: trip.arrivalAt.toISOString(),
        status: trip.status,
        route: {
          id: trip.route.id,
          origin: trip.route.originCity.name,
          destination: trip.route.destinationCity.name,
          basePrice: trip.route.basePrice,
          currency: trip.route.currency,
        },
        bus: {
          id: trip.bus.id,
          label: trip.bus.label,
          plate: trip.bus.plate,
          totalSeats: trip.bus.totalSeats,
          layout,
        },
        occupiedSeats,
      },
    });
  } catch (error) {
    console.error("public/trips/[id] GET", error);
    return NextResponse.json(
      { success: false, error: "Failed to load trip" },
      { status: 500 }
    );
  }
}
