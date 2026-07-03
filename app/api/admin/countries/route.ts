import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const countries = await prisma.country.findMany({
      orderBy: [{ name: "asc" }],
      include: {
        _count: { select: { cities: true } },
      },
    });

    return NextResponse.json({
      success: true,
      countries: countries.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        flag: c.flag,
        cityCount: c._count.cities,
        outboundWeekday: c.outboundWeekday,
        outboundTime: c.outboundTime,
        outboundDurationHours: c.outboundDurationHours,
        returnWeekday: c.returnWeekday,
        returnTime: c.returnTime,
        returnDurationHours: c.returnDurationHours,
      })),
    });
  } catch (error) {
    console.error("admin/countries GET", error);
    return NextResponse.json(
      { success: false, error: "Failed to load countries" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...rest } = body as {
      id: string;
      outboundWeekday?: number | null;
      outboundTime?: string | null;
      outboundDurationHours?: number | null;
      returnWeekday?: number | null;
      returnTime?: string | null;
      returnDurationHours?: number | null;
    };

    if (!id) {
      return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
    }

    // Normalize: empty string → null, înainte de validare.
    const norm = <T,>(v: T | "" | null | undefined): T | null => {
      if (v === "" || v === undefined || v === null) return null;
      return v;
    };

    const data: Record<string, unknown> = {};
    if ("outboundWeekday" in rest) data.outboundWeekday = norm(rest.outboundWeekday);
    if ("outboundTime" in rest) data.outboundTime = norm(rest.outboundTime);
    if ("outboundDurationHours" in rest) data.outboundDurationHours = norm(rest.outboundDurationHours);
    if ("returnWeekday" in rest) data.returnWeekday = norm(rest.returnWeekday);
    if ("returnTime" in rest) data.returnTime = norm(rest.returnTime);
    if ("returnDurationHours" in rest) data.returnDurationHours = norm(rest.returnDurationHours);

    // Validare ușoară
    const wd = (v: unknown): boolean =>
      v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 6);
    if (!wd(data.outboundWeekday) || !wd(data.returnWeekday)) {
      return NextResponse.json(
        { success: false, error: "Weekday must be 0..6 sau gol" },
        { status: 400 }
      );
    }
    const tm = (v: unknown): boolean =>
      v === null || (typeof v === "string" && /^\d{2}:\d{2}$/.test(v));
    if (!tm(data.outboundTime) || !tm(data.returnTime)) {
      return NextResponse.json(
        { success: false, error: 'Time must be "HH:mm" sau gol' },
        { status: 400 }
      );
    }

    const updated = await prisma.country.update({ where: { id }, data });

    // După update, curățăm trip-urile viitoare GOALE (fără SeatBookings) de pe
    // toate rutele care ating țara asta. Următorul fetch în /api/public/trips
    // le recreează cu noul schedule.
    //
    // Trip-urile cu bookings rămân — pasagerii au email-uri/bilete cu ora veche
    // și nu vrem să rupem rezervările existente. Operatorul îi anunță manual
    // dacă schedule-ul s-a mutat.
    try {
      const affectedRoutes = await prisma.route.findMany({
        where: {
          active: true,
          OR: [
            { originCity: { countryId: id } },
            { destinationCity: { countryId: id } },
          ],
        },
        select: { id: true },
      });
      if (affectedRoutes.length > 0) {
        await prisma.trip.deleteMany({
          where: {
            routeId: { in: affectedRoutes.map((r) => r.id) },
            departureAt: { gt: new Date() },
            status: "scheduled",
            seatBookings: { none: {} },
          },
        });
      }
    } catch (cleanupErr) {
      // Curățarea e best-effort — dacă pică, update-ul de Country tot a trecut.
      // Următorul cron / fetch va consolida.
      console.warn("admin/countries PATCH cleanup:", cleanupErr);
    }

    return NextResponse.json({ success: true, country: updated });
  } catch (error) {
    console.error("admin/countries PATCH", error);
    const msg = error instanceof Error ? error.message : "Failed to update country";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
