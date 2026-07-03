import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SeatLayout, SeatKind } from "@/lib/adminMock";

function safeLayout(raw: string): SeatLayout {
  try {
    const l = JSON.parse(raw) as SeatLayout;
    if (l && Array.isArray(l.cells) && typeof l.rows === "number" && typeof l.cols === "number") {
      return l;
    }
  } catch {}
  return { rows: 1, cols: 1, cells: ["empty"] };
}

export async function GET() {
  try {
    const buses = await prisma.bus.findMany({ orderBy: { createdAt: "asc" } });
    return NextResponse.json({
      success: true,
      buses: buses.map((b) => ({
        id: b.id,
        plate: b.plate,
        label: b.label,
        model: b.model,
        year: b.year,
        totalSeats: b.totalSeats,
        active: b.active,
        layout: safeLayout(b.layoutJson),
      })),
    });
  } catch (error) {
    console.error("admin/buses GET", error);
    return NextResponse.json({ success: false, error: "Failed to load buses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plate, label, model, year, layout } = body as {
      plate: string;
      label: string;
      model: string;
      year: number;
      layout: SeatLayout;
    };
    if (!plate || !label) {
      return NextResponse.json({ success: false, error: "plate + label required" }, { status: 400 });
    }
    const totalSeats = layout?.cells.filter((c: SeatKind) => c === "seat").length ?? 0;
    const bus = await prisma.bus.create({
      data: {
        plate,
        label,
        model: model || "",
        year: Number(year) || new Date().getFullYear(),
        totalSeats,
        layoutJson: JSON.stringify(layout ?? { rows: 1, cols: 1, cells: ["empty"] }),
        active: true,
      },
    });
    return NextResponse.json({ success: true, bus });
  } catch (error) {
    console.error("admin/buses POST", error);
    return NextResponse.json({ success: false, error: "Failed to create bus" }, { status: 500 });
  }
}
