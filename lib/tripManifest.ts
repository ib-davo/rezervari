// Foaie de parcurs PDF (HTML printabil → Salvează ca PDF). Excelul (.xlsx real
// stilizat) e generat pe server: /api/operator/manifest. Aici doar PDF-ul.
import type { OperatorBooking } from "@/components/operator/BookingsView";

export type TripGroup = {
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
  dayKey: string;
  multi: boolean;
  add: { tripId?: string; from?: string; to?: string };
  tripIds: string[];
  bookings: OperatorBooking[];
};

const dtFmt = new Intl.DateTimeFormat("ro-RO", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
});
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
function curr(c: string) { return c === "GBP" ? "£" : c === "EUR" ? "€" : c; }
function cityOnly(s: string) { return s.split(",")[0].trim(); }
function esc(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function seatsFor(b: OperatorBooking, g: TripGroup): number[] {
  return (b.seatBookings || []).filter((s) => g.tripIds.includes(s.tripId)).map((s) => s.seatNumber);
}
function paxWord(n: number) { return `${n} ${n === 1 ? "pasager" : "pasageri"}`; }

export function buildManifestHtml(g: TripGroup): string {
  const active = g.bookings.filter((b) => b.status !== "cancelled");
  const rows = active
    .map((b) => ({
      seats: seatsFor(b, g),
      name: `${b.firstName} ${b.lastName}`.trim(),
      phone: b.phone,
      route: `${cityOnly(b.departureCity)} → ${cityOnly(b.arrivalCity)}`,
      paid: b.paymentStatus === "paid",
      price: `${b.price}${curr(b.currency)}`,
      priceNum: b.price,
    }))
    .sort((a, b) => (a.seats[0] ?? 999) - (b.seats[0] ?? 999));

  const symbol = active[0] ? curr(active[0].currency) : "€";
  const total = rows.reduce((s, r) => s + r.priceNum, 0);
  const paidSum = rows.filter((r) => r.paid).reduce((s, r) => s + r.priceNum, 0);
  const bus = g.busLabel ? `${g.busLabel}${g.busPlate ? ` · ${g.busPlate}` : ""}` : "Fără autocar atribuit";
  const dep = cap(dtFmt.format(new Date(g.departureAt)));

  const body = rows.map((r, i) => `
    <tr>
      <td class="c num">${i + 1}</td>
      <td class="c seat">${esc(r.seats.join(", ") || "—")}</td>
      <td class="name">${esc(r.name)}</td>
      <td class="mono">${esc(r.phone)}</td>
      <td>${esc(r.route)}</td>
      <td class="c ${r.paid ? "ok" : "due"}">${r.paid ? "Achitat" : "Neachitat"}</td>
      <td class="r price">${esc(r.price)}</td>
      <td class="note"></td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="ro"><head><meta charset="utf-8"/>
<title>Foaie de parcurs · ${esc(g.from)} → ${esc(g.to)}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; color: #0b2653; margin: 18px 22px; font-size: 12.5px; }
  .brand { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 2px; }
  .brand .logo { font-size: 15px; font-weight: 800; letter-spacing: .04em; color: #0b2653; }
  .brand .logo b { color: #e11e2b; }
  .brand .tag { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: .15em; }
  .route { font-size: 22px; font-weight: 800; color: #0b2653; margin: 6px 0 2px; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 12px; color: #475569; padding-bottom: 10px; border-bottom: 3px solid #e11e2b; }
  .meta b { color: #0b2653; }
  .pill { display: inline-block; background: #eef2f8; border-radius: 999px; padding: 1px 9px; font-weight: 700; color: #0b2653; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: #0b2653; color: #fff; text-align: left; padding: 7px 9px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .03em; border: 1px solid #0b2653; }
  th.c, td.c { text-align: center; } th.r, td.r { text-align: right; }
  td { padding: 7px 9px; border: 1px solid #dbe2ee; vertical-align: middle; }
  tbody tr:nth-child(even) td { background: #f6f8fc; }
  .num { color: #94a3b8; font-weight: 700; width: 34px; }
  .seat { font-weight: 800; color: #0b2653; }
  .name { font-weight: 600; }
  .mono { font-variant-numeric: tabular-nums; letter-spacing: .2px; }
  .ok { color: #059669; font-weight: 800; } .due { color: #e11e2b; font-weight: 800; }
  .price { font-weight: 800; white-space: nowrap; }
  .note { min-width: 130px; }
  tfoot td { border: none; padding-top: 12px; font-size: 13px; }
  .totlabel { text-align: right; font-weight: 700; color: #475569; }
  .totval { font-weight: 800; font-size: 15px; color: #0b2653; }
  .foot { margin-top: 16px; font-size: 10px; color: #94a3b8; }
  @page { size: A4 landscape; margin: 12mm; }
  @media print { body { margin: 0; } }
</style></head>
<body onload="setTimeout(function(){window.print()},250)">
  <div class="brand">
    <div class="logo">DAVO <b>GROUP</b></div>
    <div class="tag">Foaie de parcurs</div>
  </div>
  <div class="route">${esc(g.from)} &nbsp;→&nbsp; ${esc(g.to)}</div>
  <div class="meta">
    <span>🚌 <b>${esc(bus)}</b></span>
    <span>${esc(dep)}</span>
    <span><span class="pill">${paxWord(rows.length)}</span></span>
    ${g.capacity ? `<span>Ocupare <b>${g.seatsTaken}/${g.capacity}</b></span>` : ""}
    <span>Încasat <b style="color:#059669">${paidSum}${symbol}</b> · De încasat <b style="color:#e11e2b">${total - paidSum}${symbol}</b></span>
  </div>
  <table>
    <thead>
      <tr>
        <th class="c">Nr</th><th class="c">Loc</th><th>Nume și prenume</th><th>Telefon</th>
        <th>Ruta</th><th class="c">Plată</th><th class="r">Preț</th><th>Observații</th>
      </tr>
    </thead>
    <tbody>${body || `<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:24px">Nicio rezervare pe această cursă.</td></tr>`}</tbody>
    <tfoot>
      <tr>
        <td colspan="6" class="totlabel">TOTAL de încasat</td>
        <td class="r totval">${total}${symbol}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>
  <div class="foot">Generat din panoul operatorilor DAVO · davo.md</div>
</body></html>`;
}
