import { NextRequest, NextResponse } from "next/server";
import { verifyOperatorSupervisor, OPERATOR_COOKIE } from "@/lib/operatorSession";
import { prisma } from "@/lib/prisma";
import { buildTripGroups } from "@/lib/tripGrouping";
import { busPlateForRun, busPlateForCountry } from "@/lib/busSchedule";
import { sendConfirmationNow } from "@/lib/emailQueue";

export const dynamic = "force-dynamic";

// Circuit Belgia/Olanda/Germania: ACELAȘI autocar pleacă vineri (dus) și se
// întoarce duminică (retur). ZNQ 874 și DAW 777 sunt autocarele acestei rute de
// weekend, deci mutarea e conștientă de circuit: mutând vinerea, mut automat și
// duminica pe același autocar (și invers). Gardat pe autocar, nu pe țări.
const WEEKEND_COACHES = new Set(["ZNQ 874", "DAW 777"]);
function weekday(dk: string): number { const [y, m, d] = dk.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
function addDays(dk: string, n: number): string { const [y, m, d] = dk.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
function dayUtc(dk: string): { gte: Date; lte: Date } {
  const [y, m, d] = dk.split("-").map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)), lte: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)) };
}

// Schimbă AUTOCARUL unei rute schimbând `Trip.busId` — deci autocarul e EXCLUSIV:
// nu mai coexistă două autocare pe aceeași cursă (ZNQ 874 ȘI DAW 777). Formularul,
// harta locurilor, cardurile și rezervările noi citesc toate `Trip.busId`.
// busId=null = revenire la autocarul PROGRAMAT (din orar). Pentru ruta BE/OL/D
// mută și perechea vineri↔duminică (același autocar fizic). DOAR supervizorul.
export async function POST(req: NextRequest) {
  const session = await verifyOperatorSupervisor(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ success: false, error: "Doar supervizorul poate schimba autocarul unei rute" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const key = typeof body.key === "string" ? body.key : "";
  const requestedBusId = body.busId == null || body.busId === "" ? null : String(body.busId);
  if (!key) return NextResponse.json({ success: false, error: "Cursă nespecificată" }, { status: 400 });

  const { groups } = await buildTripGroups();
  const g = groups.find((x) => x.key === key);
  if (!g) return NextResponse.json({ success: false, error: "Cursă negăsită" }, { status: 404 });
  if (!g.busId) return NextResponse.json({ success: false, error: "Cursa n-are un autocar de schimbat" }, { status: 400 });

  // Zilele afectate: ziua cardului + perechea de weekend (vineri↔duminică) pentru
  // autocarele rutei BE/OL/D, ca „vineri X → duminică X" să rămână adevărat.
  const days = [g.dayKey];
  if (g.busPlate && WEEKEND_COACHES.has(g.busPlate)) {
    const wd = weekday(g.dayKey);
    const paired = wd === 5 ? addDays(g.dayKey, 2) : wd === 0 ? addDays(g.dayKey, -2) : null;
    if (paired) days.push(paired);
  }

  // Cursele afectate = TOATE cursele din zilele afectate care sunt pe autocarul
  // curent al rutei (g.busId) — inclusiv cele fără rezervări, ca întreaga rută să
  // treacă pe noul autocar (fără să rămână cursa goală pe cel vechi).
  const affected = await prisma.trip.findMany({
    where: { busId: g.busId, OR: days.map((dk) => ({ departureAt: dayUtc(dk) })) },
    select: {
      id: true, departureAt: true,
      seatBookings: { select: { seatNumber: true } },
      route: { select: { originCity: { select: { country: { select: { name: true } } } }, destinationCity: { select: { country: { select: { name: true } } } } } },
    },
  });
  if (affected.length === 0) return NextResponse.json({ success: false, error: "Cursa n-are curse de mutat" }, { status: 400 });

  // Autocarul țintă: cel cerut, sau (revenire) autocarul PROGRAMAT din orar.
  let targetBusId = requestedBusId;
  if (!targetBusId) {
    const t0 = affected[0];
    const plate = busPlateForRun(t0.departureAt, t0.route.originCity.country?.name ?? null, t0.route.destinationCity.country?.name ?? null)
      ?? busPlateForCountry(t0.route.destinationCity.country?.name ?? t0.route.originCity.country?.name ?? "");
    const schedBus = plate ? await prisma.bus.findFirst({ where: { plate, active: true }, select: { id: true } }) : null;
    if (!schedBus) return NextResponse.json({ success: false, error: "Nu pot determina autocarul programat pentru revenire" }, { status: 400 });
    targetBusId = schedBus.id;
  }
  const target = await prisma.bus.findFirst({ where: { id: targetBusId, active: true }, select: { id: true, plate: true, totalSeats: true } });
  if (!target) return NextResponse.json({ success: false, error: "Autocar invalid" }, { status: 400 });

  // SIGURANȚĂ: nu trece pe un autocar mai mic decât locul maxim deja rezervat
  // (altfel un pasager ar rămâne cu un loc inexistent pe noul autocar).
  const maxSeat = Math.max(0, ...affected.flatMap((t) => t.seatBookings.map((s) => s.seatNumber)));
  if (maxSeat > target.totalSeats) {
    return NextResponse.json({ success: false, error: `Autocarul ${target.plate} are ${target.totalSeats} locuri, dar există rezervare pe locul ${maxSeat}. Eliberează locul întâi.` }, { status: 400 });
  }

  const tripIds = affected.map((t) => t.id);
  // Schimbă autocarul cursei (exclusiv) + sincronizează capacitatea. Curăță orice
  // manualBusId rămas (modelul vechi) — acum sursa de adevăr e Trip.busId.
  await prisma.trip.updateMany({ where: { id: { in: tripIds } }, data: { busId: target.id, capacity: target.totalSeats } });
  await prisma.booking.updateMany({ where: { tripId: { in: tripIds }, manualBusId: { not: null } }, data: { manualBusId: null } });

  const affectedBookings = await prisma.booking.findMany({ where: { tripId: { in: tripIds }, status: { not: "cancelled" } }, select: { id: true } });

  // Anunță pasagerii cu confirmarea actualizată (autocarul nou) — doar dacă bifa
  // „anunță" e pornită. Emailurile nu blochează răspunsul dacă una pică.
  let emailed = 0;
  if (body.notify === true && affectedBookings.length) {
    const sent = await Promise.allSettled(affectedBookings.map((b) => sendConfirmationNow(b.id)));
    emailed = sent.filter((r) => r.status === "fulfilled" && r.value.sent).length;
  }

  return NextResponse.json({ success: true, moved: affectedBookings.length, trips: tripIds.length, bus: target.plate, emailed });
}
