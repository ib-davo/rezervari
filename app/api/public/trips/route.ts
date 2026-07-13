import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { arrivalFor, nextDepartures } from "@/lib/schedule";
import { busPlateForCountry, extraOutboundDays } from "@/lib/busSchedule";
import { runKey } from "@/lib/runSeats";

const HORIZON_WEEKS = 16;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

/**
 * Cache la nivel de modul cu toate ID-urile orașelor moldovenești + Chișinău.
 * Setul nu se schimbă în runtime; îl populăm o singură dată pe instanța de
 * funcție și apoi alias-ul devine sincron, fără round-trip la DB.
 */
let moldovaCachePromise: Promise<{
  ids: Set<string>;
  chisinauId: string | null;
}> | null = null;

function ensureMoldovaCache() {
  if (moldovaCachePromise) return moldovaCachePromise;
  moldovaCachePromise = prisma.city
    .findMany({
      where: { country: { slug: "moldova" } },
      select: { id: true, slug: true },
    })
    .then((cities) => ({
      ids: new Set(cities.map((c) => c.id)),
      chisinauId: cities.find((c) => c.slug === "chisinau")?.id ?? null,
    }))
    .catch((err) => {
      moldovaCachePromise = null;
      throw err;
    });
  return moldovaCachePromise;
}

/**
 * Toate cursele pleacă/sosesc la Chișinău. Dacă userul caută cu un alt oraș
 * moldovenesc ca origine sau destinație, alias-ăm la Chișinău.
 */
async function aliasBothToChisinau(originId: string, destId: string) {
  const { ids, chisinauId } = await ensureMoldovaCache();
  const alias = (id: string) =>
    ids.has(id) && chisinauId ? chisinauId : id;
  return { originCityId: alias(originId), destCityId: alias(destId) };
}

/**
 * Asigură că există Trip-uri în DB pentru fiecare ocurență din schedule
 * (până la HORIZON_WEEKS săptămâni înainte). Creează doar ce lipsește — pe cele
 * existente nu le atinge (poate au rezervări la ora veche după ce admin a
 * schimbat schedule-ul; ele rămân valide până la curățarea declanșată în PATCH).
 *
 * Schedule-ul Country e SURSA DE ADEVĂR — pagina publică afișează ce e în
 * schedule, nu ce-i pregenerat. Trip-urile vechi cu ora schimbată dispar din
 * picker (deși rămân în DB pentru bookings deja existente).
 */
async function ensureTripsForSchedule(params: {
  routeId: string;
  weekday: number;
  time: string;
  durationHours: number;
  from: Date;
  plate?: string;
}): Promise<void> {
  const { routeId, weekday, time, durationHours, from, plate } = params;

  // Calculăm primele HORIZON_WEEKS ocurențe ale (weekday + time) după `from`.
  const expected = nextDepartures(weekday, time, HORIZON_WEEKS, from);
  if (expected.length === 0) return;

  // Vedem care există deja la timestamp-urile exacte calculate.
  const existing = await prisma.trip.findMany({
    where: {
      routeId,
      departureAt: { in: expected },
    },
    select: { departureAt: true },
  });
  const existingTimes = new Set(existing.map((t) => t.departureAt.getTime()));
  const missing = expected.filter((d) => !existingTimes.has(d.getTime()));
  if (missing.length === 0) return;

  // Autocarul cursei = cel din REGULA recurentă (după țară), ca cursele create
  // lazy să aibă autobuzul corect din start. Fallback pe primul activ.
  const bus =
    (plate
      ? await prisma.bus.findFirst({ where: { plate, active: true }, select: { id: true, totalSeats: true } })
      : null) ??
    (await prisma.bus.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" }, select: { id: true, totalSeats: true } }));
  if (!bus) return; // fără autocar configurat, nu putem oferi rezervări

  // createMany nu suportă skipDuplicates fără unique constraint, dar `missing`
  // e deja filtrat — duplicări concurrent sunt rare și ar fi acoperite de
  // următorul fetch (idempotent).
  await prisma.trip
    .createMany({
      data: missing.map((dep) => ({
        routeId,
        busId: bus.id,
        departureAt: dep,
        arrivalAt: arrivalFor(dep, durationHours),
        capacity: bus.totalSeats,
        status: "scheduled",
      })),
    })
    .catch((err) => {
      // Race condition (alt request a creat în paralel) — ignorăm, la următorul
      // fetch tot e în ordine.
      console.warn("ensureTripsForSchedule createMany:", err?.message ?? err);
    });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const rawOriginCityId = searchParams.get("originCityId");
    const rawDestCityId = searchParams.get("destCityId");
    const date = searchParams.get("date");
    const fromParam = searchParams.get("from");
    const limitParam = searchParams.get("limit");

    if (!rawOriginCityId || !rawDestCityId) {
      return NextResponse.json(
        { success: false, error: "originCityId, destCityId required" },
        { status: 400 }
      );
    }

    let dateRange: { gte: Date; lt?: Date };
    if (date) {
      const parts = date.split("-").map(Number);
      if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
        return NextResponse.json(
          { success: false, error: "date must be YYYY-MM-DD" },
          { status: 400 }
        );
      }
      const [y, mo, d] = parts;
      dateRange = {
        gte: new Date(y, mo - 1, d, 0, 0, 0, 0),
        lt: new Date(y, mo - 1, d + 1, 0, 0, 0, 0),
      };
    } else {
      const fromDate = fromParam ? new Date(fromParam) : new Date();
      if (Number.isNaN(fromDate.getTime())) {
        return NextResponse.json(
          { success: false, error: "from must be a valid date" },
          { status: 400 }
        );
      }
      dateRange = { gte: fromDate };
    }

    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(limitParam) || DEFAULT_LIMIT)
    );

    const { originCityId, destCityId } = await aliasBothToChisinau(
      rawOriginCityId,
      rawDestCityId
    );

    // Includem ambele orașe + țările lor ca să decidem direcția (outbound vs return)
    // și să citim schedule-ul Country relevant.
    const route = await prisma.route.findUnique({
      where: {
        originCityId_destinationCityId: {
          originCityId,
          destinationCityId: destCityId,
        },
      },
      include: {
        originCity: { include: { country: true } },
        destinationCity: { include: { country: true } },
      },
    });

    if (!route || !route.active) {
      return NextResponse.json({ success: true, route: null, trips: [] });
    }

    // Detectăm direcția: dacă origin = Moldova → outbound (folosim destCountry.outbound*);
    // dacă origin = țară străină → return (folosim originCountry.return*).
    const originIsMd = route.originCity.country.slug === "moldova";
    const foreignCountry = originIsMd ? route.destinationCity.country : route.originCity.country;
    const weekday = originIsMd ? foreignCountry.outboundWeekday : foreignCountry.returnWeekday;
    const time = originIsMd ? foreignCountry.outboundTime : foreignCountry.returnTime;
    const duration = originIsMd
      ? foreignCountry.outboundDurationHours
      : foreignCountry.returnDurationHours;

    // Calculăm ocurențele așteptate din schedule-ul Country. Astea sunt ZILELE
    // și ORELE pe care le afișăm în calendar — sursa de adevăr.
    const expectedDates: Date[] =
      !date &&
      weekday !== null &&
      weekday !== undefined &&
      time &&
      duration &&
      duration > 0
        ? nextDepartures(weekday, time, HORIZON_WEEKS, dateRange.gte)
        : [];

    if (
      expectedDates.length > 0 &&
      weekday !== null &&
      weekday !== undefined &&
      time &&
      duration
    ) {
      await ensureTripsForSchedule({
        routeId: route.id,
        weekday,
        time,
        durationHours: duration,
        from: dateRange.gte,
        plate: busPlateForCountry(foreignCountry.name) ?? undefined,
      });
    }

    // Zile SUPLIMENTARE de plecare (ex. Belgia mai pleacă și joi cu DAW 077, pe
    // lângă vineri cu ZNQ 874). Le materializăm lazy și le includem în rezultat.
    const extraDates: Date[] = [];
    if (originIsMd && !date) {
      for (const ex of extraOutboundDays(foreignCountry.name)) {
        const exDates = nextDepartures(ex.weekday, ex.time, HORIZON_WEEKS, dateRange.gte);
        if (exDates.length === 0) continue;
        extraDates.push(...exDates);
        await ensureTripsForSchedule({
          routeId: route.id,
          weekday: ex.weekday,
          time: ex.time,
          durationHours: ex.durationHours,
          from: dateRange.gte,
          plate: ex.plate,
        });
      }
    }

    // Filtrul findMany: dacă schedule e setat (avem expected dates), returnăm
    // STRICT trip-urile care match acele ore exacte. Astfel trip-urile vechi
    // de la o oră schimbată în admin (care încă au rezervări → nu pot fi
    // șterse) NU mai apar în calendar pentru clienții noi. Vechii pasageri
    // accesează biletul lor via numărul de rezervare.
    //
    // Dacă schedule nu e setat (caz edge), fallback la range pentru a nu rupe
    // căutările pe dată specifică.
    const trips = await prisma.trip.findMany({
      where: {
        routeId: route.id,
        status: { in: ["scheduled", "boarding"] },
        ...(expectedDates.length > 0 || extraDates.length > 0
          ? { departureAt: { in: [...expectedDates, ...extraDates] } }
          : { departureAt: dateRange }),
      },
      orderBy: { departureAt: "asc" },
      take: date ? undefined : limit,
      select: {
        id: true,
        departureAt: true,
        arrivalAt: true,
        status: true,
        bus: { select: { id: true, label: true, plate: true, totalSeats: true } },
      },
    });

    // Ocuparea pe RULAREA fizică (toate trip-urile aceluiași autobuz din aceeași
    // zi), nu doar pe trip-ul rutei curente: locul vândut pe Bruxelles→Chișinău
    // ocupă autocarul și pentru Gent→Chișinău. Numărăm locurile DISTINCTE pe
    // (bus, zi) dintr-o singură interogare pentru toate cursele listate.
    const runBooked = new Map<string, Set<number>>();
    if (trips.length > 0) {
      const busIds = [...new Set(trips.map((t) => t.bus.id))];
      const minDep = new Date(Math.min(...trips.map((t) => t.departureAt.getTime())) - 12 * 3600_000);
      const maxDep = new Date(Math.max(...trips.map((t) => t.departureAt.getTime())) + 12 * 3600_000);
      const rows = await prisma.seatBooking.findMany({
        where: { trip: { busId: { in: busIds }, departureAt: { gte: minDep, lte: maxDep } } },
        select: { seatNumber: true, trip: { select: { busId: true, departureAt: true } } },
      });
      for (const r of rows) {
        const k = runKey(r.trip.busId, r.trip.departureAt);
        if (!runBooked.has(k)) runBooked.set(k, new Set());
        runBooked.get(k)!.add(r.seatNumber);
      }
    }

    return NextResponse.json({
      success: true,
      route: {
        id: route.id,
        basePrice: route.basePrice,
        currency: route.currency,
      },
      trips: trips.map((t) => {
        const booked = runBooked.get(runKey(t.bus.id, t.departureAt))?.size ?? 0;
        return {
          id: t.id,
          departureAt: t.departureAt.toISOString(),
          arrivalAt: t.arrivalAt.toISOString(),
          status: t.status,
          busId: t.bus.id,
          busLabel: t.bus.label,
          busPlate: t.bus.plate,
          totalSeats: t.bus.totalSeats,
          bookedSeats: booked,
          availableSeats: t.bus.totalSeats - booked,
          pricePerSeat: route.basePrice,
          currency: route.currency,
        };
      }),
    });
  } catch (error) {
    console.error("public/trips GET", error);
    return NextResponse.json(
      { success: false, error: "Failed to load trips" },
      { status: 500 }
    );
  }
}
