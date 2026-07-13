/**
 * Programul săptămânal afișat pe paginile SEO de țară (`/anglia`, `/belgia`,
 * etc.). Mirror-uit după valorile setate în `prisma/seed.ts` și editabile
 * din `/admin/countries`. Sursa de adevăr e DB-ul; aici e copia statică
 * pentru SSR rapid (paginile de țară sunt pre-rendered la build).
 *
 * Dacă admin editează programul în DB, paginile se regenerează la următorul
 * cycle ISR (revalidate=3600 pe paginile de țară). Pentru update imediat,
 * trigger un redeploy.
 */

const WEEKDAY_RO = [
  "Duminică",
  "Luni",
  "Marți",
  "Miercuri",
  "Joi",
  "Vineri",
  "Sâmbătă",
] as const;

export type CountryScheduleRow = {
  outboundLabel: string; // ex: "Joi 10:00"
  outboundDuration: string; // ex: "~36h"
  returnLabel: string; // ex: "Duminică 19:00"
  returnDuration: string;
  fullSentence: string; // pentru meta description
};

// Câmpurile `outboundDuration` / `returnDuration` rămân în schemă pentru
// back-compat cu FAQ-ul SEO, dar valorile sunt goale acum: admin a cerut
// să nu se mai afișeze durate (erau approximări care derutau pasagerii).
// Faq-ul ru/ro detectează stringul gol și sare peste mențiunea de durată.
const SCHEDULES: Record<string, CountryScheduleRow> = {
  anglia: {
    outboundLabel: "Joi 10:00",
    outboundDuration: "",
    returnLabel: "Duminică 19:00",
    returnDuration: "",
    fullSentence:
      "Plecare săptămânală joi la 10:00 din Chișinău (cu opriri în orașele din Moldova pe traseu), retur duminică la 19:00 din Anglia.",
  },
  belgia: {
    outboundLabel: "Vineri 08:30",
    outboundDuration: "",
    returnLabel: "Duminică 12:00",
    returnDuration: "",
    fullSentence:
      "Plecare săptămânală vineri la 08:30 din Chișinău, retur duminică la 12:00 din Belgia.",
  },
  olanda: {
    outboundLabel: "Vineri 08:30",
    outboundDuration: "",
    returnLabel: "Duminică 12:00",
    returnDuration: "",
    fullSentence:
      "Plecare săptămânală vineri la 08:30 din Chișinău, retur duminică la 12:00 din Olanda.",
  },
  germania: {
    outboundLabel: "Vineri 08:30",
    outboundDuration: "",
    returnLabel: "Duminică 12:00",
    returnDuration: "",
    fullSentence:
      "Plecare săptămânală vineri la 08:30 din Chișinău, retur duminică la 12:00 din Germania.",
  },
  luxemburg: {
    outboundLabel: "Joi 10:00",
    outboundDuration: "",
    returnLabel: "Luni 07:00",
    returnDuration: "",
    fullSentence:
      "Plecare săptămânală joi la 10:00 din Chișinău, retur luni la 07:00 dimineața din Luxemburg.",
  },
};

export function getCountrySchedule(slug: string): CountryScheduleRow | null {
  return SCHEDULES[slug] ?? null;
}

/**
 * Schema.org-style numbers pentru BusTrip JSON-LD: weekday code conform
 * `https://schema.org/DayOfWeek` (Sunday..Saturday).
 */
export function weekdayName(weekday: number): string {
  return WEEKDAY_RO[weekday] ?? "—";
}

/**
 * Convertește un label de tipul "Duminică 19:00" în ziua săptămânii numerică
 * (0 = duminică, 1 = luni, ..., 6 = sâmbătă) — folosit ca filtru defensiv în
 * TripPicker, ca să nu apară accidental date din alte zile dacă DB conține
 * curse vechi/de test.
 */
export function weekdayFromLabel(label: string | undefined | null): number | null {
  if (!label) return null;
  const first = label.trim().split(/\s+/)[0].toLowerCase();
  const map: Record<string, number> = {
    "duminică": 0, duminica: 0,
    "luni": 1,
    "marți": 2, marti: 2,
    "miercuri": 3,
    "joi": 4,
    "vineri": 5,
    "sâmbătă": 6, sambata: 6,
  };
  return map[first] ?? null;
}

/**
 * Ziua săptămânii (0..6, dum..sam) pentru cursa dus / retur a unei țări destinație.
 * Se folosește pe FE ca filtru defensiv în TripPicker — backend-ul deja
 * generează curse doar în ziua corectă, dar dacă în DB rămân resturi din date
 * vechi, filtrul îi maschează față de pasager.
 */
export function getOutboundWeekday(slug: string): number | null {
  const sched = SCHEDULES[slug];
  return sched ? weekdayFromLabel(sched.outboundLabel) : null;
}

export function getReturnWeekday(slug: string): number | null {
  const sched = SCHEDULES[slug];
  return sched ? weekdayFromLabel(sched.returnLabel) : null;
}

/**
 * TOATE zilele valide de plecare spre o țară — unele țări pleacă în mai multe
 * zile pe săptămână. Belgia: JOI cu DAW 077 (împreună cu Anglia) ȘI VINERI cu
 * ZNQ 874. Filtrul cu o singură zi ascundea cursele de joi din calendar deși
 * existau în DB.
 */
export function getOutboundWeekdays(slug: string): number[] {
  const base = getOutboundWeekday(slug);
  const days = base == null ? [] : [base];
  if (slug === "belgia") days.push(4); // joi · DAW 077 (extraOutboundDays)
  return [...new Set(days)];
}

export function getReturnWeekdays(slug: string): number[] {
  const d = getReturnWeekday(slug);
  return d == null ? [] : [d];
}

