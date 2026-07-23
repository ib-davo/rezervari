import { NextRequest, NextResponse } from "next/server";
import { verifyOperatorSupervisor, OPERATOR_COOKIE } from "@/lib/operatorSession";
import { prisma } from "@/lib/prisma";
import { buildTripGroups } from "@/lib/tripGrouping";
import { sendConfirmationNow } from "@/lib/emailQueue";

export const dynamic = "force-dynamic";

// Circuit Belgia/Olanda/Germania: ACELAȘI autocar pleacă vineri (dus) și se
// întoarce duminică (retur). ZNQ 874 și DAW 777 sunt autocarele acestei rute de
// weekend, deci mutarea e conștientă de circuit: mutând vinerea, mut automat și
// duminica pe același autocar (și invers). Gardat pe autocar, nu pe țări — ca să
// nu conteze pasagerii de tranzit (ex. Ungaria pe ruta ZNQ).
const WEEKEND_COACHES = new Set(["ZNQ 874", "DAW 777"]);
function weekday(dk: string): number { const [y, m, d] = dk.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
function addDays(dk: string, n: number): string { const [y, m, d] = dk.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }

// Mută TOATE rezervările unei rute pe alt autocar (manualBusId). Locuri, prețuri,
// tripId, seatBookings rămân neatinse. busId=null = revenire la autocarul dedus.
// Pentru ruta BE/OL/D mută și perechea vineri↔duminică (același autocar fizic).
// DOAR supervizorul (Adrian).
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

  const ids = new Set(g.bookings.map((b) => b.id));

  // Circuit BE/OL/D: mută și perechea vineri↔duminică (același autocar sursă
  // g.busId) — ca „vineri X → duminică X" să rămână adevărat. Doar pentru
  // autocarele rutei de weekend (ZNQ 874 / DAW 777).
  if (g.busPlate && WEEKEND_COACHES.has(g.busPlate)) {
    const wd = weekday(g.dayKey);
    const pairedDay = wd === 5 ? addDays(g.dayKey, 2) : wd === 0 ? addDays(g.dayKey, -2) : null;
    if (pairedDay) {
      const pair = groups.find(
        (x) => x.dayKey === pairedDay && x.busId === g.busId && x.bookings.length > 0,
      );
      if (pair) for (const b of pair.bookings) ids.add(b.id);
    }
  }

  if (ids.size === 0) return NextResponse.json({ success: false, error: "Cursa n-are rezervări de mutat" }, { status: 400 });

  await prisma.booking.updateMany({ where: { id: { in: [...ids] } }, data: { manualBusId: busId } });

  // Anunță pasagerii cu confirmarea actualizată (autocarul nou) — fix ca la
  // atribuirea din davo.md/admin. DOAR dacă bifa „anunță" e pornită (notify).
  // Emailurile nu blochează răspunsul dacă una pică.
  let emailed = 0;
  if (body.notify === true) {
    const sent = await Promise.allSettled([...ids].map((bid) => sendConfirmationNow(bid)));
    emailed = sent.filter((r) => r.status === "fulfilled" && r.value.sent).length;
  }

  return NextResponse.json({ success: true, moved: ids.size, emailed });
}
