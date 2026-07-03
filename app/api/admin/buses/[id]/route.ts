import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { countSeatsInLayout, type BusLayout, type MultiDeckLayout, type SeatLayout } from "@/lib/adminMock";

function safeLayout(raw: string): BusLayout {
  try {
    const l = JSON.parse(raw);
    if (l && Array.isArray((l as MultiDeckLayout).decks)) return l as MultiDeckLayout;
    if (l && Array.isArray((l as SeatLayout).cells)) return l as SeatLayout;
  } catch {}
  return { rows: 1, cols: 1, cells: ["empty"] };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bus = await prisma.bus.findUnique({ where: { id } });
    if (!bus) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      bus: {
        id: bus.id,
        plate: bus.plate,
        label: bus.label,
        model: bus.model,
        year: bus.year,
        totalSeats: bus.totalSeats,
        active: bus.active,
        layout: safeLayout(bus.layoutJson),
      },
    });
  } catch (error) {
    console.error("admin/buses/[id] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load bus" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.plate !== undefined) data.plate = body.plate;
    if (body.label !== undefined) data.label = body.label;
    if (body.model !== undefined) data.model = body.model;
    if (body.year !== undefined) data.year = Number(body.year);
    if (body.active !== undefined) data.active = !!body.active;
    if (body.layout !== undefined) {
      const layout = body.layout as BusLayout;
      data.layoutJson = JSON.stringify(layout);
      data.totalSeats = countSeatsInLayout(layout);
    }

    const bus = await prisma.bus.update({ where: { id }, data });
    return NextResponse.json({ success: true, bus });
  } catch (error) {
    console.error("admin/buses/[id] PATCH", error);
    return NextResponse.json({ success: false, error: "Failed to update bus" }, { status: 500 });
  }
}
