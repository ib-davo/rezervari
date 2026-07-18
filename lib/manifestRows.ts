// Desface o rezervare (care poate avea mai multe locuri/pasageri, cu numele
// concatenate cu ", ") în PASAGERI individuali — un rând per loc/persoană, ca
// pe foaia de parcurs reală. Partajat de export Excel (server) + PDF (client).

export type ManifestBooking = {
  firstName: string;
  lastName: string;
  phone: string;
  departureCity: string;
  arrivalCity: string;
  paymentStatus: string;
  price: number;
  currency: string;
  type: string;
  adults: number;
  children: number;
  status: string;
  seatBookings: { seatNumber: number; tripId: string }[];
};

export type ManifestPax = {
  seat: string;
  name: string;
  phone: string;
  route: string;
  paid: boolean;
  price: number; // preț per persoană
  currency: string;
};

function cityOnly(s: string) { return s.split(",")[0].trim(); }
/** Simbolul monedei rezervării — Anglia £ (GBP), Europa € (EUR). Per pasager,
 *  fiindcă o cursă poate fi mixtă (ex. DAW 777 cu Anglia + Belgia pe excepție). */
export function currencySymbol(c: string) { return c === "GBP" ? "£" : c === "EUR" ? "€" : c; }

/** Câți pasageri are rezervarea pe cursele acestui card (locuri, altfel pax). */
export function bookingPax(b: ManifestBooking, tripIds: string[]): number {
  const seats = (b.seatBookings || []).filter((s) => tripIds.includes(s.tripId)).length;
  if (seats > 0) return seats;
  if (b.type === "parcel") return 1;
  return Math.max(1, (b.adults ?? 0) + (b.children ?? 0));
}

/** Un rând per pasager: desparte numele concatenate și le potrivește cu locurile. */
export function expandPassengers(b: ManifestBooking, seats: number[]): ManifestPax[] {
  const firsts = (b.firstName || "").split(",").map((s) => s.trim());
  const lasts = (b.lastName || "").split(",").map((s) => s.trim());
  const nameCount = Math.max(firsts.length, lasts.length);
  const names: string[] = [];
  for (let i = 0; i < nameCount; i++) {
    names.push(`${firsts[i] ?? ""} ${lasts[i] ?? ""}`.replace(/\s+/g, " ").trim());
  }
  const namedCount = names.filter(Boolean).length;
  const paxByCount = b.type === "parcel" ? 1 : Math.max(1, (b.adults ?? 0) + (b.children ?? 0));
  const rowCount = Math.max(seats.length, namedCount, paxByCount, 1);
  const perPrice = Math.round(b.price / rowCount);
  const route = `${cityOnly(b.departureCity)} → ${cityOnly(b.arrivalCity)}`;

  const out: ManifestPax[] = [];
  for (let i = 0; i < rowCount; i++) {
    let name = names[i] || "";
    if (!name) name = i === 0 && namedCount === 0 ? `${b.firstName} ${b.lastName}`.trim() : "—";
    out.push({
      seat: seats[i] != null ? String(seats[i]) : "—",
      name,
      phone: b.phone,
      route,
      paid: b.paymentStatus === "paid",
      price: perPrice,
      currency: b.currency,
    });
  }
  return out;
}

export type ManifestGroupLike = {
  tripIds: string[];
  bookings: ManifestBooking[];
};

/** Toți pasagerii cursei (activi), un rând fiecare, sortați pe loc + totaluri. */
export function computeManifest(g: ManifestGroupLike) {
  const active = g.bookings.filter((b) => b.status !== "cancelled");
  const rows = active
    .flatMap((b) => {
      const seats = (b.seatBookings || []).filter((s) => g.tripIds.includes(s.tripId)).map((s) => s.seatNumber);
      return expandPassengers(b, seats);
    })
    .sort((a, b) => {
      const sa = a.seat === "—" ? 9999 : parseInt(a.seat, 10);
      const sb = b.seat === "—" ? 9999 : parseInt(b.seat, 10);
      return sa - sb;
    });
  const totalPax = rows.length;
  const total = active.reduce((s, b) => s + b.price, 0);
  const paidSum = active.filter((b) => b.paymentStatus === "paid").reduce((s, b) => s + b.price, 0);
  // Totaluri PER MONEDĂ — o cursă poate avea Anglia (£) și Europa (€) împreună,
  // deci nu se pot aduna într-un singur simbol. Fiecare rând își arată moneda lui.
  const byCur = new Map<string, { total: number; paidSum: number }>();
  for (const b of active) {
    const e = byCur.get(b.currency) ?? { total: 0, paidSum: 0 };
    e.total += b.price;
    if (b.paymentStatus === "paid") e.paidSum += b.price;
    byCur.set(b.currency, e);
  }
  const totals = [...byCur.entries()]
    .map(([currency, v]) => ({ currency, symbol: currencySymbol(currency), total: v.total, paidSum: v.paidSum }))
    .sort((a, b) => b.total - a.total);
  const symbol = totals[0]?.symbol ?? "€";
  return { rows, totalPax, total, paidSum, symbol, totals };
}

/** Formatează totalurile multi-monedă: "4400 € + 2280 £" (sau doar "4400 €"). */
export function fmtTotals(totals: { symbol: string; total: number; paidSum: number }[], field: "total" | "paidSum" | "due", sp = " ") {
  const list = totals.length ? totals : [{ symbol: "€", total: 0, paidSum: 0 }];
  return list
    .map((t) => `${field === "due" ? t.total - t.paidSum : t[field]}${sp}${t.symbol}`)
    .join(" + ");
}
