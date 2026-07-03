/**
 * Trimite manifeste pe email către admin cu ~24h înainte. Apelat din cron-ul
 * zilnic (/api/cron/send-reminders).
 *
 * Agregare PER ȚARĂ (nu per cursă): pentru fiecare țară străină deservită,
 * dacă mâine există curse care o ating (DUS spre țară sau RETUR din țară),
 * trimitem UN singur email cu toate cursele și pasagerii lor. Cursele goale
 * sunt omise. Țările fără pasageri tomorrow nu generează email deloc.
 *
 * Vechea logică (un email per cursă) producea ~40 de email-uri/zi, majoritate
 * cu 0 pasageri — confuz și greu de scanat operațional.
 *
 * Idempotență: log în EmailLog cu template=admin-country-manifest +
 * relatedId=`{country-slug}-{yyyy-mm-dd}`.
 */
import { prisma } from "@/lib/prisma";
import { getResend } from "@/lib/email";
import {
  adminCountryManifestHtml,
  adminTripManifestHtml,
  type CountryManifestData,
  type TripManifestData,
  type TripManifestPassenger,
} from "@/lib/emailTemplates";
import { resolveScheduledTimes } from "@/lib/scheduledTime";
import { tomorrowWindowMD, localTimeStringMD } from "@/lib/schedule";
import { appUrl as resolveAppUrl } from "@/lib/appUrl";

const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "adrian@radx.solutions";
const TEMPLATE_KEY = "admin-country-manifest";

export type ManifestRunResult = {
  countries: number;
  trips: number;
  sent: number;
  alreadySent: number;
  skippedEmpty: number;
  failed: number;
};

type TripWithIncludes = Awaited<ReturnType<typeof prisma.trip.findFirst>> & {
  route: {
    originCity: { name: string; country: { name: string } };
    destinationCity: { name: string; country: { name: string } };
  };
  bus: { label: string; plate: string };
};

export async function processAdminTripManifests(now: Date = new Date()): Promise<ManifestRunResult> {
  const result: ManifestRunResult = {
    countries: 0,
    trips: 0,
    sent: 0,
    alreadySent: 0,
    skippedEmpty: 0,
    failed: 0,
  };

  const { start, end } = tomorrowWindowMD(now);
  const trips = (await prisma.trip.findMany({
    where: {
      departureAt: { gte: start, lt: end },
      status: { in: ["scheduled", "boarding"] },
    },
    include: {
      route: {
        include: {
          originCity: { include: { country: true } },
          destinationCity: { include: { country: true } },
        },
      },
      bus: true,
    },
    orderBy: { departureAt: "asc" },
  })) as TripWithIncludes[];

  result.trips = trips.length;

  // Group: țara "străină" e cea care nu e Moldova. Pentru o cursă MD → X,
  // țara = X. Pentru X → MD, țara = X. Pentru rare cazuri X → Y unde nimic
  // nu e Moldova (rezervări manuale), țara = destinația.
  const byCountry = new Map<string, TripWithIncludes[]>();
  for (const t of trips) {
    const oc = t.route.originCity.country.name;
    const dc = t.route.destinationCity.country.name;
    const foreign = oc === "Moldova" ? dc : oc !== "Moldova" ? oc : dc;
    if (!byCountry.has(foreign)) byCountry.set(foreign, []);
    byCountry.get(foreign)!.push(t);
  }

  result.countries = byCountry.size;
  const dateKey = formatDateMD(start);

  for (const [countryName, countryTrips] of byCountry.entries()) {
    const relatedId = `${slug(countryName)}-${dateKey}`;
    const alreadyLogged = await prisma.emailLog.findFirst({
      where: { template: TEMPLATE_KEY, relatedId, status: "sent" },
      select: { id: true },
    });
    if (alreadyLogged) {
      result.alreadySent++;
      continue;
    }

    // Construim datele pentru fiecare cursă, păstrând doar cele cu pasageri.
    const tripData: TripManifestData[] = [];
    for (const trip of countryTrips) {
      const data = await buildTripManifest(trip);
      if (data.passengers.length > 0) tripData.push(data);
    }

    if (tripData.length === 0) {
      result.skippedEmpty++;
      continue;
    }

    try {
      await sendCountryManifest(countryName, start, tripData, relatedId);
      result.sent++;
    } catch (e) {
      console.error(`admin-country-manifest country=${countryName}:`, e);
      result.failed++;
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      await prisma.emailLog.create({
        data: {
          to: ADMIN_EMAIL,
          subject: `DAVO admin manifest (eroare) — ${countryName}`,
          template: TEMPLATE_KEY,
          status: "failed",
          relatedId,
          error: msg,
        },
      });
    }
  }

  return result;
}

// Trigger manual din butonul "Manifest" în /admin/trips. Trimite email-ul
// per țară pentru țara cursei selectate la data ei. Cu `force` ignoră
// idempotența și omite verificarea de pasageri zero.
export async function sendManifestForTrip(
  tripId: string,
  opts: { force?: boolean } = {}
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const trip = (await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      route: {
        include: {
          originCity: { include: { country: true } },
          destinationCity: { include: { country: true } },
        },
      },
      bus: true,
    },
  })) as TripWithIncludes | null;
  if (!trip) return { ok: false, reason: "Trip not found" };

  const oc = trip.route.originCity.country.name;
  const dc = trip.route.destinationCity.country.name;
  const countryName = oc === "Moldova" ? dc : oc !== "Moldova" ? oc : dc;

  // Toate cursele aceleiași țări din aceeași zi (MD calendar)
  const dayBounds = sameDayBoundsMD(trip.departureAt);
  const allTrips = (await prisma.trip.findMany({
    where: {
      departureAt: { gte: dayBounds.start, lt: dayBounds.end },
      status: { in: ["scheduled", "boarding"] },
      OR: [
        { route: { originCity: { country: { name: countryName } } } },
        { route: { destinationCity: { country: { name: countryName } } } },
      ],
    },
    include: {
      route: {
        include: {
          originCity: { include: { country: true } },
          destinationCity: { include: { country: true } },
        },
      },
      bus: true,
    },
    orderBy: { departureAt: "asc" },
  })) as TripWithIncludes[];

  const relatedId = `${slug(countryName)}-${formatDateMD(dayBounds.start)}`;

  if (!opts.force) {
    const alreadyLogged = await prisma.emailLog.findFirst({
      where: { template: TEMPLATE_KEY, relatedId, status: "sent" },
      select: { id: true },
    });
    if (alreadyLogged) return { ok: false, reason: "Manifest deja trimis pentru această țară în această zi (OK la dialog = forțează retrimitere)." };
  }

  const tripData: TripManifestData[] = [];
  for (const t of allTrips) {
    const data = await buildTripManifest(t);
    if (data.passengers.length > 0) tripData.push(data);
  }

  if (tripData.length === 0 && !opts.force) {
    return { ok: false, reason: "Nicio rezervare pe nicio cursă pentru această țară/zi — nu trimit email." };
  }

  await sendCountryManifest(countryName, dayBounds.start, tripData, relatedId);
  return { ok: true };
}

// Datele pentru modalul "vezi pasageri" din /admin/trips — păstrate per-cursă
// pentru că UI-ul afișează cursa individuală pe care a apăsat admin-ul.
export async function getTripManifestData(tripId: string): Promise<TripManifestData | null> {
  const trip = (await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      route: {
        include: {
          originCity: { include: { country: true } },
          destinationCity: { include: { country: true } },
        },
      },
      bus: true,
    },
  })) as TripWithIncludes | null;
  if (!trip) return null;
  return buildTripManifest(trip);
}

/* ---------- internal helpers ---------- */

async function buildTripManifest(trip: TripWithIncludes): Promise<TripManifestData> {
  const origin = trip.route.originCity.name;
  const originCountry = trip.route.originCity.country.name;
  const destination = trip.route.destinationCity.name;
  const destinationCountry = trip.route.destinationCity.country.name;

  // Ora locală a plecării: încercăm întâi schedule-ul țării (sursa pe care
  // admin-ul o setează în /admin/countries — vrem să arătăm "07:00" / "19:00"
  // exact așa cum a tastat). Dacă rezolvarea eșuează cădem pe ora locală MD.
  let localTime: string;
  try {
    const scheduled = await resolveScheduledTimes({
      departureCity: `${origin}, ${originCountry}`,
      arrivalCity: `${destination}, ${destinationCountry}`,
      returnDate: null,
    });
    localTime = scheduled.departureTime ?? localTimeStringMD(trip.departureAt);
  } catch {
    localTime = localTimeStringMD(trip.departureAt);
  }

  const bookings = await prisma.booking.findMany({
    where: {
      OR: [{ tripId: trip.id }, { returnTripId: trip.id }],
      status: { in: ["confirmed", "pending"] },
    },
    include: { seatBookings: { select: { tripId: true, seatNumber: true } } },
    orderBy: { createdAt: "asc" },
  });

  const passengers: TripManifestPassenger[] = bookings.map((b) => {
    const isParcel = b.type === "parcel" || b.type === "colet_la_cheie";
    const paxCount = isParcel ? 0 : Math.max(1, b.adults + b.children);
    const passengerNames = isParcel
      ? `${b.firstName} ${b.lastName} (colet)`
      : `${b.firstName} ${b.lastName}`;
    const seats = b.seatBookings
      .filter((s) => s.tripId === trip.id)
      .map((s) => s.seatNumber)
      .sort((a, c) => a - c);
    return {
      bookingNumber: b.bookingNumber,
      isParcel,
      passengerNames,
      phone: b.phone,
      email: b.email,
      arrivalCity: b.arrivalCity,
      seats,
      paxCount,
      price: b.price,
      currency: b.currency,
      payMethod: b.payMethod,
      parcelDetails: b.parcelDetails,
    };
  });

  const dateStr = formatDateMD(trip.departureAt);
  const adminUrl = `${resolveAppUrl().replace(/\/$/, "")}/admin/bookings?date=${encodeURIComponent(dateStr)}`;

  return {
    origin,
    originCountry,
    destination,
    destinationCountry,
    departureDate: trip.departureAt,
    localTime,
    busLabel: `${trip.bus.label} · ${trip.bus.plate}`,
    totalSeats: trip.capacity,
    passengers,
    adminUrl,
  };
}

async function sendCountryManifest(
  countryName: string,
  dateAnchor: Date,
  trips: TripManifestData[],
  relatedId: string
) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const dateLabel = new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Chisinau",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dateAnchor);
  const dateKey = formatDateMD(dateAnchor);
  const adminUrl = `${resolveAppUrl().replace(/\/$/, "")}/admin/trips?date=${encodeURIComponent(dateKey)}`;

  const data: CountryManifestData = {
    countryName,
    dateLabel,
    trips,
    adminUrl,
  };

  const totalPax = trips.reduce(
    (s, t) => s + t.passengers.reduce((s2, p) => s2 + p.paxCount, 0),
    0
  );
  const subject = `🚌 Mâine pe ${countryName} · ${totalPax} pasageri / ${trips.length} curse`;
  const html = adminCountryManifestHtml(data);

  const { error } = await getResend().emails.send({
    from: process.env.EMAIL_FROM || "DAVO Group <info@davo.md>",
    to: ADMIN_EMAIL,
    subject,
    html,
  });
  if (error) throw new Error(error.message || "Resend returned error");

  await prisma.emailLog.create({
    data: {
      to: ADMIN_EMAIL,
      subject,
      template: TEMPLATE_KEY,
      status: "sent",
      relatedId,
    },
  });
}

function formatDateMD(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Chisinau",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Bounds-urile UTC ale aceleiași zile (MD calendar) ca un Date dat.
// Reutilizăm `tomorrowWindowMD`: dacă îi dăm "ieri" ca input, returnează
// fereastra "azi" — adică tocmai ziua MD a Date-ului primit.
function sameDayBoundsMD(d: Date): { start: Date; end: Date } {
  const dayBefore = new Date(d.getTime() - 24 * 3600 * 1000);
  return tomorrowWindowMD(dayBefore);
}

// Keep `adminTripManifestHtml` reference alive — folosit de modalul din UI
// indirect prin getTripManifestData; aici e exportat pentru log/debug.
void adminTripManifestHtml;
