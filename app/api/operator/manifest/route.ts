import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";
import { buildTripGroups, BOOKING_SELECT, countryOf } from "@/lib/tripGrouping";
import { computeManifest, currencySymbol, fmtTotals, type ManifestBooking } from "@/lib/manifestRows";
import { prisma } from "@/lib/prisma";
import { busPlateForRun } from "@/lib/busSchedule";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NAVY = "FF0B2653";
const RED = "FFE11E2B";
const GREY = "FFF3F5F9";
const WHITE = "FFFFFFFF";

const dtFmt = new Intl.DateTimeFormat("ro-RO", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
});
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Exportul are nevoie doar de câmpurile astea — le satisfac și grupurile active
// (buildTripGroups) și cele reconstruite din arhivă (buildArchiveGroup).
type ManifestGroup = {
  from: string;
  to: string;
  busLabel: string | null;
  busPlate: string | null;
  departureAt: string;
  capacity: number | null;
  dayKey: string;
  tripIds: string[];
  bookings: ManifestBooking[];
};

// Ziua cursei în fusul operatorilor (Moldova) — aceeași cheie pe care o
// calculează arhiva din browser (operatorii lucrează din Moldova; serverul
// Vercel e pe UTC, deci nu putem folosi ziua locală a serverului).
const chisinauDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Chisinau", year: "numeric", month: "2-digit", day: "2-digit",
});

/** Cursă din ARHIVĂ, reconstruită după zi + autocar — buildTripGroups acoperă
 *  doar fereastra activă, dar foaia de parcurs trebuie descărcabilă și după
 *  încheierea cursei (corecturi târzii → documente refăcute corect). Autocarul
 *  per rezervare = același lanț ca /api/operator/bookings (manual → cursă reală
 *  → programul recurent), deci grupul e exact ce vede operatorul în arhivă. */
async function buildArchiveGroup(day: string, coachPlate: string): Promise<ManifestGroup | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split("-").map(Number);
  // Interval UTC larg (±1 zi) în jurul zilei cerute; filtrarea exactă se face
  // pe cheia de zi Europe/Chisinau, ca în listă.
  const start = new Date(Date.UTC(y, m - 1, d - 1));
  const end = new Date(Date.UTC(y, m - 1, d + 2));
  const all = await prisma.booking.findMany({
    where: { departureDate: { gte: start, lt: end } },
    select: BOOKING_SELECT,
    orderBy: { departureDate: "asc" },
    take: 2000,
  });
  const sameDay = all.filter((b) => chisinauDay.format(b.departureDate) === day);

  const manualIds = [...new Set(sameDay.map((b) => b.manualBusId).filter((x): x is string => !!x))];
  const tripIds = [...new Set(sameDay.map((b) => b.tripId).filter((x): x is string => !!x))];
  const [manualBuses, trips] = await Promise.all([
    manualIds.length ? prisma.bus.findMany({ where: { id: { in: manualIds } }, select: { id: true, plate: true } }) : Promise.resolve([]),
    tripIds.length ? prisma.trip.findMany({ where: { id: { in: tripIds } }, select: { id: true, bus: { select: { plate: true } } } }) : Promise.resolve([]),
  ]);
  const plateById = new Map(manualBuses.map((b) => [b.id, b.plate]));
  const plateByTrip = new Map(trips.filter((t) => t.bus).map((t) => [t.id, t.bus!.plate]));
  const coachOf = (b: (typeof sameDay)[number]) =>
    (b.manualBusId && plateById.get(b.manualBusId)) ||
    (b.tripId && plateByTrip.get(b.tripId)) ||
    busPlateForRun(new Date(b.departureDate), countryOf(b.departureCity), countryOf(b.arrivalCity)) ||
    null;
  const list = sameDay.filter((b) => coachOf(b) === (coachPlate || null));
  if (list.length === 0) return null;

  // Capetele rutei ca țări (Moldova → hubul Chișinău), pentru antetul foii.
  const side = (pick: (b: (typeof list)[number]) => string) => {
    const seen = new Set<string>();
    for (const b of list) {
      const raw = pick(b);
      const c = countryOf(raw) || raw.split(",")[0].trim();
      if (c) seen.add(/moldova/i.test(c) ? "Chișinău" : c);
    }
    const arr = [...seen].sort((a, b) => a.localeCompare(b, "ro"));
    return arr.slice(0, 3).join(", ") + (arr.length > 3 ? ` +${arr.length - 3}` : "");
  };
  const bus = coachPlate
    ? await prisma.bus.findFirst({ where: { plate: coachPlate }, select: { label: true, plate: true, totalSeats: true } })
    : null;
  const departureAt = list.reduce(
    (min, b) => (b.departureDate < min ? b.departureDate : min),
    list[0].departureDate
  );
  return {
    from: side((b) => b.departureCity),
    to: side((b) => b.arrivalCity),
    busLabel: bus?.label ?? (coachPlate || null),
    busPlate: bus?.plate ?? null,
    departureAt: departureAt.toISOString(),
    capacity: bus?.totalSeats ?? null,
    dayKey: day,
    // Locurile din foaie = locurile de pe cursele de DUS ale zilei (fiecare
    // rezervare apare în arhivă pe ziua plecării ei).
    tripIds,
    bookings: list,
  };
}

export async function GET(req: NextRequest) {
  const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const key = params.get("key") || "";
  const day = params.get("day");
  const coach = params.get("coach");

  let g: ManifestGroup | null | undefined;
  if (day !== null && coach !== null) {
    g = await buildArchiveGroup(day, coach);
  } else {
    const { groups } = await buildTripGroups();
    g = groups.find((x) => x.key === key);
  }
  if (!g) return NextResponse.json({ success: false, error: "Cursă negăsită" }, { status: 404 });

  const { rows, totalPax, totals } = computeManifest(g);
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
    { width: 14 },  // Confirmare
    { width: 11 },  // Preț
    { width: 26 },  // Observații
  ];

  const thin = { style: "thin" as const, color: { argb: "FFD6DDEA" } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  // Titlu: ruta
  ws.mergeCells("A1:I1");
  const t = ws.getCell("A1");
  t.value = `${g.from}  →  ${g.to}`;
  t.font = { name: "Calibri", size: 18, bold: true, color: { argb: NAVY } };
  t.alignment = { vertical: "middle" };
  ws.getRow(1).height = 26;

  // Autocar
  ws.mergeCells("A2:I2");
  const b2 = ws.getCell("A2");
  b2.value = `🚌  ${bus}`;
  b2.font = { size: 12, bold: true, color: { argb: NAVY } };

  // Detalii cursă
  ws.mergeCells("A3:I3");
  const b3 = ws.getCell("A3");
  b3.value = `${dep}     ·     Pasageri: ${totalPax}${g.capacity ? `  ·  Ocupare: ${totalPax}/${g.capacity}` : ""}     ·     Total: ${fmtTotals(totals, "total")}   (încasat ${fmtTotals(totals, "paidSum")})`;
  b3.font = { size: 11, color: { argb: "FF475569" } };
  ws.getRow(4).height = 6;

  // Antet tabel (rândul 5)
  const headers = ["Nr", "Loc", "Nume și prenume", "Telefon", "Ruta", "Plată", "Confirmare", "Preț", "Observații"];
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
      r.seat,
      r.name,
      r.phone,
      r.route,
      r.paid ? "Achitat" : "Neachitat",
      r.confirm,
      r.price,
      r.note,
    ];
    cells.forEach((v, ci) => {
      const c = row.getCell(ci + 1);
      c.value = v as ExcelJS.CellValue;
      c.border = border;
      c.font = { size: 11 };
      c.alignment = { vertical: "middle", horizontal: ci === 2 || ci === 4 || ci === 8 ? "left" : "center", wrapText: ci === 2 || ci === 8 };
      if (i % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY } };
    });
    // Plată colorat
    const pay = row.getCell(6);
    pay.font = { size: 11, bold: true, color: { argb: r.paid ? "FF059669" : RED } };
    // Confirmare colorat (verde=confirmat, roșu=anulat, chihlimbar=nu răspunde)
    const conf = row.getCell(7);
    conf.font = { size: 11, bold: !!r.confirm, color: { argb: r.confirm === "Confirmat" ? "FF059669" : r.confirm === "Anulat" ? RED : r.confirm === "Nu răspunde" ? "FFB45309" : "FF475569" } };
    // Preț cu simbolul monedei PASAGERULUI (Anglia £, Europa €) — cursă mixtă OK
    const price = row.getCell(8);
    price.numFmt = `#,##0" ${currencySymbol(r.currency)}"`;
    price.font = { size: 11, bold: true };
    row.height = 20;
  });

  // Total
  const totalRowIdx = 6 + rows.length + 1;
  ws.mergeCells(`A${totalRowIdx}:F${totalRowIdx}`);
  const tl = ws.getCell(`A${totalRowIdx}`);
  tl.value = `TOTAL · ${totalPax} pasageri`;
  tl.font = { bold: true, size: 12, color: { argb: NAVY } };
  tl.alignment = { vertical: "middle", horizontal: "right" };
  const tp = ws.getCell(`H${totalRowIdx}`);
  tp.value = fmtTotals(totals, "total");
  tp.font = { bold: true, size: 12, color: { argb: NAVY } };
  tp.alignment = { horizontal: "center" };
  ws.getCell(`G${totalRowIdx}`).value = "";
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
