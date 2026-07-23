// Gruparea rezervărilor active pe CURSE FIZICE (un autobuz — real din Trip.bus
// sau atribuit manual — într-o zi). Folosită de /api/operator/trips (dashboard)
// și de /api/operator/manifest (export Excel/PDF), ca să fie o singură sursă.
import { prisma } from "@/lib/prisma";
import { busPlateForRun, scheduledRunsForDate } from "@/lib/busSchedule";

export const BOOKING_SELECT = {
  id: true,
  bookingNumber: true,
  type: true,
  status: true,
  tripType: true,
  departureCity: true,
  arrivalCity: true,
  departureDate: true,
  returnDate: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  adults: true,
  children: true,
  price: true,
  currency: true,
  paymentStatus: true,
  payMethod: true,
  passengerResponse: true,
  parcelDetails: true,
  source: true,
  createdByName: true,
  createdAt: true,
  archivedAt: true,
  tripId: true,
  returnTripId: true,
  manualBusId: true,
  notes: true,
  boardedAt: true,
  boardedBy: true,
  baggageSurplus: true,
  seatBookings: { select: { seatNumber: true, tripId: true }, orderBy: { seatNumber: "asc" as const } },
} as const;

export type BookingRow = Awaited<ReturnType<typeof loadBookings>>[number];

export type TripGroupData = {
  kind: "trip" | "loose" | "empty";
  key: string;
  busId: string | null;
  busLabel: string | null;
  busPlate: string | null;
  from: string;
  to: string;
  departureAt: string;
  arrivalAt: string | null;
  capacity: number | null;
  seatsTaken: number;
  circuitOcc?: { taken: number; capacity: number } | null;
  // Rezervările + cursele FRAȚILOR din circuitul fizic (DAW 077 duminică↔luni,
  // același autocar). Harta le arată ocupate ca operatorul să nu suprarezerveze
  // pe cealaltă zi un loc deja luat.
  circuitTripIds?: string[];
  circuitBookings?: BookingRow[];
  dayKey: string;
  multi: boolean;
  add: { tripId?: string; from?: string; to?: string; date?: string; countries?: string[] };
  tripIds: string[];
  bookings: BookingRow[];
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function weekdayOfKey(dk: string): number {
  const [y, m, d] = dk.split("-").map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=duminică, 1=luni
}
function prevDayKey(dk: string): string {
  const [y, m, d] = dk.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return dayKey(dt);
}
function isMD(country?: string | null): boolean {
  return /moldova/i.test(country ?? "");
}
function countryOf(cityStr: string): string {
  const parts = cityStr.split(",");
  return parts.length > 1 ? parts[parts.length - 1].trim() : "";
}
function withCountry(city: string, country?: string | null): string {
  return country ? `${city}, ${country}` : city;
}
function joinCities(set: Set<string>, max = 2): string {
  const arr = [...set];
  if (arr.length <= max) return arr.join(", ");
  return `${arr.slice(0, max).join(", ")} +${arr.length - max}`;
}
// Afișare pe ȚARĂ (o cursă cuprinde toate orașele unei țări, plus mai multe
// țări). Moldova → „Chișinău" (hubul). Deduplicat.
function joinCountries(set: Set<string>, max = 3): string {
  const arr = [...new Set([...set].map((c) => (isMD(c) ? "Chișinău" : c)))].filter(Boolean).sort((a, b) => a.localeCompare(b, "ro"));
  if (arr.length <= max) return arr.join(", ");
  return `${arr.slice(0, max).join(", ")} +${arr.length - max}`;
}
function paxOf(b: BookingRow): number {
  if (b.type === "parcel") return 1;
  return Math.max(1, (b.adults ?? 0) + (b.children ?? 0));
}

// cutoff = acum − 24h: rezervarea rămâne vizibilă încă 24h DUPĂ ora plecării
// (sau a returului), ca operatorul să aibă timp după ce cursa a pornit — abia apoi
// dispare din panou. Pentru tur-retur contează returul (ultima etapă).
function loadBookings(cutoff: Date) {
  return prisma.booking.findMany({
    where: {
      archivedAt: null,
      OR: [
        { returnDate: { gte: cutoff } },
        { returnDate: null, departureDate: { gte: cutoff } },
      ],
    },
    select: BOOKING_SELECT,
    orderBy: { departureDate: "asc" },
    take: 2000,
  });
}

type JourneyBus = { id: string; label: string; plate: string | null; totalSeats: number | null };

type Group = TripGroupData & {
  _origins: Set<string>;
  _dests: Set<string>;
  _originsFull: Set<string>;
  _destsFull: Set<string>;
  _originCountries: Set<string>;
  _destCountries: Set<string>;
  // Doar țări REALE (fără fallback pe numele orașului) — pentru detecția
  // direcției la prefill-ul „+ Rezervare pe cursă".
  _originCountriesStrict: Set<string>;
  _destCountriesStrict: Set<string>;
  // Câte rezervări pe fiecare sens — direcția cardului = sensul DOMINANT. Astfel o
  // rezervare băgată greșit pe sens invers (ex. un retur pe o zi de dus) nu mai
  // inversează/poluează textul rutei.
  _dirOut: number;
  _dirIn: number;
  _memberTrips: Set<string>;
};

export async function buildTripGroups(): Promise<{ groups: TripGroupData[]; calendar: Record<string, number>; scheduledDays: string[] }> {
  const now = new Date();
  const bookings = await loadBookings(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  const tripIds = [
    ...new Set(bookings.flatMap((b) => [b.tripId, b.returnTripId]).filter((x): x is string => !!x)),
  ];
  const trips = tripIds.length
    ? await prisma.trip.findMany({
        where: { id: { in: tripIds } },
        select: {
          id: true,
          departureAt: true,
          arrivalAt: true,
          capacity: true,
          bus: { select: { id: true, label: true, plate: true, totalSeats: true } },
          route: {
            select: {
              originCity: { select: { name: true, country: { select: { name: true } } } },
              destinationCity: { select: { name: true, country: { select: { name: true } } } },
            },
          },
        },
      })
    : [];
  const tripMap = new Map(trips.map((t) => [t.id, t]));

  const manualBusIds = [...new Set(bookings.map((b) => b.manualBusId).filter((x): x is string => !!x))];
  const manualBuses = manualBusIds.length
    ? await prisma.bus.findMany({ where: { id: { in: manualBusIds } }, select: { id: true, label: true, plate: true, totalSeats: true } })
    : [];
  const busMap = new Map(manualBuses.map((b) => [b.id, b]));

  // REGULĂ RECURENTĂ (nu materializăm mii de curse): autobuzele active + programul
  // pe țări. Din ele construim calendarul VIRTUAL pe tot anul și legăm rezervările
  // loose de autobuzul corect. Cursele reale se creează lazy la rezervare.
  const allBuses = await prisma.bus.findMany({ where: { active: true }, select: { id: true, label: true, plate: true, totalSeats: true } });
  const busByPlate = new Map(allBuses.map((b) => [b.plate, b]));
  const countrySchedule = await prisma.country.findMany({
    select: { name: true, outboundWeekday: true, outboundTime: true, returnWeekday: true, returnTime: true },
  });

  // CURSE REALE viitoare (scheduled/boarding) = SURSA DE ADEVĂR pentru autocar,
  // exact ce setează adminul prin Trip.busId. Panoul le citește pe ELE, nu regula
  // hardcodată din busSchedule. Aceea rămâne DOAR ca fallback pe zilele fără curse
  // materializate (ca să nu rămână calendarul gol în viitorul îndepărtat).
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const futureTrips = await prisma.trip.findMany({
    where: { departureAt: { gte: startOfToday }, status: { in: ["scheduled", "boarding"] } },
    select: {
      departureAt: true,
      bus: { select: { id: true, label: true, plate: true, totalSeats: true } },
      route: {
        select: {
          originCity: { select: { country: { select: { name: true } } } },
          destinationCity: { select: { country: { select: { name: true } } } },
        },
      },
    },
  });
  type RealRun = { bus: JourneyBus; inbound: boolean; countries: Set<string>; departureAt: Date };
  const realRunByDayBus = new Map<string, RealRun>(); // `${dayKey}:${busId}` → run agregat
  const realRunsByDay = new Map<string, RealRun[]>(); // dayKey → run-uri reale
  const realCoveredDayDir = new Set<string>(); // `${dayKey}|${inbound}` — zile+sens acoperite de curse reale
  for (const t of futureTrips) {
    if (!t.bus) continue;
    const oC = t.route?.originCity?.country?.name ?? "";
    const dC = t.route?.destinationCity?.country?.name ?? "";
    const inbound = isMD(dC);
    const dk = dayKey(t.departureAt);
    realCoveredDayDir.add(`${dk}|${inbound}`);
    const rkey = `${dk}:${t.bus.id}`;
    let r = realRunByDayBus.get(rkey);
    if (!r) {
      r = { bus: { id: t.bus.id, label: t.bus.label, plate: t.bus.plate ?? null, totalSeats: t.bus.totalSeats ?? null }, inbound, countries: new Set(), departureAt: t.departureAt };
      realRunByDayBus.set(rkey, r);
      const arr = realRunsByDay.get(dk) ?? [];
      arr.push(r);
      realRunsByDay.set(dk, arr);
    }
    const eu = inbound ? oC : dC;
    if (eu && !isMD(eu)) r.countries.add(eu);
    if (t.departureAt < r.departureAt) r.departureAt = t.departureAt;
  }

  const groups = new Map<string, Group>();

  const placeLeg = (b: BookingRow, legKind: "dep" | "ret") => {
    const legTripId = legKind === "dep" ? b.tripId : b.returnTripId;
    const trip = legTripId ? tripMap.get(legTripId) ?? null : null;
    if (legKind === "ret" && !trip) return;

    let bus: JourneyBus | null = null;
    // manualBusId = override EXPLICIT al operatorului (mutarea unei rute) → învinge
    // autocarul cursei reale, pe AMBELE legi, ca „vineri X → duminică X" să rămână
    // adevărat inclusiv pentru rezervările de pe cursă reală. Nu atinge tripId /
    // seatBookings (locurile rămân corecte). Fără manualBusId → autocarul cursei.
    if (b.manualBusId && busMap.has(b.manualBusId)) {
      const mb = busMap.get(b.manualBusId)!;
      bus = { id: mb.id, label: mb.label, plate: mb.plate ?? null, totalSeats: mb.totalSeats ?? null };
    } else if (trip?.bus) {
      bus = { id: trip.bus.id, label: trip.bus.label, plate: trip.bus.plate ?? null, totalSeats: trip.bus.totalSeats ?? null };
    }

    const oName = trip?.route?.originCity?.name ?? b.departureCity;
    const dName = trip?.route?.destinationCity?.name ?? b.arrivalCity;
    const oCountry = trip?.route?.originCity?.country?.name ?? countryOf(b.departureCity);
    const dCountry = trip?.route?.destinationCity?.country?.name ?? countryOf(b.arrivalCity);
    const direction = isMD(dCountry) ? "in" : isMD(oCountry) ? "out" : "x";

    const dk = trip ? dayKey(trip.departureAt) : dayKey(b.departureDate);

    // Rezervare loose (fără cursă în DB): leag-o de cursa fizică a zilei. Întâi
    // din CURSELE REALE (ce setează adminul) — potrivim sensul + țara EU. Doar
    // dacă ziua+sensul n-are curse reale cădem pe regula recurentă (fallback).
    if (!bus && direction !== "x") {
      const legDate = trip ? trip.departureAt : b.departureDate;
      const dkLeg = dayKey(legDate);
      const euCountry = direction === "in" ? oCountry : dCountry;
      const sameDir = (realRunsByDay.get(dkLeg) ?? []).filter((r) => r.inbound === (direction === "in"));
      let picked = euCountry ? sameDir.find((r) => r.countries.has(euCountry)) : undefined;
      if (!picked && sameDir.length === 1) picked = sameDir[0]; // o singură cursă pe sensul ăla → fără ambiguitate
      // Țara n-are cursă proprie în ziua aia (ex. Luxemburg duminica), dar regula
      // recurentă o mapează pe un autocar care CHIAR pleacă atunci (DAW 077) →
      // alătur-o acelui run real, ca să apară pe foaia autocarului corect.
      if (!picked && sameDir.length > 1) {
        const plate = busPlateForRun(legDate, oCountry, dCountry);
        if (plate) picked = sameDir.find((r) => r.bus.plate === plate);
      }
      if (picked) bus = picked.bus;
      else if (!realCoveredDayDir.has(`${dkLeg}|${direction === "in"}`)) {
        const plate = busPlateForRun(legDate, oCountry, dCountry);
        const rb = plate ? busByPlate.get(plate) : undefined;
        if (rb) bus = { id: rb.id, label: rb.label, plate: rb.plate ?? null, totalSeats: rb.totalSeats ?? null };
      }
    }

    const departureIso = trip ? trip.departureAt.toISOString() : b.departureDate.toISOString();
    const key = bus ? `${dk}:bus:${bus.id}` : `${dk}:none:${direction}`;

    let g = groups.get(key);
    if (!g) {
      g = {
        kind: bus ? "trip" : "loose",
        key,
        busId: bus?.id ?? null,
        busLabel: bus?.label ?? null,
        busPlate: bus?.plate ?? null,
        from: oName,
        to: dName,
        departureAt: departureIso,
        arrivalAt: trip?.arrivalAt ? trip.arrivalAt.toISOString() : null,
        capacity: bus?.totalSeats ?? trip?.capacity ?? null,
        seatsTaken: 0,
        dayKey: dk,
        multi: false,
        add: {},
        tripIds: [],
        bookings: [],
        _origins: new Set(),
        _dests: new Set(),
        _originsFull: new Set(),
        _destsFull: new Set(),
        _originCountries: new Set(),
        _destCountries: new Set(),
        _originCountriesStrict: new Set(),
        _destCountriesStrict: new Set(),
        _dirOut: 0,
        _dirIn: 0,
        _memberTrips: new Set(),
      };
      groups.set(key, g);
    }

    g._origins.add(oName);
    g._dests.add(dName);
    g._originsFull.add(withCountry(oName, oCountry));
    g._destsFull.add(withCountry(dName, dCountry));
    g._originCountries.add(oCountry || oName);
    g._destCountries.add(dCountry || dName);
    // Seturi STRICTE: doar țări cunoscute cu adevărat. Fallback-ul pe numele
    // orașului („56593 Horhausen", „Cahul") ar otrăvi detecția direcției pentru
    // prefill-ul „+ Rezervare pe cursă" — o adresă liberă nu e o țară.
    if (oCountry) g._originCountriesStrict.add(oCountry);
    if (dCountry) g._destCountriesStrict.add(dCountry);
    if (direction === "out") g._dirOut++;
    else if (direction === "in") g._dirIn++;
    if (trip) g._memberTrips.add(trip.id);
    if (departureIso < g.departureAt) g.departureAt = departureIso;
    if (!g.capacity && (bus?.totalSeats || trip?.capacity)) g.capacity = bus?.totalSeats ?? trip?.capacity ?? null;
    g.bookings.push(b);
  };

  for (const b of bookings) {
    placeLeg(b, "dep");
    placeLeg(b, "ret");
  }

  const list = [...groups.values()]
    .sort((a, b) => a.departureAt.localeCompare(b.departureAt))
    .map((g) => {
      const origins = [...g._origins];
      const dests = [...g._dests];
      g.from = joinCountries(g._originCountries);
      g.to = joinCountries(g._destCountries);
      g.multi = origins.length > 1 || dests.length > 1;
      g.tripIds = [...g._memberTrips];

      g.seatsTaken = g.bookings.reduce((sum, b) => {
        if (b.status === "cancelled") return sum;
        const seats = (b.seatBookings || []).filter((s) => g._memberTrips.has(s.tripId)).length;
        return sum + (seats > 0 ? seats : paxOf(b));
      }, 0);

      const memberTripIds = g.tripIds;
      // Prefill complet pentru „+ Rezervare pe cursă": direcția, DATA și ȚĂRILE
      // cursei. Fără astea, o cursă retur multi-oraș (Belgia,Germania → Chișinău)
      // trimitea doar to=Chișinău → formularul pornea greșit Moldova→gol, cu
      // direcția inversată și orice țară selectabilă (inclusiv unde autocarul
      // acestei curse nu merge niciodată).
      // Direcția din seturile STRICTE (doar țări reale) — o rezervare cu adresă
      // liberă („56593 Horhausen") nu mai strică detecția inbound/outbound.
      const originCountriesArr = [...g._originCountriesStrict];
      const destCountriesArr = [...g._destCountriesStrict];
      // Sensul cardului = sensul DOMINANT al rezervărilor. Astfel o rezervare pe sens
      // greșit (ex. un retur băgat pe o zi de dus) NU mai inversează/poluează textul
      // rutei. Când nu-s rezervări clare pe sens (doar adrese libere) → seturi stricte.
      const hasDir = g._dirOut > 0 || g._dirIn > 0;
      const outboundRun = hasDir
        ? (g._dirOut > 0 && g._dirOut >= g._dirIn)
        : (originCountriesArr.length > 0 && originCountriesArr.every((c) => isMD(c)));
      const inboundRun = hasDir
        ? (g._dirIn > g._dirOut)
        : (destCountriesArr.length > 0 && destCountriesArr.every((c) => isMD(c)));
      // Țările REAL deservite de autobuz în ziua aia (regula recurentă) — nu doar
      // cele din rezervările existente. Altfel, DAW 777 pe 12 iul (Belgia/Olanda/
      // Germania) cu rezervări doar din Belgia+Germania ar bloca Olanda la „+".
      let scheduledEu: string[] = [];
      if (g.busId && (inboundRun || outboundRun)) {
        // Preferă țările din CURSELE REALE ale zilei (ce setează adminul);
        // fallback pe regula recurentă doar dacă ziua n-are curse materializate.
        const rr = realRunByDayBus.get(`${g.dayKey}:${g.busId}`);
        if (rr && rr.countries.size > 0) scheduledEu = [...rr.countries];
        else if (g.busPlate) {
          const run = scheduledRunsForDate(new Date(g.departureAt), countrySchedule).find(
            (r) => r.plate === g.busPlate && r.inbound === inboundRun
          );
          if (run) scheduledEu = [...new Set(run.countries)];
        }
      }
      const bookedEu = (inboundRun ? originCountriesArr : outboundRun ? destCountriesArr : []).filter((c) => !isMD(c));
      const euCountries = [...new Set([...bookedEu, ...scheduledEu])];
      // Afișarea EU pe card = TOATE țările deservite de autocar în ziua aia (curse
      // reale + rezervări), nu doar cele cu pasageri. Așa DAW 077 (dus) arată
      // „Anglia, Belgia, Luxemburg", nu doar unde merg pasagerii actuali.
      if (euCountries.length > 0) {
        const euStr = joinCountries(new Set(euCountries));
        if (inboundRun) { g.from = euStr; g.to = "Chișinău"; }
        else if (outboundRun) { g.from = "Chișinău"; g.to = euStr; }
      }
      g.add = {
        date: dayKey(new Date(g.departureAt)),
        ...(euCountries.length > 0 ? { countries: euCountries } : {}),
        ...(memberTripIds.length === 1 ? { tripId: memberTripIds[0] } : {}),
        // Capătul Moldova e MEREU hub-ul Chișinău — indiferent câte orașe de
        // coborâre/urcare au rezervările existente (Cahul etc. nu-l elimină).
        // Capătul EU: orașul exact dacă e unic, altfel doar țara (dacă e una),
        // altfel gol — operatorul alege dintre țările din `countries`.
        ...(inboundRun
          ? {
              to: "Chișinău, Moldova",
              ...(origins.length === 1
                ? { from: [...g._originsFull][0] }
                : euCountries.length === 1 ? { from: euCountries[0] } : {}),
            }
          : outboundRun
            ? {
                from: "Chișinău, Moldova",
                ...(dests.length === 1
                  ? { to: [...g._destsFull][0] }
                  : euCountries.length === 1 ? { to: euCountries[0] } : {}),
              }
            : {
                // Direcție incertă (niciun trip cu țări reale) — comportamentul vechi.
                ...(origins.length === 1 ? { from: [...g._originsFull][0] } : {}),
                ...(dests.length === 1 ? { to: [...g._destsFull][0] } : {}),
              }),
      };

      const { _origins, _dests, _originsFull, _destsFull, _originCountries, _destCountries, _originCountriesStrict, _destCountriesStrict, _dirOut, _dirIn, _memberTrips, ...pub } = g;
      void _origins; void _dests; void _originsFull; void _destsFull; void _originCountries; void _destCountries; void _originCountriesStrict; void _destCountriesStrict; void _dirOut; void _dirIn; void _memberTrips;
      return pub;
    });

  // Calendarul „cu pasageri" (doar cursele cu rezervări) — înainte de a adăuga goalele.
  const calendar: Record<string, number> = {};
  for (const g of list) calendar[g.dayKey] = (calendar[g.dayKey] ?? 0) + 1;

  // Curse PROGRAMATE GOALE — VIRTUALE, pe TOT ANUL, din regula recurentă (program
  // pe țări + autobuz per țară). NU materializăm nimic: cursa reală se creează
  // lazy când cineva rezervă. Zilele cu rezervări pe același autobuz NU primesc
  // card gol (cheie identică → sar).
  const existingKeys = new Set(list.map((g) => g.key));
  const scheduledDaysSet = new Set<string>();

  // (A) Carduri GOALE din CURSELE REALE (sursa de adevăr — ce setează adminul).
  // Așa 17/19 iul apar pe DAW 777 fără nicio regulă hardcodată, iar orice mutare
  // de autocar din admin se reflectă automat aici.
  for (const [rkey, r] of realRunByDayBus) {
    const dk = rkey.slice(0, rkey.indexOf(":"));
    scheduledDaysSet.add(dk);
    const key = `${dk}:bus:${r.bus.id}`;
    if (existingKeys.has(key)) continue; // ziua are deja rezervări pe acest autobuz
    existingKeys.add(key);
    const countriesArr = [...r.countries].sort((a, b) => a.localeCompare(b, "ro"));
    const countriesStr = countriesArr.join(", ");
    list.push({
      kind: "empty",
      key,
      busId: r.bus.id,
      busLabel: r.bus.label,
      busPlate: r.bus.plate ?? null,
      from: r.inbound ? countriesStr : "Chișinău",
      to: r.inbound ? "Chișinău" : countriesStr,
      departureAt: r.departureAt.toISOString(),
      arrivalAt: null,
      capacity: r.bus.totalSeats ?? null,
      seatsTaken: 0,
      dayKey: dk,
      multi: false,
      add: {
        date: dk,
        ...(countriesArr.length > 0 ? { countries: countriesArr } : {}),
        ...(r.inbound
          ? { to: "Chișinău, Moldova", ...(countriesArr.length === 1 ? { from: countriesArr[0] } : {}) }
          : { from: "Chișinău, Moldova", ...(countriesArr.length === 1 ? { to: countriesArr[0] } : {}) }),
      },
      tripIds: [],
      bookings: [],
    });
  }

  // (B) Fallback VIRTUAL (regula recurentă) DOAR pe zile+sens FĂRĂ curse reale —
  // ca să nu rămână calendarul gol în viitorul nematerializat.
  const YEAR_DAYS = 366;
  for (let i = 0; i < YEAR_DAYS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const runs = scheduledRunsForDate(d, countrySchedule);
    if (runs.length === 0) continue;
    const dk = dayKey(d);
    for (const run of runs) {
      if (realCoveredDayDir.has(`${dk}|${run.inbound}`)) continue; // ziua+sens au curse reale → nu inventa
      const bus = busByPlate.get(run.plate);
      if (!bus) continue;
      scheduledDaysSet.add(dk);
      const key = `${dk}:bus:${bus.id}`;
      if (existingKeys.has(key)) continue; // ziua are deja rezervări pe acest autobuz
      existingKeys.add(key);
      const countriesStr = [...new Set(run.countries)].sort((a, b) => a.localeCompare(b, "ro")).join(", ");
      const [hh, mm] = (run.time || "12:00").split(":").map((n) => Number(n) || 0);
      const iso = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm).toISOString();
      list.push({
        kind: "empty",
        key,
        busId: bus.id,
        busLabel: bus.label,
        busPlate: bus.plate ?? null,
        from: run.inbound ? countriesStr : "Chișinău",
        to: run.inbound ? "Chișinău" : countriesStr,
        departureAt: iso,
        arrivalAt: null,
        capacity: bus.totalSeats ?? null,
        seatsTaken: 0,
        dayKey: dk,
        multi: false,
        // Prefill și pe cursele programate goale: direcția + data + țările rulării.
        add: {
          date: dk,
          countries: [...new Set(run.countries)],
          ...(run.inbound
            ? { to: "Chișinău, Moldova", ...(run.countries.length === 1 ? { from: run.countries[0] } : {}) }
            : { from: "Chișinău, Moldova", ...(run.countries.length === 1 ? { to: run.countries[0] } : {}) }),
        },
        tripIds: [],
        bookings: [],
      });
    }
  }

  // Ocupare PARTAJATĂ pe circuitul DAW 077 retur: duminică (Anglia) + luni (Belgia
  // 04:00 / Luxemburg 07:00) = ACELAȘI autocar fizic, 54 locuri. Ambele carduri
  // arată totalul combinat, ca operatorul să nu suprarezerveze. DOAR DAW 077.
  const circuits = new Map<string, TripGroupData[]>();
  for (const g of list) {
    if (g.busPlate !== "DAW 077") continue;
    const wd = weekdayOfKey(g.dayKey);
    let anchor: string | null = null;
    if (wd === 0) anchor = g.dayKey;                    // duminică = ancoră
    else if (wd === 1) anchor = prevDayKey(g.dayKey);   // luni → duminica dinainte
    else continue;                                       // joi (dus) — alt circuit
    const arr = circuits.get(anchor) ?? [];
    arr.push(g);
    circuits.set(anchor, arr);
  }
  for (const gs of circuits.values()) {
    if (gs.length < 2) continue; // un singur card în circuit → nimic de partajat
    const taken = gs.reduce((s, g) => s + g.seatsTaken, 0);
    const capacity = Math.max(0, ...gs.map((g) => g.capacity ?? 0));
    for (const g of gs) {
      g.circuitOcc = { taken, capacity };
      // Locurile ocupate pe celelalte zile ale aceluiași autocar → harta lui le
      // marchează ocupate (același loc fizic e luat pe tot circuitul).
      const siblings = gs.filter((s) => s !== g);
      g.circuitTripIds = siblings.flatMap((s) => s.tripIds);
      g.circuitBookings = siblings.flatMap((s) => s.bookings);
    }
  }

  // DAW 077 ia Belgia (04:00) + Luxemburg (07:00) LUNI dimineața. În DB cursa reală
  // de luni are doar Luxemburg, deci fără asta operatorul nu poate face rezervări
  // Belgia pe luni. Adăugăm ambele țări la cardul de luni (afișare + prefill „+").
  for (const g of list) {
    if (g.busPlate !== "DAW 077" || weekdayOfKey(g.dayKey) !== 1) continue;
    const inbound = /chi[sș]in[aă]u/i.test(g.to) || isMD(countryOf(g.to));
    if (!inbound) continue;
    g.add.countries = [...new Set([...(g.add.countries ?? []), "Belgia", "Luxemburg"])];
    g.from = joinCountries(new Set([...g.add.countries]));
  }

  list.sort((a, b) => a.departureAt.localeCompare(b.departureAt));

  return { groups: list, calendar, scheduledDays: [...scheduledDaysSet] };
}
