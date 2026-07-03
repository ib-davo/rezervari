/**
 * Înlocuiește layoutJson + totalSeats pe cele 3 autocare conform schițelor
 * confirmate de admin pe /admin/bus-preview:
 *
 *   - DAW 777 → Van Hool TDX 27 Astromega · 89 locuri (etaj 1 + etaj 2 într-un
 *     singur layout vertical, separate vizual cu un rând empty).
 *   - DAW 077 → Van Hool Altano · 54 locuri (1 etaj, ltr, ușă + WC dreapta).
 *   - ZNQ 874 → Van Hool Alicron · 51 locuri (1 etaj, WC + 2 ieșiri pe dreapta).
 *
 * Înainte de update, scriptul verifică dacă vreo rezervare existentă pe
 * aceste autocare are seatNumber care nu mai e valid în noul layout. Dacă
 * da, raportează și NU aplică nimic (idempotent + safe).
 *
 * Usage:
 *   npx tsx scripts/apply-new-bus-layouts.ts            # dry-run, listă diff
 *   npx tsx scripts/apply-new-bus-layouts.ts --apply    # scrie efectiv în DB
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

type SeatKind =
  | "seat"
  | "aisle"
  | "wc"
  | "driver"
  | "empty"
  | "stairs"
  | "table"
  | "cafe"
  | "crew"
  | "exit";

type SeatLayout = {
  rows: number;
  cols: number;
  cells: SeatKind[];
  direction?: "ltr" | "rtl";
  seatStart?: number;
  seatOverrides?: Record<number, number>;
};

function fromGrid(
  grid: string[],
  direction: "ltr" | "rtl" = "ltr",
  seatStart = 1,
): SeatLayout {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const map: Record<string, SeatKind> = {
    S: "seat",
    A: "aisle",
    W: "wc",
    D: "driver",
    C: "crew",
    T: "table",
    F: "cafe",
    X: "stairs",
    E: "exit",
    ".": "empty",
  };
  const cells: SeatKind[] = [];
  for (const row of grid) {
    if (row.length !== cols) {
      throw new Error(`row "${row}" has ${row.length} chars, expected ${cols}`);
    }
    for (const ch of row) {
      const k = map[ch];
      if (!k) throw new Error(`Unknown cell char "${ch}"`);
      cells.push(k);
    }
  }
  return { rows, cols, cells, direction, seatStart };
}

function countSeats(layout: SeatLayout): number {
  return layout.cells.filter((c) => c === "seat").length;
}

/* ──────────────── Astromega DAW 777 — combo 89 locuri ──────────────── */
// Etaj 1 (1-24) + un rând separator + etaj 2 (25-89). Single layout pentru
// că Bus.layoutJson e un singur SeatLayout. Vizual etajele sunt separate
// printr-un rând empty.
const ASTROMEGA = fromGrid(
  [
    ".D.C.", //  șofer + crew (front bus)
    "..A..",
    "FFAFF", //  café (etaj 1 VIP începe)
    "SSASS", //  rândul VIP 1-4 (face-to-face cu rândul de jos)
    "TTATT", //  masă VIP între cele 2 rânduri face-to-face
    "SSASS", //  5-8
    "SSASS", //  9-12
    "SSASS", //  13-16
    "SSASS", //  17-20
    "SSASS", //  21-24
    "XWA..", //  scară + WC (sfârșit etaj 1)
    ".....", //  separator vizual între etaje
    "SSASS", //  25-28 (etaj 2 începe; premium fereastră +30)
    "SSASS", //  29-32
    "SSASS", //  33-36
    "SSASS", //  37-40
    "..X..", //  ieșire 1 etaj 2
    "SSASS", //  41-44
    "SSASS", //  45-48
    "SSASS", //  49-52
    "SSASS", //  53-56
    "..X..", //  ieșire 2 etaj 2
    "SSASS", //  57-60
    "SSASS", //  61-64
    "SSASS", //  65-68
    "SSASS", //  69-72
    "SSASS", //  73-76
    "SSASS", //  77-80
    "SSASS", //  81-84
    "SSSSS", //  spate 85-89
  ],
  "rtl",
);

/* ──────────────── Alicron ZNQ 874 — 51 locuri ──────────────── */
const ALICRON = fromGrid(
  [
    ".D.C.",
    "..A.X", // ieșire 1 sus-dreapta
    "SSASS", // 1-4
    "SSASS", // 5-8
    "SSASS", // 9-12
    "SSASS", // 13-16
    "SSASS", // 17-20
    "SSASS", // 21-24
    "SS.WX", // 25, 26 stânga + WC + ieșire 2
    "SSASS", // 27-30
    "SSASS", // 31-34
    "SSASS", // 35-38
    "SSASS", // 39-42
    "SSASS", // 43-46
    "SSSSS", // spate 47-51
  ],
  "rtl",
);

/* ──────────────── Altano DAW 077 — 54 locuri ──────────────── */
// Layout conform pozei reale a autocarului: numerotare stânga→dreapta (ltr),
// pereche stânga apoi pereche dreapta pe fiecare rând. Ușa față-dreapta +
// o ușă pe rândul următor, gol pe dreapta la rândul 5/6, WC pe dreapta la
// dreptul locurilor 31/32.
const ALTANO = fromGrid(
  [
    ".D.E.", // șofer (stânga) + ușă față-dreapta
    "..A.E", // culoar + ușă
    "SSASS", // 1-4
    "SSA..", // 5-6 (dreapta gol)
    "SSASS", // 7-10
    "SSASS", // 11-14
    "SSASS", // 15-18
    "SSASS", // 19-22
    "SSASS", // 23-26
    "SSASS", // 27-30
    "SSAW.", // 31-32 + WC pe dreapta
    "SSA..", // 33-34 (dreapta gol)
    "SSASS", // 35-38
    "SSASS", // 39-42
    "SSASS", // 43-46
    "SSASS", // 47-50
    "SSASS", // 51-54
  ],
  "ltr",
);
// Rândul 3 de scaune e numerotat fizic invers față-spate: dreapta = 7,8 și
// stânga = 9,10 (vezi stickerele reale din autocar). Ancorăm cu override-uri:
// idx 20 (stânga) → 9, idx 23 (dreapta) → 7, idx 25 (rândul următor) → 11 ca
// numerotarea automată să revină normal după swap. Restul rămâne 11…54.
ALTANO.seatOverrides = { 20: 9, 23: 7, 25: 11 };

// Mapare plate → noul layout + label.
// ATENȚIE: DAW 777 (Astromega) e multi-deck și se gestionează EXCLUSIV prin
// scripts/migrate-astromega-multideck.ts. NU îl adăuga aici — un SeatLayout
// single-deck i-ar suprascrie cele 2 etaje. (`ASTROMEGA` de mai sus rămâne
// doar ca referință istorică.)
void ASTROMEGA;
const updates: { plate: string; label: string; layout: SeatLayout }[] = [
  { plate: "ZNQ 874", label: "Van Hool Alicron", layout: ALICRON },
  { plate: "DAW 077", label: "Van Hool Altano", layout: ALTANO },
];

// Construim setul de seat numbers valide într-un nou layout. SeatPicker
// numerotează în ordinea direcției (rtl/ltr) și pornind de la seatStart.
// Aici rezultatul nu depinde de ordine, doar de câte seats există.
function validSeatNumbers(layout: SeatLayout): Set<number> {
  const start = layout.seatStart ?? 1;
  const count = countSeats(layout);
  const s = new Set<number>();
  for (let i = 0; i < count; i++) s.add(start + i);
  return s;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    let blockedTotal = 0;
    const reports: string[] = [];

    for (const u of updates) {
      const bus = await prisma.bus.findFirst({ where: { plate: u.plate } });
      if (!bus) {
        reports.push(`✗ ${u.plate}: nu am găsit autocarul în DB`);
        continue;
      }
      const newSeats = countSeats(u.layout);
      reports.push(
        `\n${u.plate} → ${u.label}\n  totalSeats: ${bus.totalSeats} → ${newSeats}`,
      );

      // Verific rezervări existente cu seatNumber care nu mai e valid.
      const seatBookings = await prisma.seatBooking.findMany({
        where: { trip: { busId: bus.id } },
        include: {
          booking: { select: { bookingNumber: true, status: true } },
          trip: { select: { departureAt: true, status: true } },
        },
      });
      const valid = validSeatNumbers(u.layout);
      const conflicts = seatBookings.filter(
        (sb) =>
          (sb.booking?.status === "confirmed" || sb.booking?.status === "pending") &&
          sb.trip.status !== "completed" &&
          sb.trip.status !== "cancelled" &&
          !valid.has(sb.seatNumber),
      );
      if (conflicts.length > 0) {
        blockedTotal += conflicts.length;
        reports.push(`  ✗ ${conflicts.length} rezervări active cu locuri ce dispar în noul layout:`);
        for (const c of conflicts.slice(0, 10)) {
          reports.push(
            `    - loc ${c.seatNumber} · booking ${c.booking?.bookingNumber} · cursa ${c.trip.departureAt.toISOString()}`,
          );
        }
        if (conflicts.length > 10) {
          reports.push(`    … +${conflicts.length - 10} altele`);
        }
      } else {
        reports.push(`  ✓ Nicio rezervare incompatibilă`);
      }

      if (APPLY && conflicts.length === 0) {
        await prisma.bus.update({
          where: { id: bus.id },
          data: {
            layoutJson: JSON.stringify(u.layout),
            totalSeats: newSeats,
          },
        });
        reports.push(`  ✓ Actualizat în DB`);
      } else if (APPLY && conflicts.length > 0) {
        reports.push(`  ⏭ Skip update (apply blocat de conflicte)`);
      }
    }

    console.log(reports.join("\n"));
    console.log("");
    console.log(`Mod: ${APPLY ? "APPLY" : "DRY-RUN"}`);
    if (blockedTotal > 0) {
      console.log(
        `⚠ ${blockedTotal} rezervări active conțin locuri ce dispar — anulează-le sau mută-le înainte de apply.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
