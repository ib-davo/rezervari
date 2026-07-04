// Foaia de parcurs per CURSĂ FIZICĂ (un autobuz, o zi): export Excel (CSV) +
// PDF (HTML printabil). Include TOȚI pasagerii din toate punctele de îmbarcare,
// cu ruta fiecăruia — ca foaia reală dată șoferului. Fără dependințe.
import type { OperatorBooking } from "@/components/operator/BookingsView";

export type TripGroup = {
  kind: "trip" | "loose";
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
  dayKey: string;
  multi: boolean;
  add: { tripId?: string; from?: string; to?: string };
  tripIds: string[];
  bookings: OperatorBooking[];
};

const dtFmt = new Intl.DateTimeFormat("ro-RO", {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});

function curr(c: string) {
  return c === "GBP" ? "£" : c === "EUR" ? "€" : c;
}
function cityOnly(s: string): string {
  return s.split(",")[0].trim();
}
function routeOf(b: OperatorBooking): string {
  return `${cityOnly(b.departureCity)} → ${cityOnly(b.arrivalCity)}`;
}
function seatsFor(b: OperatorBooking, g: TripGroup): number[] {
  // Locurile rezervării pe cursele acestui card (dus SAU retur — cardul de
  // retur are alt tripId, ambele sunt în g.tripIds ale cardului respectiv).
  return (b.seatBookings || [])
    .filter((s) => g.tripIds.includes(s.tripId))
    .map((s) => s.seatNumber);
}
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function rows(g: TripGroup) {
  return [...g.bookings]
    .sort((a, b) => {
      const ca = a.status === "cancelled" ? 1 : 0;
      const cb = b.status === "cancelled" ? 1 : 0;
      if (ca !== cb) return ca - cb;
      const sa = seatsFor(a, g)[0] ?? 999;
      const sb = seatsFor(b, g)[0] ?? 999;
      return sa - sb;
    })
    .map((b, i) => ({
      idx: i + 1,
      seats: seatsFor(b, g).join(", ") || "—",
      name: `${b.firstName} ${b.lastName}`.trim(),
      phone: b.phone,
      route: routeOf(b),
      nr: b.bookingNumber,
      pay: b.paymentStatus === "paid" ? "Achitat" : "Neachitat",
      price: `${b.price}${curr(b.currency)}`,
      cancelled: b.status === "cancelled",
    }));
}

function totals(g: TripGroup) {
  const active = g.bookings.filter((b) => b.status !== "cancelled");
  const paid = active.filter((b) => b.paymentStatus === "paid");
  const sum = active.reduce((s, b) => s + b.price, 0);
  const paidSum = paid.reduce((s, b) => s + b.price, 0);
  const c = active[0] ? curr(active[0].currency) : "";
  return {
    pax: active.length,
    sum: `${sum}${c}`,
    paidSum: `${paidSum}${c}`,
    dueSum: `${sum - paidSum}${c}`,
  };
}

/** CSV pentru Excel (separator ; + BOM UTF-8). */
export function buildManifestCsv(g: TripGroup): string {
  const bus = g.busLabel ? `${g.busLabel}${g.busPlate ? ` (${g.busPlate})` : ""}` : "Fără autocar";
  const dep = dtFmt.format(new Date(g.departureAt));
  const t = totals(g);
  const cell = (v: string | number) => {
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const line = (arr: (string | number)[]) => arr.map(cell).join(";");
  const out: string[] = [];
  out.push(line([`Cursă: ${g.from} → ${g.to}`]));
  out.push(line([`Autocar: ${bus}`]));
  out.push(line([`Plecare: ${dep}`]));
  out.push(line([`Ocupare: ${g.seatsTaken}${g.capacity ? "/" + g.capacity : ""} locuri`]));
  out.push("");
  out.push(line(["Nr d/o", "Loc", "Nume, prenume", "Nr telefon", "Ruta", "Nr rezervare", "Plată", "Preț"]));
  for (const r of rows(g)) {
    out.push(line([r.idx, r.seats, r.name, r.phone, r.route, r.nr, r.pay, r.price]));
  }
  out.push("");
  out.push(line([`Total pasageri: ${t.pax}`]));
  out.push(line([`Încasat: ${t.paidSum}`, `De încasat: ${t.dueSum}`, `Total: ${t.sum}`]));
  return "﻿" + out.join("\r\n");
}

/** HTML printabil (Salvează ca PDF din dialogul de print). Auto-print la load. */
export function buildManifestHtml(g: TripGroup): string {
  const bus = g.busLabel ? `${g.busLabel}${g.busPlate ? ` · ${g.busPlate}` : ""}` : "Fără autocar atribuit";
  const dep = dtFmt.format(new Date(g.departureAt));
  const t = totals(g);
  const body = rows(g).map((r) => `
    <tr class="${r.cancelled ? "cancelled" : ""}">
      <td class="c">${r.idx}</td>
      <td class="c seat">${esc(r.seats)}</td>
      <td>${esc(r.name)}</td>
      <td class="mono">${esc(r.phone)}</td>
      <td>${esc(r.route)}</td>
      <td class="mono sm">${esc(r.nr)}</td>
      <td class="c ${r.pay === "Achitat" ? "ok" : "due"}">${r.pay}</td>
      <td class="r">${esc(r.price)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="ro"><head><meta charset="utf-8"/>
<title>Foaie de parcurs · ${esc(g.from)} → ${esc(g.to)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0b2653; margin: 24px; }
  .head { border-bottom: 3px solid #e11e2b; padding-bottom: 12px; margin-bottom: 16px; }
  .route { font-size: 21px; font-weight: 800; }
  .meta { color: #475569; font-size: 13px; margin-top: 4px; }
  .meta b { color: #0b2653; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { background: #0b2653; color: #fff; text-align: left; padding: 6px 8px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .02em; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e9f0; }
  .c { text-align: center; } .r { text-align: right; font-weight: 700; }
  .mono { font-family: ui-monospace, Menlo, monospace; } .sm { font-size: 10.5px; color: #64748b; }
  .seat { font-weight: 700; } .ok { color: #059669; font-weight: 700; } .due { color: #e11e2b; font-weight: 700; }
  tr.cancelled td { color: #94a3b8; text-decoration: line-through; }
  .tot { margin-top: 14px; display: flex; gap: 24px; font-size: 14px; }
  .tot b { display: block; font-size: 18px; }
  .foot { margin-top: 20px; color: #94a3b8; font-size: 11px; }
  @media print { body { margin: 10mm; } @page { size: A4 landscape; } }
</style></head>
<body onload="setTimeout(function(){window.print()},250)">
  <div class="head">
    <div class="route">${esc(g.from)} → ${esc(g.to)}</div>
    <div class="meta">🚌 <b>${esc(bus)}</b> · ${esc(dep)} · Ocupare <b>${g.seatsTaken}${g.capacity ? "/" + g.capacity : ""}</b> · ${t.pax} pasageri</div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Loc</th><th>Nume, prenume</th><th>Telefon</th><th>Ruta</th><th>Nr</th><th>Plată</th><th>Preț</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="tot">
    <div>Pasageri <b>${t.pax}</b></div>
    <div>Încasat <b style="color:#059669">${esc(t.paidSum)}</b></div>
    <div>De încasat <b style="color:#e11e2b">${esc(t.dueSum)}</b></div>
    <div>Total <b>${esc(t.sum)}</b></div>
  </div>
  <div class="foot">DAVO Group — foaie de parcurs generată din panoul operatorilor.</div>
</body></html>`;
}
