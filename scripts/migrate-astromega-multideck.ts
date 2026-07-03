/**
 * Rescrie DAW 777 (Astromega) ca multi-deck — 2 etaje vizibile separat în UI.
 * Layout-ul anterior (single SeatLayout vertical cu 30 rânduri) e înlocuit
 * cu `{ decks: [deck1, deck2] }`. Numerotarea continuă: deck1 = 1-24,
 * deck2 = 25-89 (via seatStart=25 pe deck2).
 *
 * Idempotent: scanează rezervările existente cu seatNumber și verifică
 * dacă numerele rămân valide. Aplică doar cu --apply.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

type SeatKind =
  | "seat" | "aisle" | "wc" | "driver" | "empty"
  | "stairs" | "table" | "cafe" | "crew";

type SeatLayout = {
  rows: number;
  cols: number;
  cells: SeatKind[];
  direction?: "ltr" | "rtl";
  seatStart?: number;
};

function fromGrid(grid: string[], direction: "ltr" | "rtl" = "ltr", seatStart = 1): SeatLayout {
  const map: Record<string, SeatKind> = {
    S: "seat", A: "aisle", W: "wc", D: "driver", C: "crew",
    T: "table", F: "cafe", X: "stairs", ".": "empty",
  };
  const cells: SeatKind[] = [];
  const cols = grid[0]?.length ?? 0;
  for (const row of grid) {
    if (row.length !== cols) throw new Error(`row "${row}" expected ${cols} chars`);
    for (const ch of row) {
      const k = map[ch];
      if (!k) throw new Error(`Unknown char "${ch}"`);
      cells.push(k);
    }
  }
  return { rows: grid.length, cols, cells, direction, seatStart };
}

function countSeats(l: SeatLayout): number {
  return l.cells.filter((c) => c === "seat").length;
}

const ASTROMEGA_DECK1 = fromGrid(
  [
    ".D.C.", // șofer + crew
    "..A..", // separator
    "FFAFF", // café
    "SSASS", // 1-4 (VIP face-to-face)
    "TTATT", // masă VIP
    "SSASS", // 5-8 (VIP)
    "SSASS", // 9-12
    "SSASS", // 13-16
    "SSASS", // 17-20
    "SSASS", // 21-24
    "XWA..", // scară jos + WC
  ],
  "rtl",
  1,
);

const ASTROMEGA_DECK2 = fromGrid(
  [
    "SSASS", // 25-28 (premium +30 fereastră)
    "SSASS", // 29-32
    "SSASS", // 33-36
    "SSASS", // 37-40
    "..X..", // ieșire 1
    "SSASS", // 41-44
    "SSASS", // 45-48
    "SSASS", // 49-52
    "SSASS", // 53-56
    "..X..", // ieșire 2
    "SSASS", // 57-60
    "SSASS", // 61-64
    "SSASS", // 65-68
    "SSASS", // 69-72
    "SSASS", // 73-76
    "SSASS", // 77-80
    "SSASS", // 81-84
    "SSSSS", // spate 85-89
  ],
  "rtl",
  25,
);

const ASTROMEGA_MULTI = {
  decks: [
    { label: "Etajul 1 (VIP)", layout: ASTROMEGA_DECK1 },
    { label: "Etajul 2 (standard)", layout: ASTROMEGA_DECK2 },
  ],
};

async function main() {
  const prisma = new PrismaClient();
  try {
    const bus = await prisma.bus.findFirst({ where: { plate: "DAW 777" } });
    if (!bus) {
      console.error("✗ DAW 777 not found");
      return;
    }

    const seats1 = countSeats(ASTROMEGA_DECK1);
    const seats2 = countSeats(ASTROMEGA_DECK2);
    const total = seats1 + seats2;
    const startSeat2 = ASTROMEGA_DECK2.seatStart ?? 1;
    const valid = new Set<number>();
    for (let i = 0; i < seats1; i++) valid.add(1 + i);
    for (let i = 0; i < seats2; i++) valid.add(startSeat2 + i);

    console.log(`DAW 777 (${bus.label})`);
    console.log(`  Deck 1: ${seats1} locuri (1–${seats1})`);
    console.log(`  Deck 2: ${seats2} locuri (${startSeat2}–${startSeat2 + seats2 - 1})`);
    console.log(`  Total : ${total} locuri`);

    const sb = await prisma.seatBooking.findMany({
      where: { trip: { busId: bus.id } },
      include: {
        booking: { select: { bookingNumber: true, status: true } },
        trip: { select: { status: true, departureAt: true } },
      },
    });
    const conflicts = sb.filter(
      (s) =>
        (s.booking?.status === "confirmed" || s.booking?.status === "pending") &&
        s.trip.status !== "completed" &&
        s.trip.status !== "cancelled" &&
        !valid.has(s.seatNumber),
    );
    if (conflicts.length > 0) {
      console.log(`  ✗ ${conflicts.length} rezervări active cu locuri invalide`);
      for (const c of conflicts.slice(0, 5)) {
        console.log(`    - loc ${c.seatNumber} · ${c.booking?.bookingNumber}`);
      }
      console.log("  ⏭ Skip apply");
      return;
    }
    console.log("  ✓ Nicio rezervare incompatibilă");

    if (APPLY) {
      await prisma.bus.update({
        where: { id: bus.id },
        data: {
          layoutJson: JSON.stringify(ASTROMEGA_MULTI),
          totalSeats: total,
        },
      });
      console.log("  ✓ Actualizat în DB ca multi-deck");
    } else {
      console.log(`\nMod: DRY-RUN (rulează cu --apply ca să scrie)`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
