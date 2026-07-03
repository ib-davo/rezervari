/**
 * Helper-uri pentru programul săptămânal pe țară.
 *
 * Programul e stocat în coloane simple pe `Country` (outboundWeekday/Time/DurationHours
 * + returnWeekday/Time/DurationHours). Toate orele sunt interpretate în zona
 * Europe/Chisinau, astfel încât "joi 10:00" pentru Adrian e mereu 10:00 la Chișinău,
 * indiferent de TZ-ul serverului (Vercel rulează UTC).
 *
 * Funcțiile de aici nu ating Prisma — primesc obiecte deja încărcate.
 */

const TZ = "Europe/Chisinau";

export type CountrySchedule = {
  outboundWeekday: number | null;
  outboundTime: string | null;
  outboundDurationHours: number | null;
  returnWeekday: number | null;
  returnTime: string | null;
  returnDurationHours: number | null;
};

export type Direction = "outbound" | "return";

export function isOutboundActive(c: CountrySchedule): boolean {
  return (
    c.outboundWeekday !== null &&
    c.outboundWeekday !== undefined &&
    !!c.outboundTime &&
    !!c.outboundDurationHours
  );
}

export function isReturnActive(c: CountrySchedule): boolean {
  return (
    c.returnWeekday !== null &&
    c.returnWeekday !== undefined &&
    !!c.returnTime &&
    !!c.returnDurationHours
  );
}

export function isCountryActive(c: CountrySchedule): boolean {
  return isOutboundActive(c) && isReturnActive(c);
}

/**
 * Pentru un weekday + ora "HH:mm" în Europe/Chisinau, calculează data UTC
 * a primei apariții ≥ `from`. Apoi se pot adăuga 7*N zile pt următoarele.
 */
function nextOccurrence(weekday: number, hhmm: string, from: Date): Date {
  const [hh, mm] = hhmm.split(":").map(Number);
  // Iterăm zi cu zi (max 8 zile) construind data în Europe/Chisinau.
  // Folosim Intl.DateTimeFormat ca să aflăm "ziua locală" a unui Date UTC.
  for (let i = 0; i < 8; i++) {
    const probe = new Date(from.getTime() + i * 24 * 3600 * 1000);
    const local = parseLocalParts(probe);
    if (local.weekday !== weekday) continue;

    // Construim Date-ul UTC corespunzător orei locale (hh:mm) la Chișinău în
    // ziua găsită. Folosim diferența între parsLocalParts și UTC pt a obține offset-ul.
    const candidate = makeUtcFromLocal(local.year, local.month, local.day, hh, mm);
    if (candidate.getTime() >= from.getTime()) return candidate;
  }
  // Fallback: nu ar trebui să se întâmple — returnează una săptămâna viitoare.
  const fallback = new Date(from.getTime() + 7 * 24 * 3600 * 1000);
  return fallback;
}

/**
 * Următoarele `count` plecări la weekday/time setat în țară, începând din `from`.
 */
export function nextDepartures(
  weekday: number,
  time: string,
  count: number,
  from: Date = new Date()
): Date[] {
  const first = nextOccurrence(weekday, time, from);
  const out: Date[] = [];
  for (let i = 0; i < count; i++) {
    out.push(new Date(first.getTime() + i * 7 * 24 * 3600 * 1000));
  }
  return out;
}

/**
 * Sosirea estimată = plecare + durata (ore).
 */
export function arrivalFor(departure: Date, durationHours: number): Date {
  return new Date(departure.getTime() + durationHours * 3600 * 1000);
}

/**
 * Întoarce UTC-instant corespunzător orei `hh:mm` la Chișinău, în ziua dinainte
 * de data plecării (interpretată în Europe/Chișinău).
 *
 * Folosit pentru reminder-ele de cursă: vrem ca email-ul să iasă constant
 * dimineața zilei dinainte, indiferent de ora cursei. Asta dă o experiență
 * predictibilă (pasagerul primește mereu mail-ul a doua zi dimineața înainte
 * de călătorie) și ferește de email-uri trimise noaptea sau cu doar 1-2h
 * înainte (cazul când cron-ul zilnic prinde un sendAt exact-24h-before greșit).
 */
export function dayBeforeAtLocal(departure: Date, hh = 8, mm = 0): Date {
  const local = parseLocalParts(departure);
  // Construim "ziua locală" în Moldova, scădem 1 zi, apoi cerem hh:mm pe acea zi.
  // Folosim un Date UTC din care extragem componentele locale ca să gestionăm
  // corect DST-ul (zilele cu trecerea ora -> nu apare problemă pt 08:00).
  const localMidnightUtc = makeUtcFromLocal(local.year, local.month, local.day, 0, 0);
  const dayBeforeMidnightUtc = new Date(localMidnightUtc.getTime() - 24 * 3600 * 1000);
  const dayBeforeLocal = parseLocalParts(dayBeforeMidnightUtc);
  return makeUtcFromLocal(
    dayBeforeLocal.year,
    dayBeforeLocal.month,
    dayBeforeLocal.day,
    hh,
    mm
  );
}

/**
 * Bounds UTC pentru "ziua de mâine" în Europe/Chișinău. Folosit de cron-ul
 * zilnic ca să găsim cursele care pleacă mâine (manifest admin 24h înainte).
 * `start` = mâine 00:00 MD ca UTC. `end` = poimâine 00:00 MD ca UTC (exclusiv).
 */
export function tomorrowWindowMD(now: Date = new Date()): { start: Date; end: Date } {
  const today = parseLocalParts(now);
  const start = makeUtcFromLocal(today.year, today.month, today.day + 1, 0, 0);
  const end = makeUtcFromLocal(today.year, today.month, today.day + 2, 0, 0);
  return { start, end };
}

/**
 * "Ora locală" a unei date interpretată în Europe/Chișinău, formatată "HH:mm".
 * Pentru afișare în email-uri și UI server-render.
 */
export function localTimeStringMD(d: Date): string {
  const p = parseLocalParts(d);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/* ---------- internal: timezone math ---------- */

function parseLocalParts(d: Date): {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=Sun..6=Sat
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday] ?? 0,
  };
}

/**
 * Construiește un Date UTC astfel încât în Europe/Chisinau el să apară ca
 * `year-month-day hour:minute`. Folosim ajustarea iterativă cu offset-ul TZ.
 */
function makeUtcFromLocal(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  // Estimare inițială: tratăm componentele ca UTC, apoi corectăm cu offset-ul TZ-ului.
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMs = tzOffsetMs(guess);
  let actual = new Date(guess.getTime() - offsetMs);
  // O ajustare suplimentară pentru cazurile cu DST în jurul ferestrei.
  const offsetMs2 = tzOffsetMs(actual);
  if (offsetMs2 !== offsetMs) {
    actual = new Date(guess.getTime() - offsetMs2);
  }
  return actual;
}

/**
 * Offset-ul TZ pentru un Date (ms). Negativ pentru zone vest de UTC.
 * Pentru Chișinău (UTC+2/+3), offset-ul e +7200000 sau +10800000.
 */
function tzOffsetMs(d: Date): number {
  const local = parseLocalParts(d);
  const asIfUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    0
  );
  return asIfUtc - d.getTime();
}
