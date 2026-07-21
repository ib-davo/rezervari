import { NextRequest, NextResponse } from "next/server";
import { verifyOperatorSupervisor, OPERATOR_COOKIE } from "@/lib/operatorSession";
import { prisma } from "@/lib/prisma";
import { buildTripGroups } from "@/lib/tripGrouping";

export const dynamic = "force-dynamic";

// Mută TOATE rezervările unui card (rută) pe alt autocar, setând manualBusId pe
// fiecare. Ex: o rută pusă din greșeală pe ZNQ 874 → mutată pe DAW 777, fără să
// se schimbe altceva (locuri, prețuri, tripId, seatBookings rămân neatinse —
// manualBusId schimbă doar „foaia fizică" pe care apare). busId=null = revenire
// la autocarul dedus automat din rută. DOAR supervizorul (Adrian).
export async function POST(req: NextRequest) {
  const session = await verifyOperatorSupervisor(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ success: false, error: "Doar supervizorul poate muta autocarul unei rute" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const key = typeof body.key === "string" ? body.key : "";
  const busId = body.busId == null || body.busId === "" ? null : String(body.busId);
  if (!key) return NextResponse.json({ success: false, error: "Cursă nespecificată" }, { status: 400 });

  if (busId) {
    const bus = await prisma.bus.findFirst({ where: { id: busId, active: true }, select: { id: true } });
    if (!bus) return NextResponse.json({ success: false, error: "Autocar invalid" }, { status: 400 });
  }

  const { groups } = await buildTripGroups();
  const g = groups.find((x) => x.key === key);
  if (!g) return NextResponse.json({ success: false, error: "Cursă negăsită" }, { status: 404 });

  const ids = g.bookings.map((b) => b.id);
  if (ids.length === 0) return NextResponse.json({ success: false, error: "Cursa n-are rezervări de mutat" }, { status: 400 });

  await prisma.booking.updateMany({ where: { id: { in: ids } }, data: { manualBusId: busId } });
  return NextResponse.json({ success: true, moved: ids.length });
}
