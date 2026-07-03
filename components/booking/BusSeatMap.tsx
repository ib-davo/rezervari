"use client";

import { SeatPicker } from "./SeatPicker";
import { isMultiDeck, type BusLayout } from "@/lib/adminMock";

// Wrapper care decide single vs multi-deck pentru un layout de autocar.
// Toate flow-urile UI (rezervare publică, modală admin, /admin/seats,
// /bilet) folosesc acest component, deci schema arată identic peste tot
// și suportă orice autocar fără cod în plus.
//
// Pentru multi-deck:
//   - Fiecare etaj e desenat ca SeatPicker independent, cu titlu.
//   - selected / occupiedSeats sunt numere absolute (pool global).
//   - SeatPicker pe etajul 2 primește seatStart din SeatLayout.seatStart
//     deja stocat — nu calculăm offset aici.
export function BusSeatMap({
  layout,
  occupiedSeats,
  selected,
  onSelect,
  max,
  onSeatInspect,
}: {
  layout: BusLayout;
  occupiedSeats: number[];
  selected: number[];
  onSelect: (nums: number[]) => void;
  max: number;
  onSeatInspect?: (seatNumber: number) => void;
}) {
  if (!isMultiDeck(layout)) {
    return (
      <SeatPicker
        layout={layout}
        occupiedSeats={occupiedSeats}
        selected={selected}
        onSelect={onSelect}
        max={max}
        onSeatInspect={onSeatInspect}
      />
    );
  }

  return (
    <div className="space-y-4">
      {layout.decks.map((d, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)]/40 p-3 sm:p-4"
        >
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--red-500)]">
              {d.label ?? `Etajul ${i + 1}`}
            </div>
            <div className="text-[11px] text-[color:var(--ink-500)]">
              {d.layout.cells.filter((c) => c === "seat").length} locuri
            </div>
          </div>
          <SeatPicker
            layout={d.layout}
            occupiedSeats={occupiedSeats}
            selected={selected}
            onSelect={onSelect}
            max={max}
            onSeatInspect={onSeatInspect}
          />
        </div>
      ))}
    </div>
  );
}
