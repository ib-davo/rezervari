import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";
import { buildTripGroups, type BookingRow, type TripGroupData } from "@/lib/tripGrouping";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NAVY = "FF0B2653";
const RED = "FFE11E2B";
const GREY = "FFF3F5F9";
const WHITE = "FFFFFFFF";

function curr(c: string) {
  return c === "GBP" ? "£" : c === "EUR" ? "€" : c;
}
function cityOnly(s: string) {
  return s.split(",")[0].trim();
}
function seatsFor(b: BookingRow, g: TripGroupData): number[] {
  return (b.seatBookings || []).filter((s) => g.tripIds.includes(s.tripId)).map((s) => s.seatNumber);
}

function activeRows(g: TripGroupData) {
  return g.bookings
    .filter((b) => b.status !== "cancelled")
    .map((b) => ({
      seats: seatsFor(b, g),
      name: `${b.firstName} ${b.lastName}`.trim(),
      phone: b.phone,
      route: `${cityOnly(b.departureCity)} → ${cityOnly(b.arrivalCity)}`,
      paid: b.paymentStatus === "paid",
      price: b.price,
      currency: b.currency,
    }))
    .sort((a, b) => (a.seats[0] ?? 999) - (b.seats[0] ?? 999));
}

const dtFmt = new Intl.DateTimeFormat("ro-RO", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
});
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export async function GET(req: NextRequest) {
  const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const key = new URL(req.url).searchParams.get("key") || "";
  const { groups } = await buildTripGroups();
  const g = groups.find((x) => x.key === key);
  if (!g) return NextResponse.json({ success: false, error: "Cursă negăsită" }, { status: 404 });

  const rows = activeRows(g);
  const symbol = rows[0] ? curr(rows[0].currency) : "€";
  const total = rows.reduce((s, r) => s + r.price, 0);
  const paidSum = rows.filter((r) => r.paid).reduce((s, r) => s + r.price, 0);
  const bus = g.busLabel ? `${g.busLabel}${g.busPlate ? ` · ${g.busPlate}` : ""}` : "Fără autocar atribuit";
  const dep = cap(dtFmt.format(new Date(g.departureAt)));

  const wb = new ExcelJS.Workbook();
  wb.creator = "DAVO Group";
  const ws = wb.addWorksheet("Foaie de parcurs", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape", margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });

  ws.columns = [
    { width: 5 },   // Nr
    { width: 9 },   // Loc
    { width: 32 },  // Nume
    { width: 18 },  // Telefon
    { width: 26 },  // Ruta
    { width: 12 },  // Plată
    { width: 11 },  // Preț
    { width: 24 },  // Observații
  ];

  const thin = { style: "thin" as const, color: { argb: "FFD6DDEA" } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  // Titlu: ruta
  ws.mergeCells("A1:H1");
  const t = ws.getCell("A1");
  t.value = `${g.from}  →  ${g.to}`;
  t.font = { name: "Calibri", size: 18, bold: true, color: { argb: NAVY } };
  t.alignment = { vertical: "middle" };
  ws.getRow(1).height = 26;

  // Autocar
  ws.mergeCells("A2:H2");
  const b2 = ws.getCell("A2");
  b2.value = `🚌  ${bus}`;
  b2.font = { size: 12, bold: true, color: { argb: NAVY } };

  // Detalii cursă
  ws.mergeCells("A3:H3");
  const b3 = ws.getCell("A3");
  b3.value = `${dep}     ·     Pasageri: ${rows.length}${g.capacity ? `  ·  Ocupare: ${g.seatsTaken}/${g.capacity}` : ""}     ·     Total: ${total} ${symbol}   (încasat ${paidSum} ${symbol})`;
  b3.font = { size: 11, color: { argb: "FF475569" } };
  ws.getRow(4).height = 6;

  // Antet tabel (rândul 5)
  const headers = ["Nr", "Loc", "Nume și prenume", "Telefon", "Ruta", "Plată", "Preț", "Observații"];
  const hr = ws.getRow(5);
  headers.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: WHITE }, size: 11 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.alignment = { vertical: "middle", horizontal: i === 2 || i === 4 ? "left" : "center" };
    c.border = border;
  });
  hr.height = 22;

  // Rânduri pasageri
  rows.forEach((r, i) => {
    const row = ws.getRow(6 + i);
    const cells = [
      i + 1,
      r.seats.join(", ") || "—",
      r.name,
      r.phone,
      r.route,
      r.paid ? "Achitat" : "Neachitat",
      r.price,
      "",
    ];
    cells.forEach((v, ci) => {
      const c = row.getCell(ci + 1);
      c.value = v as ExcelJS.CellValue;
      c.border = border;
      c.font = { size: 11 };
      c.alignment = { vertical: "middle", horizontal: ci === 2 || ci === 4 ? "left" : "center", wrapText: ci === 2 };
      if (i % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY } };
    });
    // Plată colorat
    const pay = row.getCell(6);
    pay.font = { size: 11, bold: true, color: { argb: r.paid ? "FF059669" : RED } };
    // Preț cu simbol
    const price = row.getCell(7);
    price.numFmt = `#,##0" ${symbol}"`;
    price.font = { size: 11, bold: true };
    row.height = 20;
  });

  // Total
  const totalRowIdx = 6 + rows.length + 1;
  ws.mergeCells(`A${totalRowIdx}:E${totalRowIdx}`);
  const tl = ws.getCell(`A${totalRowIdx}`);
  tl.value = `TOTAL · ${rows.length} pasageri`;
  tl.font = { bold: true, size: 12, color: { argb: NAVY } };
  tl.alignment = { vertical: "middle", horizontal: "right" };
  const tp = ws.getCell(`G${totalRowIdx}`);
  tp.value = total;
  tp.numFmt = `#,##0" ${symbol}"`;
  tp.font = { bold: true, size: 12, color: { argb: NAVY } };
  tp.alignment = { horizontal: "center" };
  ws.getCell(`F${totalRowIdx}`).value = "";
  ws.getRow(totalRowIdx).height = 22;

  const buf = await wb.xlsx.writeBuffer();
  const fname = `Foaie-parcurs-${g.from}-${g.to}-${g.dayKey}`.replace(/[^\w.-]+/g, "_") + ".xlsx";

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  });
}
