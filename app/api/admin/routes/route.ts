import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const routes = await prisma.route.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        originCity: { include: { country: true } },
        destinationCity: { include: { country: true } },
      },
    });

    return NextResponse.json({
      success: true,
      routes: routes.map((r) => ({
        id: r.id,
        origin: r.originCity.name,
        destination: r.destinationCity.name,
        country: r.destinationCity.country.name,
        basePrice: r.basePrice,
        currency: r.currency,
        active: r.active,
        description: r.description ?? "",
        weeklyDepartures: r.weeklyDepartures,
        originCityId: r.originCityId,
        destinationCityId: r.destinationCityId,
      })),
    });
  } catch (error) {
    console.error("admin/routes GET", error);
    return NextResponse.json({ success: false, error: "Failed to load routes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      originCityId,
      destinationCityId,
      basePrice,
      currency,
      description,
      weeklyDepartures,
      active,
    } = body;

    if (!originCityId || !destinationCityId) {
      return NextResponse.json(
        { success: false, error: "originCityId and destinationCityId required" },
        { status: 400 }
      );
    }

    const route = await prisma.route.create({
      data: {
        originCityId,
        destinationCityId,
        basePrice: Number(basePrice) || 0,
        currency: currency || "EUR",
        description: description || null,
        weeklyDepartures: Number(weeklyDepartures) || 2,
        active: active !== false,
      },
    });

    return NextResponse.json({ success: true, route });
  } catch (error: unknown) {
    console.error("admin/routes POST", error);
    const msg = error instanceof Error && error.message.includes("Unique") ? "Rută deja existentă" : "Failed to create route";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
