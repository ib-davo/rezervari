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
function curr(c: string) { return c === "GBP" ? "£" : c === "EUR" ? "€" : c; }

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
  const symbol = active[0] ? curr(active[0].currency) : "€";
  return { rows, totalPax, total, paidSum, symbol };
}
